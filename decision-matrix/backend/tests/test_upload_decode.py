"""Upload decode helpers for map import (SOLID phase 13)."""

import io
import zipfile

import pytest

from app.services.file_import.upload_decode import (
    KmzWithoutKmlError,
    decode_csv_bytes,
    decode_kml_bytes,
    decode_upload_for_preview,
)


def test_decode_csv_bytes_strips_bom():
    raw = b"\xef\xbb\xbfname,lon,lat\n"
    assert decode_csv_bytes(raw) == "name,lon,lat\n"


def test_decode_kml_plain():
    raw = b"<kml></kml>"
    assert decode_kml_bytes(raw, "layer.kml") == "<kml></kml>"


def test_decode_kml_kmz_extracts_first_kml():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("doc.kml", "<kml>ok</kml>")
    content = decode_kml_bytes(buf.getvalue(), "archive.kmz")
    assert content == "<kml>ok</kml>"


def test_decode_kml_strict_kmz_raises():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("readme.txt", "no kml")
    with pytest.raises(KmzWithoutKmlError):
        decode_kml_bytes(buf.getvalue(), "empty.kmz", strict_kmz=True)


def test_decode_upload_for_preview_csv_default():
    content, fmt = decode_upload_for_preview(b"a,b\n1,2", "data.csv", "csv")
    assert fmt == "csv"
    assert "a,b" in content


def test_decode_upload_for_preview_geojson_by_extension():
    content, fmt = decode_upload_for_preview(b'{"type":"FeatureCollection","features":[]}', "x.geojson", "csv")
    assert fmt == "geojson"
    assert "FeatureCollection" in content
