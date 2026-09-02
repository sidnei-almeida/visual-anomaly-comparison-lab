"""
Export the trained DenoisingConvAutoencoder and its bottle error profile into the
browser-loadable assets under `public/model/`.

The Hugging Face inference API was retired, so inference now runs client-side with
onnxruntime-web. This script is the bridge between the PyTorch training artifacts
(in the `anomaly_detection_unet` repo) and the static assets this app ships.

Outputs:
    public/model/dae-bottle.onnx      ONNX graph, float32, input [1, 3, 256, 256] in [0, 1]
    public/model/bottle-profile.bin   Packed float32 mean map then std map, 256x256 each
    public/model/model-assets.json    Checksums and shapes, read by the loader for validation

Usage:
    python scripts/export-model-assets.py [--artifacts-dir PATH]
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn

IMAGE_SIZE = 256
CATEGORY = "bottle"
LATENT_CHANNELS = 256
OPSET = 17

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ARTIFACTS_DIR = (
    REPO_ROOT.parent / "anomaly_detection_unet" / "models" / "mvtec_structured_objects_dae_v1"
)
OUTPUT_DIR = REPO_ROOT / "public" / "model"


class DenoisingConvAutoencoder(nn.Module):
    """Mirror of the training-time architecture; weights are loaded, not trained."""

    def __init__(self, latent_channels: int = LATENT_CHANNELS) -> None:
        super().__init__()

        self.encoder = nn.Sequential(
            nn.Conv2d(3, 32, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.Conv2d(32, 64, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.Conv2d(64, 128, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.Conv2d(128, latent_channels, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(latent_channels),
            nn.ReLU(inplace=True),
        )

        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(latent_channels, 128, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(128, 64, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(64, 32, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(32, 3, kernel_size=4, stride=2, padding=1),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.decoder(self.encoder(x))


def load_state_dict(model: DenoisingConvAutoencoder, model_path: Path) -> None:
    checkpoint = torch.load(model_path, map_location="cpu", weights_only=False)

    if isinstance(checkpoint, dict) and "state_dict" in checkpoint:
        model.load_state_dict(checkpoint["state_dict"])
    elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
        model.load_state_dict(checkpoint["model_state_dict"])
    else:
        model.load_state_dict(checkpoint)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def export_onnx(model: DenoisingConvAutoencoder, destination: Path) -> None:
    dummy = torch.zeros(1, 3, IMAGE_SIZE, IMAGE_SIZE, dtype=torch.float32)
    torch.onnx.export(
        model,
        (dummy,),
        str(destination),
        input_names=["image"],
        output_names=["reconstruction"],
        opset_version=OPSET,
        do_constant_folding=True,
        dynamo=False,
    )


def export_profile(profiles_path: Path, destination: Path) -> dict[str, float]:
    archive = np.load(profiles_path)
    mean_map = archive[f"{CATEGORY}_mean"].astype(np.float32)
    std_map = archive[f"{CATEGORY}_std"].astype(np.float32)

    for name, array in (("mean", mean_map), ("std", std_map)):
        if array.shape != (IMAGE_SIZE, IMAGE_SIZE):
            raise ValueError(f"{CATEGORY}_{name} has shape {array.shape}, expected 256x256")

    packed = np.concatenate([mean_map.reshape(-1), std_map.reshape(-1)])
    destination.write_bytes(packed.tobytes())

    return {
        "mean_min": float(mean_map.min()),
        "mean_max": float(mean_map.max()),
        "std_min": float(std_map.min()),
        "std_max": float(std_map.max()),
    }


def verify_onnx(model: DenoisingConvAutoencoder, onnx_path: Path) -> float:
    """Return the max absolute deviation between PyTorch and ONNX Runtime outputs."""
    try:
        import onnxruntime  # noqa: PLC0415 — optional verification dependency
    except ImportError:
        return float("nan")

    generator = torch.Generator().manual_seed(0)
    sample = torch.rand(1, 3, IMAGE_SIZE, IMAGE_SIZE, generator=generator)

    with torch.no_grad():
        expected = model(sample).numpy()

    session = onnxruntime.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    actual = session.run(None, {"image": sample.numpy()})[0]

    return float(np.abs(expected - actual).max())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--artifacts-dir", type=Path, default=DEFAULT_ARTIFACTS_DIR)
    args = parser.parse_args()

    artifacts_dir: Path = args.artifacts_dir
    model_path = artifacts_dir / "best_model.pt"
    profiles_path = artifacts_dir / "category_error_profiles.npz"

    for path in (model_path, profiles_path):
        if not path.exists():
            raise FileNotFoundError(f"Missing training artifact: {path}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path = OUTPUT_DIR / "dae-bottle.onnx"
    profile_path = OUTPUT_DIR / "bottle-profile.bin"

    model = DenoisingConvAutoencoder()
    load_state_dict(model, model_path)
    model.eval()

    export_onnx(model, onnx_path)
    profile_stats = export_profile(profiles_path, profile_path)
    max_deviation = verify_onnx(model, onnx_path)

    manifest = {
        "experiment_name": "mvtec_structured_objects_dae_v1",
        "category": CATEGORY,
        "image_size": IMAGE_SIZE,
        "opset": OPSET,
        "model": {
            "file": onnx_path.name,
            "bytes": onnx_path.stat().st_size,
            "sha256": sha256(onnx_path),
            "input": {"name": "image", "shape": [1, 3, IMAGE_SIZE, IMAGE_SIZE], "range": [0, 1]},
            "output": {"name": "reconstruction", "shape": [1, 3, IMAGE_SIZE, IMAGE_SIZE]},
        },
        "profile": {
            "file": profile_path.name,
            "bytes": profile_path.stat().st_size,
            "sha256": sha256(profile_path),
            "layout": "float32 little-endian: mean[256*256] then std[256*256]",
            **profile_stats,
        },
    }
    (OUTPUT_DIR / "model-assets.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(f"onnx     {onnx_path} ({onnx_path.stat().st_size / 1024:.0f} KB)")
    print(f"profile  {profile_path} ({profile_path.stat().st_size / 1024:.0f} KB)")
    print(f"profile stats {profile_stats}")
    if max_deviation == max_deviation:  # not NaN
        print(f"torch vs onnxruntime max abs deviation: {max_deviation:.3e}")
    else:
        print("onnxruntime not installed — skipped numerical verification")


if __name__ == "__main__":
    main()
