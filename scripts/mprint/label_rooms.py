#!/usr/bin/env python3
"""
Label MPrint floor-plan rooms by reading the plan, not by OCR.

The plans' room numbers are ~7px tall on some buildings (e.g. Shapiro), which
Tesseract can't read reliably, but a person (or Claude) can. So the code does
the geometry and a reader supplies the numbers:

  1. sheet   Flood-fill the plan into regions and render zoomed tiles with each
             region's ID in red. Also writes <stem>_components.json.
  2. (read)  Look at the tiles and write a labels file mapping region ID ->
             room number (null for exterior canopies, open-to-below, vestibules).
             Several regions can share a number (a room split by a dashed line).
  3. verify  Redraw the plan with the assigned numbers in blue at each region's
             centre, next to the plan's own black label, to catch transcription
             mistakes.
  4. export  Write the hit-test mask (<stem>_rooms.png, pixel value = room index,
             0 = no room) and <stem>_rooms.json. Regions are grown back over the
             wall pixels the dilation removed, so clicks near a wall still land.

Region IDs depend on the exact image and parameters, so the labels file records
both (with the image's sha256) and every step refuses to run on a mismatch.

Usage:
    python3 label_rooms.py sheet  ulib_2.png --dilation 8 --wall 200
    python3 label_rooms.py verify ulib_2.png labels/ulib_2.json
    python3 label_rooms.py export ulib_2.png labels/ulib_2.json
"""

import argparse
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage

MIN_REGION_PX = 150  # smaller regions are wall slivers, door swings, stair gaps
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def load_plan(path: str) -> tuple[Image.Image, np.ndarray]:
    """Flatten onto white (plans are palette/alpha PNGs) and return RGB + grayscale."""
    rgba = Image.open(path).convert("RGBA")
    flat = Image.new("RGBA", rgba.size, "white")
    flat.alpha_composite(rgba)
    return flat.convert("RGB"), np.array(flat.convert("L"))


def segment(gray: np.ndarray, dilation: int, wall: int) -> tuple[np.ndarray, list[int]]:
    """Label enclosed regions. Returns the label image and the IDs worth labeling."""
    walls = ndimage.binary_dilation(gray < wall, iterations=dilation)
    labels, count = ndimage.label(~walls, structure=np.ones((3, 3)))
    sizes = ndimage.sum(~walls, labels, range(1, count + 1))
    edges = np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]])
    exterior = set(np.unique(edges).tolist()) - {0}
    keep = [i for i in range(1, count + 1) if sizes[i - 1] >= MIN_REGION_PX and i not in exterior]
    return labels, keep


def sha256(path: str) -> str:
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype(FONT, size)
    except OSError:
        return ImageFont.load_default()


def draw_tag(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, fnt, fg, bg) -> None:
    box = draw.textbbox(xy, text, font=fnt, anchor="mm")
    draw.rectangle([box[0] - 2, box[1] - 1, box[2] + 2, box[3] + 1], fill=bg)
    draw.text(xy, text, fill=fg, font=fnt, anchor="mm")


def cmd_sheet(args) -> None:
    rgb, gray = load_plan(args.image)
    labels, keep = segment(gray, args.dilation, args.wall)
    h, w = gray.shape
    dist = ndimage.distance_transform_edt(labels > 0)
    yy, xx = np.ogrid[:h, :w]
    rng = np.random.default_rng(0)
    tinted = np.array(rgb).astype(float)
    components = {}
    for i in keep:
        mask = labels == i
        tinted[mask] = tinted[mask] * 0.75 + rng.integers(60, 255, 3) * 0.25
        ys, xs = np.nonzero(mask)
        cy, cx = ys.mean(), xs.mean()
        # Put the tag deep inside the region but off-centre, where the room number usually is.
        spot = np.where(mask, dist, 0)
        spot[(yy - cy) ** 2 + (xx - cx) ** 2 < 12**2] = 0
        ty, tx = np.unravel_index(spot.argmax(), spot.shape)
        components[str(i)] = {
            "tag": [int(tx), int(ty)],
            "centroid": [round(float(cx)), round(float(cy))],
            "pixelArea": int(mask.sum()),
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
        }

    s = args.scale
    sheet = Image.fromarray(tinted.astype(np.uint8)).resize((w * s, h * s), Image.LANCZOS)
    draw = ImageDraw.Draw(sheet)
    fnt = font(9 * s)
    for cid, c in components.items():
        draw_tag(draw, (c["tag"][0] * s, c["tag"][1] * s), cid, fnt, (220, 0, 0), (255, 255, 255))

    out = Path(args.out or ".")
    out.mkdir(parents=True, exist_ok=True)
    stem = Path(args.image).stem
    tiles = []
    overlap = args.tile // 8
    for y0 in range(0, h, args.tile):
        for x0 in range(0, w, args.tile):
            box = (max(0, x0 - overlap), max(0, y0 - overlap), min(w, x0 + args.tile + overlap), min(h, y0 + args.tile + overlap))
            if not any(box[0] <= c["tag"][0] < box[2] and box[1] <= c["tag"][1] < box[3] for c in components.values()):
                continue
            name = out / f"{stem}_tile_{y0 // args.tile}_{x0 // args.tile}.png"
            sheet.crop(tuple(v * s for v in box)).save(name)
            tiles.append(str(name))

    meta = {
        "image": Path(args.image).name,
        "sha256": sha256(args.image),
        "dilation": args.dilation,
        "wall": args.wall,
        "components": components,
    }
    (out / f"{stem}_components.json").write_text(json.dumps(meta, indent=1))
    print(f"{len(components)} regions; tiles:", *tiles)


def load_labels(args) -> tuple[dict, np.ndarray, Image.Image, np.ndarray]:
    spec = json.loads(Path(args.labels).read_text())
    if spec["sha256"] != sha256(args.image):
        sys.exit(f"{args.image} differs from the image {args.labels} was labeled on (sha256 mismatch). Re-run sheet.")
    rgb, gray = load_plan(args.image)
    labels, keep = segment(gray, spec["dilation"], spec["wall"])
    unknown = sorted(set(spec["labels"]) - {str(i) for i in keep}, key=int)
    unlabeled = sorted({str(i) for i in keep} - set(spec["labels"]), key=int)
    if unknown or unlabeled:
        sys.exit(f"labels don't match the segmentation: unknown IDs {unknown}, unlabeled IDs {unlabeled}")
    return spec, labels, rgb, gray


def cmd_verify(args) -> None:
    spec, labels, rgb, gray = load_labels(args)
    s = args.scale
    h, w = gray.shape
    img = rgb.resize((w * s, h * s), Image.LANCZOS)
    draw = ImageDraw.Draw(img)
    fnt = font(10 * s)
    for cid, number in spec["labels"].items():
        if not number:
            continue
        ys, xs = np.nonzero(labels == int(cid))
        j = np.argmin((ys - ys.mean()) ** 2 + (xs - xs.mean()) ** 2)  # inside the region, nearest its centroid
        draw_tag(draw, (xs[j] * s, ys[j] * s), number, fnt, (0, 60, 220), (230, 240, 255))
    out = Path(args.out or ".") / f"{Path(args.image).stem}_verify.png"
    img.save(out)
    print(out)


def cmd_export(args) -> None:
    spec, labels, _, gray = load_labels(args)
    numbers = sorted({n for n in spec["labels"].values() if n})
    if len(numbers) > 255:
        sys.exit("more than 255 rooms on one floor; the mask would need 16-bit")
    index = {n: i + 1 for i, n in enumerate(numbers)}
    lut = np.zeros(labels.max() + 1, dtype=np.uint8)
    for cid, n in spec["labels"].items():
        if n:
            lut[int(cid)] = index[n]
    mask = lut[labels]
    # Fill the holes the room's own printed number (and fixtures) leave inside it.
    for i in index.values():
        room = mask == i
        mask[ndimage.binary_fill_holes(room) & (mask == 0)] = i
    # Grow rooms back over the wall band the dilation removed, so clicks near walls hit.
    dist, (iy, ix) = ndimage.distance_transform_edt(mask == 0, return_indices=True)
    grow = (mask == 0) & (dist <= spec["dilation"] + 2)
    mask[grow] = mask[iy[grow], ix[grow]]

    rooms = []
    for n, i in index.items():
        ys, xs = np.nonzero(mask == i)
        rooms.append({
            "index": i,
            "roomNumber": n,
            "componentIds": [int(c) for c, v in spec["labels"].items() if v == n],
            "pixelArea": int(len(ys)),
            "centroid": [round(float(xs.mean())), round(float(ys.mean()))],
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())],
        })
    out = Path(args.out or ".")
    stem = Path(args.image).stem
    Image.fromarray(mask, mode="L").save(out / f"{stem}_rooms.png", optimize=True)
    (out / f"{stem}_rooms.json").write_text(json.dumps({
        "image": spec["image"],
        "sha256": spec["sha256"],
        "size": [int(gray.shape[1]), int(gray.shape[0])],
        "mask": f"{stem}_rooms.png",
        "rooms": rooms,
    }, indent=1))
    print(f"{len(rooms)} rooms -> {out / f'{stem}_rooms.png'}, {out / f'{stem}_rooms.json'}")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sheet", help="render numbered-region tiles to read")
    s.add_argument("image")
    s.add_argument("--dilation", type=int, default=8, help="px to grow walls by, closing doorways")
    s.add_argument("--wall", type=int, default=200, help="gray level below which a pixel is wall (200 keeps grey walls)")
    s.add_argument("--tile", type=int, default=600, help="tile size in source px")
    s.add_argument("--scale", type=int, default=2, help="zoom factor for the tiles")
    s.add_argument("--out")
    for name in ("verify", "export"):
        c = sub.add_parser(name)
        c.add_argument("image")
        c.add_argument("labels")
        c.add_argument("--scale", type=int, default=2)
        c.add_argument("--out")
    args = p.parse_args()
    {"sheet": cmd_sheet, "verify": cmd_verify, "export": cmd_export}[args.cmd](args)


if __name__ == "__main__":
    main()
