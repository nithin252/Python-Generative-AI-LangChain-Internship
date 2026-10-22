"""
Unit tests for JSON parsing, markdown fence stripping, and Pydantic validator functions.
"""

from src.validators import (
    clean_and_parse_json,
    validate_with_schema,
    format_validation_report
)


class TestJsonCleaning:
    """Test JSON cleaning and error recovery."""

    def test_clean_standard_json(self):
        raw = '{"invoice_number": "INV-100", "total": 500.0}'
        data, errors = clean_and_parse_json(raw)
        assert errors == []
        assert data == {"invoice_number": "INV-100", "total": 500.0}

    def test_clean_markdown_fence_with_json_tag(self):
        raw = """```json
{
  "full_name": "Alice Wonderland",
  "skills": ["Python", "Docker"]
}
```"""
        data, errors = clean_and_parse_json(raw)
        assert errors == []
        assert data["full_name"] == "Alice Wonderland"
        assert data["skills"] == ["Python", "Docker"]

    def test_clean_markdown_fence_without_tag(self):
        raw = """```
{
  "vendor_name": "Supplier Inc."
}
```"""
        data, errors = clean_and_parse_json(raw)
        assert errors == []
        assert data["vendor_name"] == "Supplier Inc."

    def test_clean_with_conversational_text_around_json(self):
        raw = """Here is the extracted invoice data you requested:
{
  "invoice_number": "INV-777",
  "currency": "USD"
}
Hope this helps!"""
        data, errors = clean_and_parse_json(raw)
        assert errors == []
        assert data["invoice_number"] == "INV-777"
        assert data["currency"] == "USD"

    def test_clean_with_trailing_commas(self):
        raw = '{"name": "Test", "items": [1, 2, ], }'
        data, errors = clean_and_parse_json(raw)
        assert errors == []
        assert data["name"] == "Test"
        assert data["items"] == [1, 2]

    def test_empty_or_whitespace_input(self):
        data, errors = clean_and_parse_json("   \n\t  ")
        assert data is None
        assert len(errors) > 0
        assert "empty" in errors[0].lower()

    def test_completely_invalid_json(self):
        raw = "This is not JSON at all."
        data, errors = clean_and_parse_json(raw)
        assert data is None
        assert len(errors) > 0


class TestSchemaValidation:
    """Test schema validation errors and reporting."""

    def test_validation_success_invoice(self):
        payload = {"invoice_number": "INV-123", "vendor_name": "Acme"}
        model, errors = validate_with_schema(payload, "invoice")
        assert errors == []
        assert model is not None
        assert model.invoice_number == "INV-123"

    def test_validation_failure_invalid_line_item(self):
        # LineItem missing required 'description'
        payload = {
            "invoice_number": "INV-123",
            "line_items": [{"quantity": 2, "unit_price": 50}]
        }
        model, errors = validate_with_schema(payload, "invoice")
        assert model is None
        assert len(errors) > 0
        assert any("line_items" in e for e in errors)

    def test_format_validation_report(self):
        errors = ["Field 'total': must be a float", "Field 'vendor_name': required"]
        report = format_validation_report(errors)
        assert "Found 2 validation failure(s):" in report
        assert "Field 'total'" in report
        assert "Field 'vendor_name'" in report

    def test_unsupported_document_type(self):
        model, errors = validate_with_schema({}, "nonexistent_type")
        assert model is None
        assert len(errors) == 1
        assert "Unsupported document type" in errors[0]
