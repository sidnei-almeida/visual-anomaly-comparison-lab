#!/usr/bin/env python3
"""
Remove white/light backgrounds from bottle inspection images with soft alpha edges.

Pipeline:
  1. Border-connected flood fill (only external background, not internal highlights)
  2. Morphological close/open
  3. Optional mask shrink/expand
  4. Gaussian feather on alpha
  5. White background decontamination on semi-transparent edge pixels
  6. Export RGBA PNG

Usage:
  python scripts/process_images.py --input data --output public/images/processed

  With dark-background previews for QA:
  python scripts/process_images.py \\
    --input data \\
    --output public/images/processed \\
    --preview public/images/processed_preview

Adjust if edges still look wrong:
  --threshold   lower = more aggressive background (try 235–245)
  --feather     blur radius for soft alpha (try 1.5–4.0)
  --morph-close fill small holes in foreground mask (try 2–5)
  --morph-open  remove speckle noise (try 1–3)
  --expand      dilate foreground mask in pixels (recover lost edge)
  --shrink      erode foreground mask in pixels (tighter cut, less halo)

Optional rembg fallback (requires `pip install rembg`):
  python scripts/process_images.py --input data --output out --method rembg
"""

from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"}
DEFAULT_PREVIEW_BG = (10, 11, 13)  # matches lab dark UI


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Process bottle images: white background → transparent PNG with refined edges."
    )
    parser.add_argument("--input", type=Path, default=Path("data"), help="Input folder")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("public/images/processed"),
        help="Output folder for RGBA PNGs",
    )
    parser.add_argument(
        "--preview",
        type=Path,
        default=None,
        help="Optional folder for dark-background QA previews",
    )
    parser.add_argument(
        "--extensions",
        nargs="+",
        default=sorted(IMAGE_EXTENSIONS),
        help="File extensions to process",
    )
    parser.add_argument(
        "--method",
        choices=("flood", "rembg"),
        default="flood",
        help="Background removal method (default: border flood-fill pipeline)",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=240,
        help="Near-white threshold for background candidates (RGB >= threshold)",
    )
    parser.add_argument(
        "--feather",
        type=float,
        default=2.5,
        help="Gaussian blur sigma for alpha feathering (0 = hard edge)",
    )
    parser.add_argument(
        "--morph-close",
        type=int,
        default=3,
        help="Morphological close kernel size (odd, 0 to disable)",
    )
    parser.add_argument(
        "--morph-open",
        type=int,
        default=2,
        help="Morphological open kernel size (odd, 0 to disable)",
    )
    parser.add_argument(
        "--expand",
        type=int,
        default=1,
        help="Expand foreground mask by N pixels (dilate) before feather",
    )
    parser.add_argument(
        "--shrink",
        type=int,
        default=0,
        help="Shrink foreground mask by N pixels (erode) before feather",
    )
    parser.add_argument(
        "--decontaminate",
        action="store_true",
        default=True,
        help="Remove white spill from semi-transparent edge pixels (default: on)",
    )
    parser.add_argument(
        "--no-decontaminate",
        dest="decontaminate",
        action="store_false",
        help="Disable edge decontamination",
    )
    return parser.parse_args()


def collect_images(input_dir: Path, extensions: set[str]) -> list[Path]:
    files: list[Path] = []
    for path in sorted(input_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in extensions:
            files.append(path)
    return files


def odd_kernel(size: int) -> int:
    if size <= 0:
        return 0
    return size if size % 2 == 1 else size + 1


def near_white_mask(bgr: np.ndarray, threshold: int) -> np.ndarray:
    b, g, r = cv2.split(bgr)
    return (r >= threshold) & (g >= threshold) & (b >= threshold)


def border_flood_background(near_white: np.ndarray) -> np.ndarray:
    """Return boolean mask of background pixels connected to image borders."""
    h, w = near_white.shape
    bg = np.zeros((h, w), dtype=bool)
    visited = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def try_seed(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and near_white[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((x, y))

    for x in range(w):
        try_seed(x, 0)
        try_seed(x, h - 1)
    for y in range(h):
        try_seed(0, y)
        try_seed(w - 1, y)

    while queue:
        x, y = queue.popleft()
        bg[y, x] = True
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and near_white[ny, nx] and not visited[ny, nx]:
                visited[ny, nx] = True
                queue.append((nx, ny))

    return bg


def refine_foreground_mask(
    fg: np.ndarray,
    morph_close: int,
    morph_open: int,
    expand: int,
    shrink: int,
) -> np.ndarray:
    mask = fg.copy()

    close_k = odd_kernel(morph_close)
    if close_k >= 3:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_k, close_k))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    open_k = odd_kernel(morph_open)
    if open_k >= 3:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_k, open_k))
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)

    if shrink > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (shrink * 2 + 1, shrink * 2 + 1)
        )
        mask = cv2.erode(mask, kernel, iterations=1)

    if expand > 0:
        kernel = cv2.getStructuringElement(
            cv2.MORPH_ELLIPSE, (expand * 2 + 1, expand * 2 + 1)
        )
        mask = cv2.dilate(mask, kernel, iterations=1)

    return mask


def feather_alpha(mask: np.ndarray, sigma: float) -> np.ndarray:
    if sigma <= 0:
        return mask.astype(np.float32) / 255.0
    blurred = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), sigmaX=sigma, sigmaY=sigma)
    return np.clip(blurred / 255.0, 0.0, 1.0)


def decontaminate_white_spill(rgb: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    """Un-premultiply from white background on edge pixels to reduce milky halos."""
    out = rgb.astype(np.float32).copy()
    bg = 255.0
    a = np.clip(alpha, 0.0, 1.0)
    safe = a > 1e-3

    for c in range(3):
        channel = out[..., c]
        corrected = (channel - (1.0 - a) * bg) / np.maximum(a, 1e-3)
        channel[safe] = np.clip(corrected[safe], 0.0, 255.0)
        out[..., c] = channel

    return out.astype(np.uint8)


def bgr_to_rgba(bgr: np.ndarray, alpha: np.ndarray) -> np.ndarray:
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    alpha_u8 = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return np.dstack([rgb, alpha_u8])


def process_flood(
    bgr: np.ndarray,
    threshold: int,
    feather: float,
    morph_close: int,
    morph_open: int,
    expand: int,
    shrink: int,
    decontaminate: bool,
) -> np.ndarray:
    bg = border_flood_background(near_white_mask(bgr, threshold))
    fg = np.where(bg, 0, 255).astype(np.uint8)
    fg = refine_foreground_mask(fg, morph_close, morph_open, expand, shrink)
    alpha = feather_alpha(fg, feather)

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    if decontaminate:
        rgb = decontaminate_white_spill(rgb, alpha)

    alpha_u8 = np.clip(alpha * 255.0, 0, 255).astype(np.uint8)
    return np.dstack([rgb, alpha_u8])


def process_rembg(bgr: np.ndarray) -> np.ndarray:
    try:
        from rembg import remove
    except ImportError as exc:
        raise RuntimeError("rembg not installed. Run: pip install rembg") from exc

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    pil_in = Image.fromarray(rgb)
    pil_out = remove(pil_in)
    return np.array(pil_out.convert("RGBA"))


def make_preview(rgba: np.ndarray, bg_color: tuple[int, int, int]) -> np.ndarray:
    rgb = rgba[..., :3].astype(np.float32)
    alpha = rgba[..., 3:4].astype(np.float32) / 255.0
    bg = np.array(bg_color, dtype=np.float32)
    composited = rgb * alpha + bg * (1.0 - alpha)
    return composited.astype(np.uint8)


def output_path_for(input_path: Path, input_root: Path, output_root: Path) -> Path:
    relative = input_path.relative_to(input_root)
    return output_root / relative.with_suffix(".png")


def main() -> int:
    args = parse_args()
    extensions = {ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in args.extensions}

    input_dir = args.input.resolve()
    output_dir = args.output.resolve()
    preview_dir = args.preview.resolve() if args.preview else None

    if not input_dir.is_dir():
        print(f"Input folder not found: {input_dir}", file=sys.stderr)
        return 1

    images = collect_images(input_dir, extensions)
    print("Background removal pipeline")
    print(f"  Method:    {args.method}")
    print(f"  Input:     {input_dir}")
    print(f"  Output:    {output_dir}")
    if preview_dir:
        print(f"  Preview:   {preview_dir}")
    print(f"  Threshold: {args.threshold}")
    print(f"  Feather:   {args.feather}")
    print(f"  Found:     {len(images)} image(s)")
    print()

    output_dir.mkdir(parents=True, exist_ok=True)
    if preview_dir:
        preview_dir.mkdir(parents=True, exist_ok=True)

    processed = 0
    skipped = 0

    for input_path in images:
        out_path = output_path_for(input_path, input_dir, output_dir)
        out_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            bgr = cv2.imread(str(input_path), cv2.IMREAD_COLOR)
            if bgr is None:
                raise RuntimeError("cv2.imread failed")

            if args.method == "rembg":
                rgba = process_rembg(bgr)
            else:
                rgba = process_flood(
                    bgr,
                    threshold=args.threshold,
                    feather=args.feather,
                    morph_close=args.morph_close,
                    morph_open=args.morph_open,
                    expand=args.expand,
                    shrink=args.shrink,
                    decontaminate=args.decontaminate,
                )

            Image.fromarray(rgba, mode="RGBA").save(out_path, format="PNG", optimize=True)

            if preview_dir:
                preview_path = output_path_for(input_path, input_dir, preview_dir)
                preview_path.parent.mkdir(parents=True, exist_ok=True)
                preview_rgb = make_preview(rgba, DEFAULT_PREVIEW_BG)
                Image.fromarray(preview_rgb, mode="RGB").save(preview_path, format="PNG", optimize=True)

            rel_out = out_path.relative_to(Path.cwd()) if out_path.is_relative_to(Path.cwd()) else out_path
            print(f"  ✓ {input_path.name} → {rel_out}")
            processed += 1
        except Exception as exc:  # noqa: BLE001 — CLI batch tool
            skipped += 1
            print(f"  ✗ {input_path.name}: {exc}", file=sys.stderr)

    print()
    print(f"Processed {processed} image(s).")
    if skipped:
        print(f"Skipped {skipped} image(s).")
    print(f"Output: {output_dir}")

    return 1 if skipped else 0


if __name__ == "__main__":
    raise SystemExit(main())
