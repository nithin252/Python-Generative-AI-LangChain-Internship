"""
Reusable LLM client abstraction supporting Google Gemini API via the official
google-genai SDK, along with an offline mock client and extensible OpenAI interface.
"""

import os
import time
import json
import re
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from dotenv import load_dotenv

# Configure module logger
logger = logging.getLogger("structured_extractor.llm_client")

# Load environment variables from .env
load_dotenv()


class LLMClientError(Exception):
    """Base exception for all LLM client failures."""
    pass


class AuthenticationError(LLMClientError):
    """Raised when API credentials are missing or invalid."""
    pass


class RateLimitError(LLMClientError):
    """Raised when provider rate limits are exceeded."""
    pass


class TransientProviderError(LLMClientError):
    """Raised on 5xx server errors, network dropouts, or timeouts."""
    pass


class BaseLLMClient(ABC):
    """Abstract base class for all LLM extraction providers."""

    @abstractmethod
    def generate_json(self, prompt: str, schema_dict: Optional[Dict[str, Any]] = None) -> str:
        """
        Send a prompt to the LLM and return the response text as a JSON string.
        
        Args:
            prompt: Formatted prompt string with instructions and document.
            schema_dict: Optional JSON schema dictionary for structured output.
            
        Returns:
            str: Raw JSON string returned by the provider.
        """
        pass


class GeminiLLMClient(BaseLLMClient):
    """
    Google Gemini client using the modern google-genai SDK.
    Supports structured output (response_mime_type="application/json").
    """

    DEFAULT_MODEL = "gemini-2.5-flash"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_retries: int = 3,
        timeout: int = 30
    ):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model or os.getenv("GEMINI_MODEL") or self.DEFAULT_MODEL
        self.max_retries = max(1, min(5, int(os.getenv("MAX_RETRIES", max_retries))))
        self.timeout = int(os.getenv("REQUEST_TIMEOUT_SECONDS", timeout))

        if not self.api_key or self.api_key.strip() in ["", "MY_GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE"]:
            raise AuthenticationError(
                "GEMINI_API_KEY is not set or contains a placeholder value. "
                "Please configure a valid key in your .env file or run with --mock for offline mode."
            )

        try:
            from google import genai
            from google.genai import types
            self._genai = genai
            self._types = types
            self._client = genai.Client(api_key=self.api_key)
            logger.info("Initialized GeminiLLMClient with model: %s", self.model)
        except ImportError as e:
            raise LLMClientError(
                "The 'google-genai' package is required. Install via: pip install google-genai"
            ) from e

    def generate_json(self, prompt: str, schema_dict: Optional[Dict[str, Any]] = None) -> str:
        """
        Call Gemini API with bounded exponential-backoff retries for transient errors.
        """
        last_exception = None

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug("Gemini API call attempt %d of %d (model: %s)", attempt, self.max_retries, self.model)

                # Configure structured JSON output mode
                config = self._types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.1,  # Low temperature for deterministic extraction
                )

                response = self._client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=config,
                )

                if not response or not response.text:
                    raise TransientProviderError("Gemini returned an empty text response.")

                return response.text.strip()

            except Exception as exc:
                err_str = str(exc).lower()
                last_exception = exc

                # Check for auth failure (401 / 403 / API_KEY_INVALID)
                if "api_key_invalid" in err_str or "unauthenticated" in err_str or "permission_denied" in err_str:
                    logger.error("Gemini Authentication failed: invalid or unauthorized API key.")
                    raise AuthenticationError("Gemini API authentication failed. Verify GEMINI_API_KEY in .env.") from exc

                # Check for Rate Limit (429 / RESOURCE_EXHAUSTED)
                if "429" in err_str or "resource_exhausted" in err_str or "quota" in err_str:
                    wait_time = 2 ** attempt
                    logger.warning("Rate limit encountered. Retrying in %ds (attempt %d/%d)...", wait_time, attempt, self.max_retries)
                    if attempt == self.max_retries:
                        raise RateLimitError("Gemini rate limit exceeded after maximum retries.") from exc
                    time.sleep(wait_time)
                    continue

                # Transient server errors (500, 503, connection timeouts)
                if any(k in err_str for k in ["500", "503", "unavailable", "timeout", "connection", "reset"]):
                    wait_time = 1.5 ** attempt
                    logger.warning("Transient error '%s'. Retrying in %.1fs...", exc, wait_time)
                    if attempt == self.max_retries:
                        raise TransientProviderError(f"Transient error persisted: {exc}") from exc
                    time.sleep(wait_time)
                    continue

                # Non-retryable error
                logger.error("Non-retryable Gemini API error: %s", exc)
                raise LLMClientError(f"Gemini API request failed: {exc}") from exc

        raise LLMClientError(f"Failed to generate JSON after {self.max_retries} attempts.") from last_exception


class MockLLMClient(BaseLLMClient):
    """
    Offline mock LLM client for testing and local demonstration without an API key.
    Inspects document text cues to generate realistic, schema-valid JSON responses.
    """

    def __init__(self, model: str = "mock-extractor-v1"):
        self.model = model
        logger.info("Initialized MockLLMClient for offline execution.")

    def generate_json(self, prompt: str, schema_dict: Optional[Dict[str, Any]] = None) -> str:
        """Simulate realistic extraction output based on prompt context."""
        # Extract target document text within untrusted_document tags if present
        doc_content = prompt
        doc_type_target = "invoice"
        if "<untrusted_document>" in prompt and "</untrusted_document>" in prompt:
            doc_content = prompt.split("<untrusted_document>")[-1].split("</untrusted_document>")[0]

        prompt_upper = prompt.upper()
        if "TARGET DOCUMENT TYPE: PROFESSIONAL RESUME" in prompt_upper or "RESUME" in prompt_upper.split("<UNTRUSTED_DOCUMENT>")[0]:
            doc_type_target = "resume"
        elif "TARGET DOCUMENT TYPE: COMMERCIAL INVOICE" in prompt_upper:
            doc_type_target = "invoice"
        elif "resume" in doc_content.lower() or "skills" in doc_content.lower() or "education" in doc_content.lower():
            doc_type_target = "resume"

        doc_lower = doc_content.lower()

        # Generate Resume response if target is resume
        if doc_type_target == "resume":
            name = "Alex Rivera"
            if "sarah lin" in doc_lower:
                name = "Sarah Lin"
            elif "david kumar" in doc_lower:
                name = "David Kumar"
            elif "jordan smith" in doc_lower:
                name = "Jordan Smith"

            sample_resume_response = {
                "full_name": name,
                "email": "alex.rivera.dev@gmail.com",
                "phone": "+1 (555) 382-9011",
                "location": "Austin, TX",
                "skills": [
                    "Python", "Pydantic", "FastAPI", "Docker", "PostgreSQL",
                    "Google GenAI SDK", "LangChain", "TypeScript", "React", "PyTest"
                ],
                "education": [
                    {
                        "degree": "B.S. in Computer Science",
                        "institution": "University of Texas at Austin",
                        "graduation_year": "2022",
                        "field_of_study": "Computer Science",
                        "gpa": "3.9 / 4.0"
                    }
                ],
                "experience": [
                    {
                        "job_title": "Senior AI Systems Engineer",
                        "company": "CognitiveFlow Inc.",
                        "start_date": "July 2022",
                        "end_date": "Present",
                        "location": "Austin, TX (Hybrid)",
                        "responsibilities": [
                            "Designed production document parsing pipeline handling 50k+ PDFs/month with 99.4% schema compliance.",
                            "Implemented few-shot prompt templates and Pydantic v2 validation guardrails for financial extracts.",
                            "Reduced end-to-end extraction latency from 4.2s to 1.1s via async streaming and token optimization."
                        ]
                    },
                    {
                        "job_title": "AI/Software Engineering Intern",
                        "company": "Datheon AI Labs",
                        "start_date": "May 2021",
                        "end_date": "August 2021",
                        "location": "Remote",
                        "responsibilities": [
                            "Built automated test suites and validation harnesses for structured LLM outputs.",
                            "Developed CLI utilities and interactive dashboards for model benchmark comparisons."
                        ]
                    }
                ],
                "certifications": [
                    "Google Cloud Certified Professional Cloud Architect",
                    "DeepLearning.AI Generative AI for Software Engineers"
                ],
                "projects": [
                    {
                        "title": "Structured LLM Prompt Pipeline & JSON Extractor",
                        "description": "Production-grade document extraction framework with few-shot prompting, schema repair, and Pydantic v2 validation.",
                        "technologies": ["Python 3.11", "Google GenAI SDK", "Pydantic v2", "PyTest"],
                        "link": "github.com/datheon/structured-llm-extractor"
                    }
                ]
            }
            return json.dumps(sample_resume_response)

        # Generate Invoice response if target is invoice
        import re
        vendor = "Acme Cloud Services Ltd."
        if "acme" in doc_lower:
            vendor = "Acme Cloud Services Ltd."
        elif "cloudnexus" in doc_lower:
            vendor = "CLOUDNEXUS HOSTING SOLUTIONS"

        inv_match = re.search(r"inv-[\w-]+", doc_lower)
        inv_num = inv_match.group(0).upper() if inv_match else "INV-2024-9102"

        total_val = 2040.51
        total_match = re.search(r"total[^\d\n\r]*([\d,]+\.?\d*)", doc_lower)
        if total_match:
            try:
                total_val = float(total_match.group(1).replace(",", ""))
            except ValueError:
                pass

        sample_invoice_response = {
            "invoice_number": inv_num,
            "invoice_date": "2024-10-18",
            "due_date": "2024-11-17",
            "vendor_name": vendor,
            "customer_name": "Global Logistics Solutions Inc.",
            "currency": "USD",
            "subtotal": round(total_val * 0.9, 2) if total_val else 1885.00,
            "tax": round(total_val * 0.1, 2) if total_val else 155.51,
            "total": total_val,
            "line_items": [
                {
                    "description": "Dedicated GPU Cloud Cluster (A100 x 4) - Oct",
                    "quantity": 1.0,
                    "unit_price": 1200.00,
                    "amount": 1200.00
                },
                {
                    "description": "High-Throughput Managed PostgreSQL (500 GB)",
                    "quantity": 2.0,
                    "unit_price": 150.00,
                    "amount": 300.00
                },
                {
                    "description": "Outbound CDN Bandwidth Overage (TB)",
                    "quantity": 3.0,
                    "unit_price": 45.00,
                    "amount": 135.00
                }
            ],
            "payment_status": "Pending"
        }
        return json.dumps(sample_invoice_response)


class OpenAILLMClient(BaseLLMClient):
    """
    Optional OpenAI provider interface (requires 'openai' package and OPENAI_API_KEY).
    Allows easy extension when an OpenAI API key is supplied.
    """

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini"):
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        if not self.api_key:
            raise AuthenticationError("OPENAI_API_KEY is required for OpenAI provider.")
        try:
            import openai
            self._client = openai.OpenAI(api_key=self.api_key)
        except ImportError as e:
            raise LLMClientError("The 'openai' package is required. Install via: pip install openai") from e

    def generate_json(self, prompt: str, schema_dict: Optional[Dict[str, Any]] = None) -> str:
        response = self._client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1,
        )
        return response.choices[0].message.content or "{}"


def get_llm_client(
    provider: str = "gemini",
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    mock: bool = False
) -> BaseLLMClient:
    """
    Factory function to instantiate the appropriate LLM client.
    """
    provider_clean = (provider or os.getenv("LLM_PROVIDER", "gemini")).strip().lower()

    if mock or provider_clean == "mock":
        return MockLLMClient(model=model or "mock-extractor-v1")

    if provider_clean == "gemini":
        return GeminiLLMClient(api_key=api_key, model=model)

    if provider_clean in ["openai", "gpt"]:
        return OpenAILLMClient(api_key=api_key, model=model or "gpt-4o-mini")

    raise ValueError(f"Unsupported LLM provider '{provider}'. Supported options: 'gemini', 'mock', 'openai'.")
