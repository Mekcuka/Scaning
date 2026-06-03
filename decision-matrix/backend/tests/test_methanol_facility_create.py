"""methanol_facility: menu «Точка», paste, POST /objects; subtype immutable after create."""

import pytest

from app.geo.constants import (
    IMPORT_ONLY_POINT_SUBTYPES,
    SPARK_EXCLUSIVE_POINT_SUBTYPES,
)
from app.geo.validation import validate_general_infra_create, validate_subtype_change


def test_methanol_not_blocked_as_import_only_or_spark_exclusive():
    assert "methanol_facility" not in IMPORT_ONLY_POINT_SUBTYPES
    assert "methanol_facility" not in SPARK_EXCLUSIVE_POINT_SUBTYPES


def test_general_create_allows_methanol_facility_for_paste_duplicate():
    validate_general_infra_create("methanol_facility")


def test_cannot_reclassify_other_subtype_to_methanol_facility():
    with pytest.raises(ValueError, match="смена"):
        validate_subtype_change("node", "methanol_facility")


def test_methanol_facility_subtype_is_immutable():
    with pytest.raises(ValueError, match="нельзя изменить"):
        validate_subtype_change("methanol_facility", "node")
