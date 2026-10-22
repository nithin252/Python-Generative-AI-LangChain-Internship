"""
End-to-end integration and unit tests for DocumentExtractor and LLM clients.
Tests mock extraction, repair workflows, prompt rendering, size limits, and CLI logic.
"""

import os
import json
import pytest
from src.extractor import DocumentExtractor, MAX_DOCUMENT_CHARS
from src.llm_client import BaseLLMClient, MockLLMClient, LLMClientError
from src.prompts import build_extraction_prompt, build_repair_prompt
from src.main import read_input_content, main


class FailingThenSucceedingMockClient(BaseLLMClient):
    """Simulates an LLM that produces bad JSON first, then corrects itself on repair."""
    def __init__(self):
        self.call_count = 0

    def generate_json(self, prompt: str, schema_dict=None) -> str:
        self.call_count += 1
        if self.call_count == 1:
            # Return invalid JSON with missing bracket
            return '{"invoice_number": "INV-TEST", "total": 100.0'
        # Return fixed JSON on second attempt
        return '{"invoice_number": "INV-TEST", "total": 100.0, "currency": "USD"}'


class ConstantErrorClient(BaseLLMClient):
    """Simulates an LLM provider throwing API / Network errors."""
    def generate_json(self, prompt: str, schema_dict=None) -> str:
        raise LLMClientError("Connection to AI gateway timed out (503 Service Unavailable)")


class TestDocumentExtractor:
    """Test suite for DocumentExtractor orchestration."""

    def test_mock_invoice_extraction(self):
        client = MockLLMClient()
        extractor = DocumentExtractor(llm_client=client)

        sample_doc = "Invoice from Acme Office Supplies for Apex Global. Total: $1623.75"
        result = extractor.extract(sample_doc, "invoice")

        assert result.success is True
        assert result.document_type == "invoice"
        assert result.data is not None
        assert result.data["invoice_number"].startswith("INV-")
        assert result.data["currency"] == "USD"
        assert result.data["total"] == 1623.75
        assert len(result.data["line_items"]) == 3
        assert result.attempts == 1

    def test_mock_resume_extraction(self):
        client = MockLLMClient()
        extractor = DocumentExtractor(llm_client=client)

        sample_doc = "Resume for Alex Rivera. Python, FastAPI, Docker, GCP. B.S. CS 2022."
        result = extractor.extract(sample_doc, "resume")

        assert result.success is True
        assert result.document_type == "resume"
        assert result.data is not None
        assert result.data["full_name"] == "Alex Rivera"
        assert "Python" in result.data["skills"]
        assert len(result.data["education"]) >= 1
        assert len(result.data["experience"]) >= 1

    def test_empty_document_rejection(self):
        client = MockLLMClient()
        extractor = DocumentExtractor(llm_client=client)

        result = extractor.extract("   \n\t  ", "invoice")
        assert result.success is False
        assert any("empty" in e.lower() for e in result.errors)

    def test_document_size_limit_rejection(self):
        client = MockLLMClient()
        extractor = DocumentExtractor(llm_client=client)

        giant_doc = "A" * (MAX_DOCUMENT_CHARS + 10)
        result = extractor.extract(giant_doc, "invoice")
        assert result.success is False
        assert any("safety threshold" in e.lower() for e in result.errors)

    def test_unsupported_document_type(self):
        client = MockLLMClient()
        extractor = DocumentExtractor(llm_client=client)

        result = extractor.extract("Some document content", "astrology_chart")
        assert result.success is False
        assert any("unsupported document type" in e.lower() for e in result.errors)

    def test_bounded_repair_loop_recovery(self):
        """Should attempt repair and succeed when client heals output."""
        repair_client = FailingThenSucceedingMockClient()
        extractor = DocumentExtractor(llm_client=repair_client, enable_repair=True)

        result = extractor.extract("Please invoice $100", "invoice")
        assert result.success is True
        assert result.attempts == 2
        assert result.repaired is True
        assert result.data["invoice_number"] == "INV-TEST"
        assert result.data["total"] == 100.0

    def test_provider_error_handling(self):
        """Should catch LLMClientError gracefully without crashing."""
        error_client = ConstantErrorClient()
        extractor = DocumentExtractor(llm_client=error_client)

        result = extractor.extract("Invoice text", "invoice")
        assert result.success is False
        assert any("LLM API Error" in e for e in result.errors)


class TestPromptPipeline:
    """Test suite for prompt generation and safety constraints."""

    def test_prompt_contains_security_boundary(self):
        prompt = build_extraction_prompt("invoice", "Dummy text")
        assert "<untrusted_document>" in prompt
        assert "</untrusted_document>" in prompt
        assert "Dummy text" in prompt
        assert "UNTRUSTED DATA BOUNDARY" in prompt

    def test_prompt_contains_few_shots(self):
        prompt = build_extraction_prompt("invoice", "Dummy text")
        assert "FEW-SHOT EXAMPLE 1" in prompt
        assert "FEW-SHOT EXAMPLE 2" in prompt
        assert "ACME Office Supplies" in prompt

    def test_prompt_contains_json_schema(self):
        prompt = build_extraction_prompt("invoice", "Dummy text")
        assert "EXPECTED JSON SCHEMA:" in prompt
        assert '"invoice_number"' in prompt

    def test_repair_prompt_structure(self):
        errors = ["Field 'total' is required", "Invalid JSON syntax"]
        prompt = build_repair_prompt("invoice", "{bad_json", errors)
        assert "VALIDATION ERRORS DETECTED:" in prompt
        assert "Field 'total' is required" in prompt
        assert "{bad_json" in prompt


class TestCliIntegration:
    """Test suite for command line utilities and file handlers."""

    def test_read_input_file_valid(self):
        content = read_input_content("examples/sample_invoice.txt")
        assert len(content) > 50
        assert "INVOICE" in content

    def test_read_input_file_not_found(self):
        with pytest.raises(FileNotFoundError):
            read_input_content("non_existent_file_12345.txt")

    def test_cli_mock_run_invoice(self, tmp_path):
        out_file = str(tmp_path / "cli_invoice_out.json")
        exit_code = main([
            "--input", "examples/sample_invoice.txt",
            "--type", "invoice",
            "--output", out_file,
            "--mock",
            "--pretty"
        ])
        assert exit_code == 0
        assert os.path.exists(out_file)

        with open(out_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert data["currency"] == "USD"
        assert len(data["line_items"]) > 0

    def test_cli_mock_run_resume(self, tmp_path):
        out_file = str(tmp_path / "cli_resume_out.json")
        exit_code = main([
            "--input", "examples/sample_resume.txt",
            "--type", "resume",
            "--output", out_file,
            "--mock",
            "--pretty"
        ])
        assert exit_code == 0
        assert os.path.exists(out_file)

        with open(out_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        assert data["full_name"] is not None
        assert len(data["skills"]) > 0
