"""Entry date (Дата ввода) property helpers."""

from datetime import date

from app.geo.entry_date import (
    DEFAULT_ENTRY_DATE,
    apply_default_entry_date,
    is_in_service,
    parse_entry_date,
    read_entry_date,
)


def test_default_on_create():
    props = apply_default_entry_date("autoroad", {})
    assert props["entry_date"] == "2020-01-01"


def test_skips_node():
    assert apply_default_entry_date("node", {}) == {}


def test_in_service():
    assert is_in_service(date(2020, 1, 1), date(2025, 6, 1))
    assert not is_in_service(date(2030, 1, 1), date(2025, 6, 1))


def test_parse_and_read():
    assert parse_entry_date("2024-05-15") == date(2024, 5, 15)
    assert read_entry_date({}) == DEFAULT_ENTRY_DATE
    assert read_entry_date({"entry_date": "2019-12-31"}) == date(2019, 12, 31)
