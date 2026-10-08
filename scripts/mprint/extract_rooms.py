#!/usr/bin/env python3
"""
Prototype: extract room polygons + numbers from an MPrint floor-plan PNG.

Pipeline (see docs/technical/mprint-extraction.md for the full writeup and
validated results):
  1. OCR the image (tesseract) to find room-number text and its pixel position.
  2. Binarize the image (wall/line pixels vs. background) and dilate the wall
     mask by a few pixels to close small gaps - door openings, and the gaps
     between dashes in a non-physical (dashed) boundary like an open lounge.
  3. Label connected white regions - each enclosed region is a candidate room
     polygon.
  4. Assign each OCR'd room number to the component containing it (falling
     back to the nearest white pixel, since OCR'd text itself is drawn in the
     same black ink as the walls).
  5. Flag any component claimed by more than 2 distinct room numbers - that's
     a strong, free signal of an under-closed area (an open corridor merging
     several nominally separate rooms), not a real single big room, and it
     needs a higher dilation radius or manual review rather than being
     trusted as-is.

This does NOT (yet):
  - Convert pixel-space polygons to real lat/lng (needs a per-building
    calibration against known reference points - not attempted here).
  - Auto-calibrate the dilation radius per image (a fixed radius is passed
    in; different floor plans may need different values - see the docs).
  - Replace manual entries for rooms that aren't in the Registrar data at
    all (e.g. informal lounges like Greene Lounge / room 1808 in East Quad) -
    those still need to be keyed in by hand, matching a real room number this
    script already finds, alongside a name/type override.

Usage:
    python3 extract_rooms.py <floorplan.png> --dilation 6 [--out rooms.json]
"""

import argparse
import json
import sys
from collections import defaultdict

import numpy as np
import pytesseract
from PIL import Image
from scipy import ndimage

WALL_THRESHOLD = 128
OCR_CONFIG = "--psm 11 -c tessedit_char_whitelist=0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
MULTI_LABEL_REVIEW_THRESHOLD = 2  # >N distinct labels in one component => flag


def ocr_room_labels(gray: np.ndarray) -> list[dict]:
    """Detect room-number-shaped text and its pixel bounding box."""
    data = pytesseract.image_to_data(
        Image.fromarray(gray), config=OCR_CONFIG, output_type=pytesseract.Output.DICT
    )
    labels = []
    for i, text in enumerate(data["text"]):
        text = text.strip()
        if not text or not any(c.isdigit() for c in text):
            continue
        left, top = data["left"][i], data["top"][i]
        width, height = data["width"][i], data["height"][i]
        labels.append(
            {
                "text": text,
                "x": left + width // 2,
                "y": top + height // 2,
                "confidence": data["conf"][i],
            }
        )
    return labels


def nearest_white_pixel_label(
    label_arr: np.ndarray, white_mask: np.ndarray, x: int, y: int, max_radius: int = 40
) -> int:
    """OCR text itself is black ink, so the exact centroid often lands on a
    wall/text pixel, not room interior. Search outward for the nearest
    actual room pixel and use its component id instead."""
    if white_mask[y, x]:
        return int(label_arr[y, x])
    for r in range(1, max_radius):
        y0, y1 = max(0, y - r), min(white_mask.shape[0], y + r + 1)
        x0, x1 = max(0, x - r), min(white_mask.shape[1], x + r + 1)
        patch = white_mask[y0:y1, x0:x1]
        if patch.any():
            ys, xs = np.nonzero(patch)
            dists = (ys + y0 - y) ** 2 + (xs + x0 - x) ** 2
            i = int(np.argmin(dists))
            return int(label_arr[ys[i] + y0, xs[i] + x0])
    return -1


def extract_rooms(image_path: str, dilation: int) -> dict:
    gray = np.array(Image.open(image_path).convert("L"))
    wall_mask = gray < WALL_THRESHOLD

    closed_walls = ndimage.binary_dilation(wall_mask, iterations=dilation)
    room_mask = ~closed_walls
    component_ids, num_components = ndimage.label(room_mask, structure=np.ones((3, 3)))

    ocr_labels = ocr_room_labels(gray)

    component_to_labels: dict[int, list[dict]] = defaultdict(list)
    for label in ocr_labels:
        comp_id = nearest_white_pixel_label(component_ids, room_mask, label["x"], label["y"])
        if comp_id > 0:  # 0 is background (wall) - text found no nearby room pixel
            component_to_labels[comp_id].append(label)

    rooms = {}
    needs_review = []
    for comp_id, labels in component_to_labels.items():
        distinct_texts = {label["text"] for label in labels}
        component_size = int((component_ids == comp_id).sum())
        entry = {
            "componentId": comp_id,
            "pixelArea": component_size,
            "labels": labels,
        }
        if len(distinct_texts) > MULTI_LABEL_REVIEW_THRESHOLD:
            needs_review.append(entry)
        for label in labels:
            rooms[label["text"]] = entry

    return {
        "sourceImage": image_path,
        "dilationRadiusPx": dilation,
        "numComponents": num_components,
        "roomsFound": len(rooms),
        "componentsNeedingReview": needs_review,
        "rooms": rooms,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", help="Path to an MPrint floor-plan PNG")
    parser.add_argument(
        "--dilation",
        type=int,
        default=6,
        help="Wall-closing dilation radius in pixels (default: 6, validated on a "
        "~4000px-wide East Quad floor plan - re-tune per image resolution/line weight)",
    )
    parser.add_argument("--out", help="Write JSON output here instead of stdout")
    args = parser.parse_args()

    result = extract_rooms(args.image, args.dilation)

    output = json.dumps(result, indent=2)
    if args.out:
        with open(args.out, "w") as f:
            f.write(output)
    else:
        print(output)

    if result["componentsNeedingReview"]:
        print(
            f"\n{len(result['componentsNeedingReview'])} component(s) claimed by "
            f"more than {MULTI_LABEL_REVIEW_THRESHOLD} distinct room numbers - "
            "likely under-closed (merged corridor/open area), needs a higher "
            "dilation radius or manual review. See componentsNeedingReview.",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()
