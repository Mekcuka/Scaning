"""Minimal box mesh export as GLB (preview)."""

from __future__ import annotations

import base64
import json
import struct


def _pack_glb(json_obj: dict, bin_data: bytes) -> bytes:
    json_bytes = json.dumps(json_obj, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    json_bytes += b" " * json_pad
    bin_pad = (4 - (len(bin_data) % 4)) % 4
    bin_data += b"\x00" * bin_pad
    total = 12 + 8 + len(json_bytes) + 8 + len(bin_data)
    header = struct.pack("<4sII", b"glTF", 2, total)
    json_chunk = struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes
    bin_chunk = struct.pack("<I4s", len(bin_data), b"BIN\x00") + bin_data
    return header + json_chunk + bin_chunk


def box_mesh_glb_base64(length_m: float, width_m: float, height_m: float) -> str:
    """Axis-aligned box centered at origin, base at z=0, exported as base64 GLB."""
    hl = length_m / 2.0
    hw = width_m / 2.0
    hh = height_m
    positions = [
        -hl, -hw, 0.0, hl, -hw, 0.0, hl, hw, 0.0, -hl, hw, 0.0,
        -hl, -hw, hh, hl, -hw, hh, hl, hw, hh, -hl, hw, hh,
    ]
    indices = [
        0, 2, 1, 0, 3, 2,
        4, 5, 6, 4, 6, 7,
        0, 1, 5, 0, 5, 4,
        2, 3, 7, 2, 7, 6,
        1, 2, 6, 1, 6, 5,
        0, 4, 7, 0, 7, 3,
    ]
    pos_bytes = struct.pack(f"<{len(positions)}f", *positions)
    idx_bytes = struct.pack(f"<{len(indices)}H", *indices)
    bin_data = pos_bytes + idx_bytes
    gltf = {
        "asset": {"version": "2.0", "generator": "pad-earthwork-planner"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [
            {
                "primitives": [
                    {
                        "attributes": {"POSITION": 0},
                        "indices": 1,
                        "mode": 4,
                    }
                ]
            }
        ],
        "buffers": [{"byteLength": len(bin_data)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pos_bytes), "target": 34962},
            {"buffer": 0, "byteOffset": len(pos_bytes), "byteLength": len(idx_bytes), "target": 34963},
        ],
        "accessors": [
            {
                "bufferView": 0,
                "componentType": 5126,
                "count": 8,
                "type": "VEC3",
                "min": [-hl, -hw, 0.0],
                "max": [hl, hw, hh],
            },
            {"bufferView": 1, "componentType": 5123, "count": len(indices), "type": "SCALAR"},
        ],
    }
    return base64.b64encode(_pack_glb(gltf, bin_data)).decode("ascii")
