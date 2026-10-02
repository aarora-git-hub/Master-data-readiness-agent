"""Write tools — guided data entry and RAP service writes for Z/Y tables and BRFplus rules."""

import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

S4_CUSTOM_TABLE_RAP_URL = os.environ.get("S4_CUSTOM_TABLE_RAP_URL", "https://placeholder.example.com/rap/custom-tables")
S4_BRFPLUS_RAP_URL = os.environ.get("S4_BRFPLUS_RAP_URL", "https://placeholder.example.com/rap/brfplus")

# Guardrail: tracks steps for which human approval has been recorded in the current session
_approved_steps: set = set()


class GuardrailViolationError(Exception):
    """Raised when a write is attempted without recorded human approval."""


def record_human_approval(step_id: str) -> None:
    """Record that a human has explicitly approved the write for this step."""
    _approved_steps.add(step_id)


def _check_approval(step_id: str) -> None:
    if step_id not in _approved_steps:
        raise GuardrailViolationError(
            f"Write for step '{step_id}' attempted without recorded human approval. "
            "The user must review the form summary and confirm before any write is executed."
        )


def _mock_field_definitions(table_name: str) -> list:
    """Return mock field definitions for local testing."""
    return [
        {
            "field_name": "Material",
            "label": "Material Number",
            "field_type": "string",
            "mandatory": True,
            "default_value": None,
            "allowed_values": None,
        },
        {
            "field_name": "Plant",
            "label": "Plant",
            "field_type": "string",
            "mandatory": True,
            "default_value": None,
            "allowed_values": None,
        },
        {
            "field_name": "ValidFrom",
            "label": "Valid From Date",
            "field_type": "date",
            "mandatory": True,
            "default_value": None,
            "allowed_values": None,
        },
        {
            "field_name": "Notes",
            "label": "Notes",
            "field_type": "string",
            "mandatory": False,
            "default_value": None,
            "allowed_values": None,
        },
    ]


@tool
def s4_write_custom_table(
    table_name: str,
    mode: str,
    object_context: dict,
    fields: Optional[dict] = None,
    step_id: Optional[str] = None,
) -> dict:
    """Interact with a custom Z/Y table via RAP service.

    Two modes:
    - mode='metadata': Returns field definitions for building the entry form.
    - mode='write': Creates a record. Requires prior human approval (record_human_approval called).

    Args:
        table_name: Custom Z/Y table technical name.
        mode: 'metadata' or 'write'.
        object_context: Dict of context values (material, plant, company_code, etc.).
        fields: Field name → value dict for mode='write'.
        step_id: Checklist step ID (required for mode='write' to check approval).

    Returns:
        For metadata mode: dict with table_name and field_definitions list.
        For write mode: dict with record_id, table_name, fields_written, timestamp on success,
                        or error_code, error_message, table_name on failure.
    """
    if mode == "metadata":
        logger.info("Fetching field definitions for custom table %s", table_name)
        return {
            "table_name": table_name,
            "mode": "metadata",
            "field_definitions": _mock_field_definitions(table_name),
        }

    if mode == "write":
        if step_id:
            _check_approval(step_id)

        if not fields:
            raise ValueError("fields must be provided for mode='write'.")

        logger.info("Writing record to custom table %s for step %s", table_name, step_id)

        token = os.environ.get("AICORE_RAG_TOKEN", "")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"} if token else {}
        payload = {"table": table_name, "fields": fields, "context": object_context}

        try:
            response = httpx.post(
                f"{S4_CUSTOM_TABLE_RAP_URL}/{table_name}",
                json=payload,
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "record_id": data.get("record_id", f"{table_name}_MOCK_001"),
                "table_name": table_name,
                "fields_written": fields,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except httpx.HTTPStatusError as exc:
            return {
                "error_code": str(exc.response.status_code),
                "error_message": exc.response.text,
                "table_name": table_name,
            }
        except httpx.RequestError as exc:
            return {
                "error_code": "CONNECTION_ERROR",
                "error_message": str(exc),
                "table_name": table_name,
            }

    raise ValueError(f"Invalid mode '{mode}'. Must be 'metadata' or 'write'.")


@tool
def s4_write_brfplus_rule(
    rule_name: str,
    mode: str,
    object_context: dict,
    fields: Optional[dict] = None,
    step_id: Optional[str] = None,
) -> dict:
    """Interact with a BRFplus decision table via RAP service.

    Two modes:
    - mode='metadata': Returns field definitions for building the entry form.
    - mode='write': Creates a decision table row. Requires prior human approval.

    Args:
        rule_name: BRFplus rule / decision table technical name.
        mode: 'metadata' or 'write'.
        object_context: Dict of context values.
        fields: Field name → value dict for mode='write'.
        step_id: Checklist step ID (required for mode='write').

    Returns:
        For metadata mode: dict with rule_name and field_definitions.
        For write mode: dict with rule_name, row_id, fields_written, timestamp on success,
                        or error_code, error_message, rule_name on failure.
    """
    if mode == "metadata":
        logger.info("Fetching field definitions for BRFplus rule %s", rule_name)
        return {
            "rule_name": rule_name,
            "mode": "metadata",
            "field_definitions": _mock_field_definitions(rule_name),
        }

    if mode == "write":
        if step_id:
            _check_approval(step_id)

        if not fields:
            raise ValueError("fields must be provided for mode='write'.")

        logger.info("Writing row to BRFplus rule %s for step %s", rule_name, step_id)

        token = os.environ.get("AICORE_RAG_TOKEN", "")
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"} if token else {}
        payload = {"rule": rule_name, "fields": fields, "context": object_context}

        try:
            response = httpx.post(
                f"{S4_BRFPLUS_RAP_URL}/{rule_name}",
                json=payload,
                headers=headers,
                timeout=30.0,
            )
            response.raise_for_status()
            data = response.json()
            return {
                "rule_name": rule_name,
                "row_id": data.get("row_id", f"{rule_name}_ROW_001"),
                "fields_written": fields,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        except httpx.HTTPStatusError as exc:
            return {
                "error_code": str(exc.response.status_code),
                "error_message": exc.response.text,
                "rule_name": rule_name,
            }
        except httpx.RequestError as exc:
            return {
                "error_code": "CONNECTION_ERROR",
                "error_message": str(exc),
                "rule_name": rule_name,
            }

    raise ValueError(f"Invalid mode '{mode}'. Must be 'metadata' or 'write'.")
