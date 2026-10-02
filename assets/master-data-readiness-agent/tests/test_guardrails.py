"""Unit tests for guardrail checks in write_tools.py"""

import pytest


def test_write_custom_table_raises_without_approval():
    from tools.write_tools import s4_write_custom_table, GuardrailViolationError, _approved_steps
    # Ensure this step_id is NOT approved
    step_id = "step_unapproved_001"
    _approved_steps.discard(step_id)

    with pytest.raises(GuardrailViolationError, match="without recorded human approval"):
        s4_write_custom_table.invoke({
            "table_name": "ZCUSTOM",
            "mode": "write",
            "object_context": {},
            "fields": {"Material": "MAT001"},
            "step_id": step_id,
        })


def test_write_brfplus_raises_without_approval():
    from tools.write_tools import s4_write_brfplus_rule, GuardrailViolationError, _approved_steps
    step_id = "step_brf_unapproved"
    _approved_steps.discard(step_id)

    with pytest.raises(GuardrailViolationError, match="without recorded human approval"):
        s4_write_brfplus_rule.invoke({
            "rule_name": "ZRULE",
            "mode": "write",
            "object_context": {},
            "fields": {"Material": "MAT001"},
            "step_id": step_id,
        })


def test_metadata_mode_does_not_require_approval():
    """Metadata mode (form loading) must never require human approval."""
    from tools.write_tools import s4_write_custom_table, _approved_steps
    step_id = "step_meta_no_approval"
    _approved_steps.discard(step_id)

    # Should NOT raise GuardrailViolationError
    result = s4_write_custom_table.invoke({
        "table_name": "ZCUSTOM",
        "mode": "metadata",
        "object_context": {},
        "step_id": step_id,
    })
    assert result["mode"] == "metadata"


def test_empty_checklist_error_is_importable():
    """EmptyChecklistError must be importable and catchable."""
    from tools.rag_tool import EmptyChecklistError
    with pytest.raises(EmptyChecklistError):
        raise EmptyChecklistError("Test empty checklist")
