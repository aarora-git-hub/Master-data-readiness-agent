"""Unit tests for audit_tool.py"""

from unittest.mock import MagicMock, patch

import pytest


def _mock_audit_response():
    mock = MagicMock()
    mock.status_code = 201
    mock.raise_for_status = MagicMock()
    return mock


def test_audit_persist_event_checklist_retrieved():
    from tools.audit_tool import audit_persist_event
    with patch("tools.audit_tool.httpx.post", return_value=_mock_audit_response()) as mock_post:
        result = audit_persist_event.invoke({
            "object_id": "MAT001",
            "action_type": "CHECKLIST_RETRIEVED",
            "actor": "user123",
            "status": "SYSTEM_VERIFIED",
        })
    assert "event_id" in result
    assert "timestamp" in result
    mock_post.assert_called_once()


def test_audit_persist_event_write_executed():
    from tools.audit_tool import audit_persist_event
    with patch("tools.audit_tool.httpx.post", return_value=_mock_audit_response()):
        result = audit_persist_event.invoke({
            "object_id": "MAT001",
            "step_id": "step_001",
            "action_type": "WRITE_EXECUTED",
            "actor": "user123",
            "status": "WRITTEN_CONFIRMED",
            "field_values": {"Material": "MAT001", "Plant": "P001"},
        })
    assert "event_id" in result


def test_audit_persist_event_readiness_declared_is_immutable():
    from tools.audit_tool import audit_persist_event
    captured_payload = {}

    def capture_post(url, json=None, **kwargs):
        captured_payload.update(json or {})
        return _mock_audit_response()

    with patch("tools.audit_tool.httpx.post", side_effect=capture_post):
        audit_persist_event.invoke({
            "object_id": "MAT001",
            "action_type": "READINESS_DECLARED",
            "actor": "user123",
            "status": "READY",
        })

    assert captured_payload.get("isImmutable") is True


def test_audit_persist_event_invalid_action_type_raises():
    from tools.audit_tool import audit_persist_event
    with pytest.raises(ValueError, match="Invalid action_type"):
        audit_persist_event.invoke({
            "object_id": "MAT001",
            "action_type": "INVALID_TYPE",
            "actor": "user123",
            "status": "UNKNOWN",
        })


def test_audit_persist_event_service_failure_does_not_raise():
    """Audit service failures are logged but do not block the workflow."""
    from tools.audit_tool import audit_persist_event
    import httpx
    with patch("tools.audit_tool.httpx.post", side_effect=httpx.RequestError("Connection refused")):
        result = audit_persist_event.invoke({
            "object_id": "MAT001",
            "action_type": "STEP_VALIDATED",
            "actor": "user123",
            "status": "SYSTEM_VERIFIED",
        })
    # Should return a result with a warning, not raise
    assert "event_id" in result
    assert "warning" in result
