# MPrint room extraction (prototype)

See [`docs/technical/mprint-extraction.md`](../../docs/technical/mprint-extraction.md)
for the full writeup — what this does, what's been validated, and what's still
missing (georeferencing, OCR validation, broader building coverage).

## Setup

Requires the Tesseract OCR binary (not just the Python binding):

```bash
sudo apt-get install -y tesseract-ocr   # or the equivalent for your OS
pip install -r requirements.txt
```

## Usage

```bash
curl -o eq_1.png https://mprint.umich.edu/assets/floorplans/eq/eq_1.png
python3 extract_rooms.py eq_1.png --dilation 6 --out eq_1_rooms.json
```

Check stderr for a warning if any component is claimed by more than 2 distinct
room-number labels — that's a free signal the wall-closing dilation didn't fully
separate a corridor/open area from its neighbors at the radius given, and needs a
higher `--dilation` value or manual review, not blind trust.
