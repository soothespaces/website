"""How MPrint room numbers are named, and which ones can match LibCal.

On the sheets read so far (Shapiro floor 2, Duderstadt floor 2) a number is one of:

- a plain room, four digits, sometimes three: ``2384``, ``2200``
- an extension of that room, same digits plus a letter: ``2335A``, ``2356E``, ``2321K``
- a letter class, floor digit + letter + two digits: ``2C32`` corridor, ``2S35`` stair,
  ``2E36`` elevator, ``2V21`` vestibule. ``2L`` and ``2F`` use the same shape
  (lobby, open-to-below) and are not bookable rooms either.

LibCal's Duderstadt study rooms are plain four-digit numbers (``2340``, ``2384``).
Extensions and letter classes are not in that list, so they can be set aside
before the join.
"""

import re

_CLASS = {
    "C": "corridor",
    "S": "stair",
    "E": "elevator",
    "V": "vestibule",
    "L": "lobby",
    "F": "open-to-below",
}
_CLASS_RE = re.compile(rf"(\d)([{''.join(_CLASS)}])(\d{{2}})([A-Z])?")
_EXTENSION_RE = re.compile(r"(\d{3,4})([A-Z])")
_ROOM_RE = re.compile(r"(\d{3,4})")


def classify(label: str) -> dict:
    """Return kind, whether it should be joined to LibCal, and the parent room."""
    raw = re.sub(r"\s+", "", label.strip().upper())
    if raw in {"ROOF", "UP", "DN"} or "BELOW" in raw or raw.startswith("FIRSTFLOOR"):
        return {"label": raw, "kind": "open", "matchable": False, "parent": None}
    match = _CLASS_RE.fullmatch(raw)
    if match:
        return {
            "label": raw,
            "kind": _CLASS[match.group(2)],
            "matchable": False,
            "parent": None,
            "floor": int(match.group(1)),
        }
    match = _EXTENSION_RE.fullmatch(raw)
    if match:
        return {"label": raw, "kind": "extension", "matchable": False, "parent": match.group(1)}
    match = _ROOM_RE.fullmatch(raw)
    if match:
        return {"label": raw, "kind": "room", "matchable": True, "parent": match.group(1)}
    return {"label": raw, "kind": "other", "matchable": False, "parent": None}


def match_libcal(labels: list[str], libcal_numbers: list[str]) -> dict:
    """Split a set of labels into LibCal hits, rooms LibCal doesn't list, and ignored names."""
    wanted = set(libcal_numbers)
    found, extra_rooms, ignored = [], [], []
    seen = set()
    for label in labels:
        info = classify(label)
        seen.add(info["label"])
        if info["matchable"] and info["label"] in wanted:
            found.append(info["label"])
        elif info["matchable"]:
            extra_rooms.append(info["label"])
        else:
            ignored.append({"label": info["label"], "kind": info["kind"], "parent": info["parent"]})
    return {
        "found": sorted(set(found)),
        "missing": sorted(wanted - seen),
        "roomsNotInLibcal": sorted(set(extra_rooms)),
        "ignored": ignored,
    }
