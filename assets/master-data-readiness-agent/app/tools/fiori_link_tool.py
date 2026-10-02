"""Fiori Link Tool — resolves Fiori deep links for standard operational table gaps."""

import json
import logging
import os
from pathlib import Path
from typing import Optional
from urllib.parse import urlencode

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

# Path to the Fiori link map — loaded from the checklist-orchestration skill
_FIORI_MAP_PATH = Path(__file__).parent.parent / "skills" / "checklist-orchestration" / "references" / "fiori-link-map.json"
_fiori_map_cache: Optional[dict] = None


def _load_fiori_map() -> dict:
    global _fiori_map_cache
    if _fiori_map_cache is None:
        with open(_FIORI_MAP_PATH) as f:
            _fiori_map_cache = json.load(f)
    return _fiori_map_cache


def _build_fiori_url(semantic_object: str, action: str, context_params: list, object_context: dict) -> str:
    """Construct a Fiori intent-based navigation URL."""
    base = "#" + semantic_object + "-" + action
    params = {k: v for k, v in object_context.items() if k in context_params and v}
    if params:
        base += "?" + urlencode(params)
    return base


@tool
def s4_resolve_fiori_link(
    table_name: str,
    object_context: dict,
) -> dict:
    """Resolve a Fiori deep link or transaction code fallback for a standard table gap.

    Looks up the table in the fiori-link-map.json skill resource and constructs
    a pre-filled Fiori intent-based navigation URL (or transaction code fallback).

    Args:
        table_name: Standard SAP table name (e.g. A004, TVKWZ, T001W).
        object_context: Dict of context values (plant, company_code, sales_org,
                        material, business_partner, etc.).

    Returns:
        dict with table_name, table_category, fiori_url (or None),
        transaction_code (or None), tr_instruction (for transport-managed tables).
    """
    fiori_map = _load_fiori_map()
    tables = fiori_map.get("tables", {})

    table_entry = tables.get(table_name.upper())
    if not table_entry:
        logger.warning("Table %s not found in fiori-link-map.json — returning transaction code fallback", table_name)
        return {
            "table_name": table_name,
            "table_category": "unknown",
            "fiori_url": None,
            "transaction_code": None,
            "tr_instruction": f"Table {table_name} not found in the Fiori link map. Consult your SAP administrator.",
        }

    table_category = table_entry.get("tableCategory", "operational")
    semantic_object = table_entry.get("fioriSemanticObject")
    fiori_action = table_entry.get("fioriAction")
    context_params = table_entry.get("contextParams", [])
    transaction_code = table_entry.get("transactionCode")
    tr_instruction = table_entry.get("trInstruction")

    fiori_url = None
    if table_category == "operational" and semantic_object and fiori_action:
        fiori_url = _build_fiori_url(semantic_object, fiori_action, context_params, object_context)

    return {
        "table_name": table_name,
        "table_category": table_category,
        "fiori_url": fiori_url,
        "transaction_code": transaction_code,
        "tr_instruction": tr_instruction,
        "description": table_entry.get("description", ""),
    }
