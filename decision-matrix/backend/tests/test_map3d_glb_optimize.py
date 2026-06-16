from app.services.map3d_glb_optimize import optimize_glb_upload


def test_optimize_glb_upload_returns_original_when_no_tooling():
    raw = b"glTF" + b"\x00" * 20 + b"payload"
    out, compressed = optimize_glb_upload(raw)
    assert out == raw
    assert compressed is False


def test_optimize_glb_upload_rejects_tiny_payload():
    raw = b"glTF"
    out, compressed = optimize_glb_upload(raw)
    assert out == raw
    assert compressed is False
