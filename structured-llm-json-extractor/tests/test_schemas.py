"""
Unit tests for Pydantic v2 schemas: Invoice, LineItem, Resume, Education, Experience, Project.
Verifies validation logic, defaults, nullability, type conversions, and boundary conditions.
"""

import pytest
from pydantic import ValidationError
from src.schemas import (
    Invoice,
    LineItem,
    Resume,
    EducationItem,
    ExperienceItem,
    ProjectItem,
    get_schema_for_type,
)


class TestInvoiceSchemas:
    """Test suite for Invoice and LineItem validation."""

    def test_valid_line_item(self):
        item = LineItem(
            description="Cloud GPU Instance A100",
            quantity=2.0,
            unit_price=1200.0,
            amount=2400.0
        )
        assert item.description == "Cloud GPU Instance A100"
        assert item.quantity == 2.0
        assert item.unit_price == 1200.0
        assert item.amount == 2400.0

    def test_line_item_string_cleaning(self):
        """Should clean currency symbols and string commas into floats."""
        item = LineItem(
            description="Office Furniture",
            quantity="4",
            unit_price="$1,250.00",
            amount="€5,000.00"
        )
        assert item.quantity == 4.0
        assert item.unit_price == 1250.0
        assert item.amount == 5000.0

    def test_full_valid_invoice(self):
        invoice_data = {
            "invoice_number": "INV-2024-001",
            "invoice_date": "2024-10-15",
            "due_date": "2024-11-15",
            "vendor_name": "Datheon AI Inc.",
            "customer_name": "Acme Global",
            "currency": "USD",
            "subtotal": 1000.0,
            "tax": 82.5,
            "total": 1082.5,
            "line_items": [
                {
                    "description": "AI Pipeline Setup",
                    "quantity": 1,
                    "unit_price": 1000.0,
                    "amount": 1000.0
                }
            ],
            "payment_status": "Paid"
        }
        invoice = Invoice.model_validate(invoice_data)
        assert invoice.invoice_number == "INV-2024-001"
        assert invoice.currency == "USD"
        assert invoice.total == 1082.5
        assert len(invoice.line_items) == 1
        assert invoice.payment_status == "Paid"

    def test_invoice_currency_normalization(self):
        """Should normalize currency symbols into standard codes."""
        inv1 = Invoice(currency="$")
        assert inv1.currency == "USD"

        inv2 = Invoice(currency="€")
        assert inv2.currency == "EUR"

        inv3 = Invoice(currency="INR")
        assert inv3.currency == "INR"

    def test_invoice_with_missing_optional_fields(self):
        """Missing optional fields must safely default to None or empty list."""
        minimal_invoice = Invoice()
        assert minimal_invoice.invoice_number is None
        assert minimal_invoice.vendor_name is None
        assert minimal_invoice.line_items == []
        assert minimal_invoice.total is None

    def test_invalid_line_item_missing_required(self):
        """LineItem without description or unit_price must raise ValidationError."""
        with pytest.raises(ValidationError):
            LineItem.model_validate({"quantity": 1})


class TestResumeSchemas:
    """Test suite for Resume and child entity validation."""

    def test_valid_minimal_resume(self):
        resume = Resume(
            full_name="Alex Rivera",
            email="alex@example.com"
        )
        assert resume.full_name == "Alex Rivera"
        assert resume.email == "alex@example.com"
        assert resume.skills == []
        assert resume.education == []
        assert resume.experience == []

    def test_resume_email_normalization(self):
        """Email should be trimmed and lowercased."""
        resume = Resume(email="  USER.NAME@Domain.COM  ")
        assert resume.email == "user.name@domain.com"

    def test_full_valid_resume(self):
        resume_data = {
            "full_name": "Jordan Smith",
            "email": "jordan@example.com",
            "phone": "+1-555-1234",
            "location": "New York, NY",
            "skills": ["Python", "FastAPI", "Docker"],
            "education": [
                {
                    "degree": "B.S. Software Engineering",
                    "institution": "Columbia University",
                    "graduation_year": "2021"
                }
            ],
            "experience": [
                {
                    "job_title": "Backend Engineer",
                    "company": "Tech Corp",
                    "start_date": "2021",
                    "end_date": "Present",
                    "responsibilities": ["Maintained APIs", "Wrote unit tests"]
                }
            ],
            "certifications": ["AWS Cloud Practitioner"],
            "projects": [
                {
                    "title": "LLM Parser",
                    "description": "Document extractor",
                    "technologies": ["Python", "Pydantic"]
                }
            ]
        }
        resume = Resume.model_validate(resume_data)
        assert resume.full_name == "Jordan Smith"
        assert len(resume.skills) == 3
        assert len(resume.education) == 1
        assert resume.education[0].institution == "Columbia University"
        assert len(resume.experience) == 1
        assert resume.experience[0].responsibilities == ["Maintained APIs", "Wrote unit tests"]


class TestSchemaRegistry:
    """Test helper functions for schema lookup."""

    def test_schema_for_type_valid(self):
        assert get_schema_for_type("invoice") == Invoice
        assert get_schema_for_type("INVOICE") == Invoice
        assert get_schema_for_type("resume") == Resume
        assert get_schema_for_type("cv") == Resume

    def test_schema_for_type_invalid(self):
        with pytest.raises(ValueError) as excinfo:
            get_schema_for_type("unknown_document_type")
        assert "Unsupported document type" in str(excinfo.value)
