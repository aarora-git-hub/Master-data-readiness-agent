"""S/4HANA read tools — validate master data completeness via OData/CDS APIs.

NOTE: In production these tools are replaced by MCP server tool wrappers loaded via
get_mcp_tools(). The implementations here are used in local/test mode (IBD_TESTING=true)
and as documentation of the expected interface.
"""

import logging
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger(__name__)

TRANSPORT_MANAGED_TABLES = {"T001W", "TVKO", "TVKWZ", "TOVAK", "T001", "TSPAS"}
OPERATIONAL_TABLES = {"A004", "A005", "A006", "MARA", "MARC", "MVKE", "KNA1", "KNVV", "TSW_LOCATION"}


@tool
def s4_read_business_partner(
    step_id: str,
    business_partner: str,
    account_group: Optional[str] = None,
    sales_org: Optional[str] = None,
    distribution_channel: Optional[str] = None,
) -> dict:
    """Validate Business Partner / Customer master data completeness via API_BUSINESS_PARTNER OData.

    Checks: BP category, account group assignment, partner functions, payment terms.

    Args:
        step_id: The checklist step being validated.
        business_partner: Business Partner / Customer number.
        account_group: Expected account group (optional).
        sales_org: Sales organisation (optional).
        distribution_channel: Distribution channel (optional).

    Returns:
        dict with step_id, status (SYSTEM_VERIFIED/GAP_IDENTIFIED), verified_entity,
        api_source, missing_fields.
    """
    # In production this is replaced by the MCP server tool; mock response for local testing
    logger.info("Validating business partner %s for step %s", business_partner, step_id)
    return {
        "step_id": step_id,
        "status": "SYSTEM_VERIFIED",
        "verified_entity": f"BusinessPartner/{business_partner}",
        "api_source": "API_BUSINESS_PARTNER",
        "missing_fields": [],
    }


@tool
def s4_read_material(
    step_id: str,
    material: str,
    plant: Optional[str] = None,
    sales_org: Optional[str] = None,
    distribution_channel: Optional[str] = None,
) -> dict:
    """Validate material master view completeness via API_PRODUCT_SRV OData.

    Checks: Basic Data, Sales, Purchasing, MRP, Accounting, Costing views.

    Args:
        step_id: The checklist step being validated.
        material: Material number.
        plant: Plant code (optional, for plant-specific views).
        sales_org: Sales organisation (optional).
        distribution_channel: Distribution channel (optional).

    Returns:
        dict with step_id, status, verified_entity, api_source, missing_fields.
    """
    logger.info("Validating material %s for step %s", material, step_id)
    return {
        "step_id": step_id,
        "status": "SYSTEM_VERIFIED",
        "verified_entity": f"Product/{material}",
        "api_source": "API_PRODUCT_SRV",
        "missing_fields": [],
    }


@tool
def s4_read_plant_config(
    step_id: str,
    plant: str,
    table_name: str,
    company_code: Optional[str] = None,
    sales_org: Optional[str] = None,
) -> dict:
    """Read plant org assignments and standard SPRO config tables via CE_PLANT_0001 / released CDS views.

    Classifies each step:
    - Entry present → SYSTEM_VERIFIED
    - Entry missing, table operational → GAP_IDENTIFIED (operational)
    - Entry missing, table transport-managed → GAP_IDENTIFIED (TR required)
    - CDS view unavailable → NOT_VERIFIABLE

    Args:
        step_id: The checklist step being validated.
        plant: Plant code.
        table_name: Standard configuration table to check (e.g. T001W, TVKWZ).
        company_code: Company code (optional).
        sales_org: Sales organisation (optional).

    Returns:
        dict with step_id, status, table_name, table_category, missing_entry, api_source.
    """
    logger.info("Validating plant config table %s for plant %s step %s", table_name, plant, step_id)

    table_category = "transport-managed" if table_name in TRANSPORT_MANAGED_TABLES else "operational"

    return {
        "step_id": step_id,
        "status": "SYSTEM_VERIFIED",
        "table_name": table_name,
        "table_category": table_category,
        "missing_entry": None,
        "api_source": "CE_PLANT_0001",
    }


@tool
def s4_read_credit_management(
    step_id: str,
    business_partner: str,
    company_code: Optional[str] = None,
    credit_control_area: Optional[str] = None,
) -> dict:
    """Validate credit limit and risk class for new customer via API_CRDTMBUSINESSPARTNER OData.

    Args:
        step_id: The checklist step being validated.
        business_partner: Business Partner / Customer number.
        company_code: Company code (optional).
        credit_control_area: Credit control area (optional).

    Returns:
        dict with step_id, status, verified_entity, api_source, missing_fields.
    """
    logger.info("Validating credit management for BP %s step %s", business_partner, step_id)
    return {
        "step_id": step_id,
        "status": "SYSTEM_VERIFIED",
        "verified_entity": f"CreditManagement/BusinessPartner/{business_partner}",
        "api_source": "API_CRDTMBUSINESSPARTNER",
        "missing_fields": [],
    }
