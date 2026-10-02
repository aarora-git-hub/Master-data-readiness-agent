"""Unit tests for fiori_link_tool.py"""

import pytest


def test_fiori_url_constructed_for_operational_table():
    from tools.fiori_link_tool import s4_resolve_fiori_link
    result = s4_resolve_fiori_link.invoke({
        "table_name": "A004",
        "object_context": {"SalesOrganization": "1000", "DistributionChannel": "10", "Material": "MAT001"},
    })
    assert result["table_category"] == "operational"
    assert result["fiori_url"] is not None
    assert "ConditionRecord" in result["fiori_url"]


def test_transaction_code_fallback_for_operational_table():
    from tools.fiori_link_tool import s4_resolve_fiori_link
    result = s4_resolve_fiori_link.invoke({
        "table_name": "A004",
        "object_context": {},
    })
    assert result["transaction_code"] == "VK11"


def test_transport_managed_table_no_fiori_url():
    from tools.fiori_link_tool import s4_resolve_fiori_link
    result = s4_resolve_fiori_link.invoke({
        "table_name": "T001W",
        "object_context": {"Plant": "PLANT01"},
    })
    assert result["table_category"] == "transport-managed"
    assert result["fiori_url"] is None
    assert result["transaction_code"] == "OX10"
    assert result["tr_instruction"] is not None


def test_tvkwz_transport_managed():
    from tools.fiori_link_tool import s4_resolve_fiori_link
    result = s4_resolve_fiori_link.invoke({
        "table_name": "TVKWZ",
        "object_context": {},
    })
    assert result["table_category"] == "transport-managed"
    assert result["fiori_url"] is None


def test_unknown_table_returns_fallback():
    from tools.fiori_link_tool import s4_resolve_fiori_link
    result = s4_resolve_fiori_link.invoke({
        "table_name": "ZTABLE_UNKNOWN",
        "object_context": {},
    })
    assert result["table_category"] == "unknown"
    assert result["fiori_url"] is None
