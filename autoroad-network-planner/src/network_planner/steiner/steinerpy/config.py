"""SteinerPy availability."""


def is_steinerpy_available() -> bool:
    """Return True when steinerpy and highspy are importable."""
    try:
        import highspy  # noqa: F401
        import steinerpy  # noqa: F401

        return True
    except ImportError:
        return False
