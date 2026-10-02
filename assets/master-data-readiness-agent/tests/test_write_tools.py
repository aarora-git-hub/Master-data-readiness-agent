"""Unit tests for write_tools.py"""

from unittest.mock import MagicMock, patch

import pytest


def _mock_success_response(record_id="REC001"):
    mock = MagicMock()
    mock.status_code = 201
    mock.json.return_value = {"record_id": record_id}
    mock.raise_for_status = MagicMock()
    return mock


def _mock_error_response(status_code=500, text="Internal Server Error"):
    mock = MagicMock()
    mock.status_code = status_code
    mock.text = text
    from httpx import HTTPStatusError, Request, Response
    import httpx
    request = Request("POST", "http://example.com")
    response = MagicMock()
    response.status_code = status_code
    response.text = text
    mock.raise_for_status.side_effect = HTTPStatusError(text, request=request, response=response)
    return mock


def test_custom_table_metadata_mode():
    from tools.write_tools import s4_write_custom_table
    result = s4_write_custom_table.invoke({
        "table_name": "ZCUSTOM_PRICING",
        "mode": "metadata",
        "object_context": {"Material": "MAT001"},
    })
    assert result["mode"] == "metadata"
    assert "field_definitions" in result
    assert len(result["field_definitions"]) > 0
    mandatory_fields = [f for f in result["field_definitions"] if f["mandatory"]]
    assert len(mandatory_fields) > 0


def test_custom_table_write_mode_success():
    from tools.write_tools import s4_write_custom_table, record_human_approval, _approved_steps
    _approved_steps.add("step_write_001")
    record_human_approval("step_write_001")

    with patch("tools.write_tools.httpx.post", return_value=_mock_success_response("REC001")):
        result = s4_write_custom_table.invoke({
            "table_name": "ZCUSTOM_PRICING",
            "mode": "write",
            "object_context": {"Material": "MAT001"},
            "fields": {"Material": "MAT001", "Plant": "P001", "ValidFrom": "2025-01-01"},
            "step_id": "step_write_001",
        })
    assert result["record_id"] == "REC001"
    assert result["table_name"] == "ZCUSTOM_PRICING"
    assert "fields_written" in result


def test_custom_table_write_failure_returns_error_dict():
    from tools.write_tools import s4_write_custom_table, record_human_approval, _approved_steps
    _approved_steps.add("step_write_fail")
    record_human_approval("step_write_fail")

    with patch("tools.write_tools.httpx.post", return_value=_mock_error_response(500)):
        result = s4_write_custom_table.invoke({
            "table_name": "ZCUSTOM_PRICING",
            "mode": "write",
            "object_context": {},
            "fields": {"Material": "MAT001"},
            "step_id": "step_write_fail",
        })
    assert "error_code" in result
    assert result["table_name"] == "ZCUSTOM_PRICING"


def test_brfplus_metadata_mode():
    from tools.write_tools import s4_write_brfplus_rule
    result = s4_write_brfplus_rule.invoke({
        "rule_name": "ZPRICING_RULE",
        "mode": "metadata",
        "object_context": {},
    })
    assert result["mode"] == "metadata"
    assert "field_definitions" in result


def test_brfplus_write_mode_success():
    from tools.write_tools import s4_write_brfplus_rule, record_human_approval, _approved_steps
    _approved_steps.add("step_brf_001")
    record_human_approval("step_brf_001")

    with patch("tools.write_tools.httpx.post", return_value=_mock_success_response("ROW001")):
        result = s4_write_brfplus_rule.invoke({
            "rule_name": "ZPRICING_RULE",
            "mode": "write",
            "object_context": {},
            "fields": {"Material": "MAT001", "Plant": "P001"},
            "step_id": "step_brf_001",
        })
    assert "row_id" in result
    assert result["rule_name"] == "ZPRICING_RULE"
