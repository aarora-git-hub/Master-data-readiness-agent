"""Unit tests for s4_tools.py"""

import pytest


def test_s4_read_business_partner_system_verified():
    from tools.s4_tools import s4_read_business_partner
    result = s4_read_business_partner.invoke({
        "step_id": "step_bp_001",
        "business_partner": "1000001",
    })
    assert result["step_id"] == "step_bp_001"
    assert result["status"] == "SYSTEM_VERIFIED"
    assert result["api_source"] == "API_BUSINESS_PARTNER"
    assert isinstance(result["missing_fields"], list)


def test_s4_read_material_system_verified():
    from tools.s4_tools import s4_read_material
    result = s4_read_material.invoke({
        "step_id": "step_mat_001",
        "material": "MAT001",
        "plant": "PLANT01",
    })
    assert result["step_id"] == "step_mat_001"
    assert result["status"] == "SYSTEM_VERIFIED"
    assert result["api_source"] == "API_PRODUCT_SRV"


def test_s4_read_plant_config_operational_table():
    from tools.s4_tools import s4_read_plant_config
    result = s4_read_plant_config.invoke({
        "step_id": "step_plant_001",
        "plant": "PLANT01",
        "table_name": "MARC",
    })
    assert result["step_id"] == "step_plant_001"
    assert result["table_category"] == "operational"
    assert result["api_source"] == "CE_PLANT_0001"


def test_s4_read_plant_config_transport_managed_table():
    from tools.s4_tools import s4_read_plant_config
    result = s4_read_plant_config.invoke({
        "step_id": "step_plant_002",
        "plant": "PLANT01",
        "table_name": "T001W",
    })
    assert result["table_category"] == "transport-managed"


def test_s4_read_plant_config_tvkwz_transport_managed():
    from tools.s4_tools import s4_read_plant_config
    result = s4_read_plant_config.invoke({
        "step_id": "step_tvkwz",
        "plant": "PLANT01",
        "table_name": "TVKWZ",
    })
    assert result["table_category"] == "transport-managed"


def test_s4_read_credit_management_system_verified():
    from tools.s4_tools import s4_read_credit_management
    result = s4_read_credit_management.invoke({
        "step_id": "step_credit_001",
        "business_partner": "1000001",
        "company_code": "1000",
    })
    assert result["step_id"] == "step_credit_001"
    assert result["status"] == "SYSTEM_VERIFIED"
    assert result["api_source"] == "API_CRDTMBUSINESSPARTNER"
