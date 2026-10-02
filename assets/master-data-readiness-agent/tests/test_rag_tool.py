"""Unit tests for rag_tool.py"""

import json
import os
from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def set_env(monkeypatch):
    monkeypatch.setenv("AICORE_RAG_TOKEN", "test-token")
    monkeypatch.setenv("AICORE_RAG_ENDPOINT", "https://mock-rag.example.com/completion")


def _mock_response(steps):
    mock = MagicMock()
    mock.status_code = 200
    mock.json.return_value = {"choices": [{"message": {"content": json.dumps(steps)}}]}
    mock.raise_for_status = MagicMock()
    return mock


def test_rag_retrieve_checklist_success():
    from tools.rag_tool import rag_retrieve_checklist

    mock_steps = [
        {"step_id": "s1", "step_name": "Check pricing condition", "persona": "PRICING_ANALYST",
         "step_type": "OPERATIONAL_TABLE", "dependency_ids": [], "description": "Verify A004 entry"}
    ]

    with patch("tools.rag_tool.httpx.post", return_value=_mock_response(mock_steps)):
        result = rag_retrieve_checklist.invoke({
            "object_type": "MATERIAL",
            "object_id": "MAT001",
            "persona": "PRICING_ANALYST",
        })

    assert result["object_id"] == "MAT001"
    assert result["step_count"] == 1
    assert result["steps"][0]["step_id"] == "s1"


def test_rag_retrieve_checklist_empty_response_raises():
    from tools.rag_tool import rag_retrieve_checklist, EmptyChecklistError

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"choices": [{"message": {"content": "[]"}}]}
    mock_resp.raise_for_status = MagicMock()

    with patch("tools.rag_tool.httpx.post", return_value=mock_resp):
        with pytest.raises(EmptyChecklistError):
            rag_retrieve_checklist.invoke({
                "object_type": "MATERIAL",
                "object_id": "MAT001",
                "persona": "PRICING_ANALYST",
            })


def test_rag_retrieve_checklist_auth_header():
    from tools.rag_tool import rag_retrieve_checklist

    mock_steps = [
        {"step_id": "s1", "step_name": "Test step", "persona": "PRICING_ANALYST",
         "step_type": "SPRO", "dependency_ids": [], "description": "Test"}
    ]

    captured_headers = {}

    def capture_post(url, json=None, headers=None, timeout=None):
        captured_headers.update(headers or {})
        return _mock_response(mock_steps)

    with patch("tools.rag_tool.httpx.post", side_effect=capture_post):
        rag_retrieve_checklist.invoke({
            "object_type": "PLANT",
            "object_id": "PLANT01",
            "persona": "LOGISTICS_COORDINATOR",
            "plant_type": "OWN",
        })

    assert captured_headers.get("Authorization") == "Bearer test-token"


def test_rag_missing_token_raises(monkeypatch):
    monkeypatch.delenv("AICORE_RAG_TOKEN", raising=False)
    from tools.rag_tool import rag_retrieve_checklist

    with pytest.raises(EnvironmentError, match="AICORE_RAG_TOKEN"):
        rag_retrieve_checklist.invoke({
            "object_type": "MATERIAL",
            "object_id": "MAT001",
            "persona": "PRICING_ANALYST",
        })


def test_rag_invalid_object_type_raises():
    from tools.rag_tool import rag_retrieve_checklist

    with pytest.raises(ValueError, match="Invalid object_type"):
        rag_retrieve_checklist.invoke({
            "object_type": "VENDOR",
            "object_id": "V001",
            "persona": "PRICING_ANALYST",
        })
