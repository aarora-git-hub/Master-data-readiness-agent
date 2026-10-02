"""RAG Tool — retrieves grounded setup checklists from AI Core Document Grounding endpoint."""

import json
import logging
import os
from typing import Optional

import httpx
from langchain_core.tools import tool

logger = logging.getLogger(__name__)

RAG_ENDPOINT = os.environ.get(
    "AICORE_RAG_ENDPOINT",
    "https://api.ai.intprod-eu12.eu-central-1.aws.ml.hana.ondemand.com/v2/inference/deployments/db116ec41033908a/completion",
)

VALID_OBJECT_TYPES = {"MATERIAL", "PLANT", "CUSTOMER_BP"}
VALID_PERSONAS = {
    "PRICING_ANALYST",
    "LOGISTICS_COORDINATOR",
    "CONTRACT_ADMIN",
    "ACCOUNTING_CONTROLLING",
    "GOVERNANCE_OWNER",
}
VALID_PLANT_TYPES = {"OWN", "THIRD_PARTY", "IN_TRANSIT"}


class EmptyChecklistError(Exception):
    """Raised when the RAG endpoint returns an empty or unparseable checklist."""


def _build_user_query(
    object_type: str,
    object_id: str,
    persona: str,
    plant_type: Optional[str] = None,
    material_type: Optional[str] = None,
    account_group: Optional[str] = None,
) -> str:
    parts = [
        f"Provide the operational readiness setup checklist for a newly created {object_type} with ID {object_id}.",
        f"Target persona: {persona}.",
    ]
    if plant_type:
        parts.append(f"Plant type: {plant_type}.")
    if material_type:
        parts.append(f"Material type: {material_type}.")
    if account_group:
        parts.append(f"Customer account group: {account_group}.")
    parts.append(
        "Return a structured list of setup steps including step_id, step_name, persona, "
        "step_type (CUSTOM_TABLE/BRFPLUS/OPERATIONAL_TABLE/CONFIG_TABLE/SPRO), "
        "dependency_ids, and description."
    )
    return " ".join(parts)


def _parse_checklist_response(raw_response: dict) -> list:
    """Parse the RAG endpoint response into a structured checklist."""
    # Try to extract content from standard completion response format
    choices = raw_response.get("choices", [])
    if choices:
        content = choices[0].get("message", {}).get("content", "")
        if content:
            # Attempt to parse JSON from content
            try:
                parsed = json.loads(content)
                if isinstance(parsed, list):
                    return parsed
                if isinstance(parsed, dict) and "steps" in parsed:
                    return parsed["steps"]
            except json.JSONDecodeError:
                pass
            # Return as single text step if not JSON
            return [
                {
                    "step_id": "step_001",
                    "step_name": "Review setup requirements",
                    "persona": "ALL",
                    "step_type": "SPRO",
                    "dependency_ids": [],
                    "description": content,
                }
            ]

    # Try direct list format
    if isinstance(raw_response, list):
        return raw_response

    raise EmptyChecklistError("RAG endpoint returned an unrecognised response format.")


@tool
def rag_retrieve_checklist(
    object_type: str,
    object_id: str,
    persona: str,
    plant_type: Optional[str] = None,
    material_type: Optional[str] = None,
    account_group: Optional[str] = None,
) -> dict:
    """Retrieve a persona- and context-specific operational readiness setup checklist
    from the AI Core Document Grounding endpoint.

    Args:
        object_type: Type of master data object — MATERIAL, PLANT, or CUSTOMER_BP.
        object_id: The SAP object identifier (material number, plant code, or BP number).
        persona: Target persona — PRICING_ANALYST, LOGISTICS_COORDINATOR, CONTRACT_ADMIN,
                 ACCOUNTING_CONTROLLING, or GOVERNANCE_OWNER.
        plant_type: Plant type for PLANT objects — OWN, THIRD_PARTY, or IN_TRANSIT.
        material_type: Material type code for MATERIAL objects (e.g. FERT, ROH).
        account_group: Customer account group for CUSTOMER_BP objects.

    Returns:
        dict with keys: object_id, object_type, persona, steps (list of step dicts).
    """
    if object_type not in VALID_OBJECT_TYPES:
        raise ValueError(f"Invalid object_type '{object_type}'. Must be one of {VALID_OBJECT_TYPES}.")
    if persona not in VALID_PERSONAS:
        raise ValueError(f"Invalid persona '{persona}'. Must be one of {VALID_PERSONAS}.")
    if plant_type and plant_type not in VALID_PLANT_TYPES:
        raise ValueError(f"Invalid plant_type '{plant_type}'. Must be one of {VALID_PLANT_TYPES}.")

    token = os.environ.get("AICORE_RAG_TOKEN", "")
    if not token:
        raise EnvironmentError("AICORE_RAG_TOKEN environment variable is not set.")

    user_query = _build_user_query(
        object_type=object_type,
        object_id=object_id,
        persona=persona,
        plant_type=plant_type,
        material_type=material_type,
        account_group=account_group,
    )

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {"user_query": user_query}

    logger.info("Calling RAG endpoint for object=%s type=%s persona=%s", object_id, object_type, persona)

    try:
        response = httpx.post(RAG_ENDPOINT, json=payload, headers=headers, timeout=30.0)
        response.raise_for_status()
        raw = response.json()
    except httpx.TimeoutException as exc:
        raise EmptyChecklistError(f"RAG endpoint timed out after 30 seconds: {exc}") from exc
    except httpx.HTTPStatusError as exc:
        raise EmptyChecklistError(
            f"RAG endpoint returned HTTP {exc.response.status_code}: {exc.response.text}"
        ) from exc

    steps = _parse_checklist_response(raw)

    if not steps:
        raise EmptyChecklistError(
            f"RAG endpoint returned an empty checklist for object={object_id} type={object_type}. "
            "Cannot proceed without a grounded checklist."
        )

    logger.info(
        "[M1.achieved]: checklist retrieved for object=%s type=%s persona=%s steps=%d",
        object_id, object_type, persona, len(steps),
    )

    return {
        "object_id": object_id,
        "object_type": object_type,
        "persona": persona,
        "steps": steps,
        "step_count": len(steps),
    }
