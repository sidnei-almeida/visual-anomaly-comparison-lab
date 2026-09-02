"""
Capture reference outputs from the original Python inference service.

`scripts/validate-local-inference.ts` replays these through the TypeScript port to prove
the browser engine still reproduces the numbers the model was calibrated against.

Requires a checkout of the `anomaly_detection_unet` repo (the retired Hugging Face
service) and its dependencies: torch, torchvision, opencv, Pillow.

Usage:
    python scripts/make-parity-fixture.py <output-dir> [--api-repo PATH] [--samples N]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_API_REPO = REPO_ROOT.parent / "anomaly_detection_unet"
CATEGORY = "bottle"


def pick_samples(catalog_dir: Path, count: int) -> list[Path]:
    """Spread the picks across the catalog so several defect types are covered."""
    files = sorted(catalog_dir.glob("*.png"))
    if not files:
        raise FileNotFoundError(f"No catalog images under {catalog_dir}")
    if count >= len(files):
        return files
    step = len(files) / count
    return [files[min(len(files) - 1, int(i * step))] for i in range(count)]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--api-repo", type=Path, default=DEFAULT_API_REPO)
    parser.add_argument("--samples", type=int, default=4)
    args = parser.parse_args()

    if not (args.api_repo / "model_utils.py").exists():
        raise FileNotFoundError(f"model_utils.py not found in {args.api_repo}")

    sys.path.insert(0, str(args.api_repo))
    import model_utils  # noqa: PLC0415 — path must be set up first

    output_dir: Path = args.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    artifacts = model_utils.setup_model_and_config()
    to_tensor = transforms.ToTensor()

    index = []
    for n, path in enumerate(pick_samples(REPO_ROOT / "data" / "catalog", args.samples)):
        image = Image.open(path).convert("RGB")
        native = np.array(image, dtype=np.uint8)
        resized = image.resize((model_utils.IMAGE_SIZE, model_utils.IMAGE_SIZE))

        results = model_utils.predict(artifacts, image, CATEGORY)

        with torch.no_grad():
            reconstruction = artifacts.model(to_tensor(resized).unsqueeze(0))

        dumps = {
            "native": native,
            "resized": np.array(resized, dtype=np.uint8),
            "recon": reconstruction.squeeze(0).numpy().astype(np.float32),
            "heatmap": np.array(results["heatmap_colored"], dtype=np.uint8),
            "mask": np.array(results["binary_mask"], dtype=np.uint8),
            "product_mask": np.array(results["product_mask_gray"], dtype=np.uint8),
            "reconimg": np.array(results["reconstructed_image"], dtype=np.uint8),
        }
        for name, array in dumps.items():
            (output_dir / f"{n}_{name}.bin").write_bytes(array.tobytes())

        index.append(
            {
                "n": n,
                "file": path.name,
                "native_width": int(native.shape[1]),
                "native_height": int(native.shape[0]),
                "status": results["status"],
                "is_anomaly": bool(results["is_anomaly"]),
                "anomaly_score": float(results["anomaly_score"]),
                "threshold": float(results["threshold"]),
                "error_mean": float(results["error_mean"]),
                "z_map_max": float(results["z_map_max"]),
                "boxes": [{k: float(v) for k, v in box.items()} for box in results["boxes"]],
            }
        )
        print(f"{path.name}: {results['status']} score={results['anomaly_score']:.4f}")

    (output_dir / "index.json").write_text(json.dumps(index, indent=2) + "\n")
    print(f"\nWrote {len(index)} reference samples to {output_dir}")


if __name__ == "__main__":
    main()
