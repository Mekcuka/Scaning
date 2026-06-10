"""Decode uploaded import files to text (API layer helpers)."""

from __future__ import annotations

import io
import zipfile

from app.services.file_import.parse import detect_import_format


class KmzWithoutKmlError(ValueError):
    """KMZ archive contains no .kml entry."""


def decode_csv_bytes(raw: bytes) -> str:
    return raw.decode("utf-8-sig")


def decode_utf8_bytes(raw: bytes) -> str:
    return raw.decode("utf-8")


def decode_kml_bytes(raw: bytes, filename: str, *, strict_kmz: bool = False) -> str:
    name = (filename or "").lower()
    if name.endswith(".kmz"):
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            kml_names = [n for n in zf.namelist() if n.lower().endswith(".kml")]
            if not kml_names:
                if strict_kmz:
                    raise KmzWithoutKmlError("KMZ contains no KML")
                return ""
            return zf.read(kml_names[0]).decode("utf-8", errors="replace")
    return raw.decode("utf-8", errors="replace")


def decode_upload_for_preview(raw: bytes, filename: str, format: str) -> tuple[str, str]:
    """Return (text content, resolved format) for import preview."""
    name = (filename or "").lower()
    if format == "kml" or name.endswith((".kml", ".kmz")):
        return decode_kml_bytes(raw, filename), "kml"
    if format in ("geojson", "spark") or name.endswith((".geojson", ".json")):
        content = raw.decode("utf-8", errors="replace")
        resolved = format if format == "spark" else detect_import_format(content, name)
        return content, resolved
    return decode_csv_bytes(raw), "csv"
