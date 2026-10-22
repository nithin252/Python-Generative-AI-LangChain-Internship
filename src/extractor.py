"""
Core Extraction Engine.
Coordinates reading documents, rendering prompts, communicating with LLM clients,
parsing responses, executing Pydantic validation, and performing bounded repairs.
"""

import time
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
from pydantic import BaseModel

from src.schemas import get_schema_for_type
from src.prompts import build_extraction_prompt, build_repair_prompt
from src.llm_client import BaseLLMClient
from src.validators import clean_and_parse_json, validate_with_schema

logger = logging.getLogger("structured_extractor.extractor")


# Maximum allowed document input characters to protect against denial-of-service / token overflow
MAX_DOCUMENT_CHARS = 500_000


@dataclass
class ExtractionResult:
    """Represents the complete result of an extraction operation."""
    success: bool
    document_type: str
    data: Optional[Dict[str, Any]] = None
    validated_model: Optional[BaseModel] = None
    errors: List[str] = field(default_factory=list)
    raw_response: Optional[str] = None
    attempts: int = 1
    execution_time_seconds: float = 0.0
    provider: str = "gemini"
    repaired: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Convert result to serializable dictionary."""
        return {
            "success": self.success,
            "document_type": self.document_type,
            "data": self.data,
            "errors": self.errors,
            "attempts": self.attempts,
            "execution_time_seconds": round(self.execution_time_seconds, 3),
            "repaired": self.repaired,
        }


class DocumentExtractor:
    """
    Main extraction orchestrator.
    Handles prompt construction, provider calls, JSON parsing, validation, and repair loops.
    """

    def __init__(self, llm_client: BaseLLMClient, enable_repair: bool = True):
        self.client = llm_client
        self.enable_repair = enable_repair

    def extract(self, document_text: str, doc_type: str) -> ExtractionResult:
        """
        Execute the end-to-end extraction pipeline on the provided document text.

        Args:
            document_text: Raw text content from the source document.
            doc_type: Target document schema type ('invoice', 'resume').

        Returns:
            ExtractionResult object containing validated data or diagnostic errors.
        """
        start_time = time.time()
        logger.info("Beginning extraction pipeline for document type: '%s'", doc_type)

        # 1. Input sanitization & size limit check
        if not document_text or not document_text.strip():
            return ExtractionResult(
                success=False,
                document_type=doc_type,
                errors=["Input document is empty or contains only whitespace."],
                execution_time_seconds=time.time() - start_time
            )

        if len(document_text) > MAX_DOCUMENT_CHARS:
            return ExtractionResult(
                success=False,
                document_type=doc_type,
                errors=[
                    f"Document size exceeds safety threshold ({len(document_text)} > {MAX_DOCUMENT_CHARS} chars)."
                ],
                execution_time_seconds=time.time() - start_time
            )

        # 2. Verify schema exists
        try:
            get_schema_for_type(doc_type)
        except ValueError as e:
            return ExtractionResult(
                success=False,
                document_type=doc_type,
                errors=[str(e)],
                execution_time_seconds=time.time() - start_time
            )

        # 3. Construct prompt
        prompt = build_extraction_prompt(doc_type=doc_type, document_text=document_text)

        # 4. Invoke LLM Client
        attempts = 1
        raw_response = None
        try:
            raw_response = self.client.generate_json(prompt)
        except Exception as api_err:
            logger.error("LLM generation failed: %s", api_err)
            return ExtractionResult(
                success=False,
                document_type=doc_type,
                errors=[f"LLM API Error: {api_err}"],
                attempts=attempts,
                execution_time_seconds=time.time() - start_time
            )

        # 5. Clean & Parse JSON
        parsed_dict, parse_errors = clean_and_parse_json(raw_response)

        # 6. Validate with Pydantic Schema
        validated_model = None
        validation_errors: List[str] = []

        if parsed_dict is not None:
            validated_model, validation_errors = validate_with_schema(parsed_dict, doc_type)

        # 7. Bounded Repair Attempt (Max 1 retry if errors exist and repair is enabled)
        repaired = False
        all_errors = parse_errors + validation_errors

        if all_errors and self.enable_repair:
            attempts += 1
            logger.warning(
                "Initial extraction failed with %d error(s). Initiating bounded repair attempt...",
                len(all_errors)
            )

            repair_prompt = build_repair_prompt(
                doc_type=doc_type,
                raw_response=raw_response or "",
                validation_errors=all_errors
            )

            try:
                repaired_response = self.client.generate_json(repair_prompt)
                repaired_dict, repaired_parse_errors = clean_and_parse_json(repaired_response)

                if repaired_dict is not None:
                    repaired_model, repaired_val_errors = validate_with_schema(repaired_dict, doc_type)
                    if not repaired_val_errors:
                        logger.info("Extraction successfully recovered during bounded repair attempt!")
                        return ExtractionResult(
                            success=True,
                            document_type=doc_type,
                            data=repaired_model.model_dump(),
                            validated_model=repaired_model,
                            raw_response=repaired_response,
                            attempts=attempts,
                            execution_time_seconds=time.time() - start_time,
                            repaired=True
                        )
                    else:
                        all_errors = repaired_val_errors
                else:
                    all_errors.extend(repaired_parse_errors)
            except Exception as repair_err:
                logger.error("Repair attempt failed: %s", repair_err)
                all_errors.append(f"Repair attempt error: {repair_err}")

        # 8. Return final status
        is_success = validated_model is not None and not all_errors
        elapsed = time.time() - start_time

        if is_success:
            logger.info("Extraction completed successfully in %.2fs", elapsed)
            return ExtractionResult(
                success=True,
                document_type=doc_type,
                data=validated_model.model_dump(),
                validated_model=validated_model,
                raw_response=raw_response,
                attempts=attempts,
                execution_time_seconds=elapsed,
                repaired=repaired
            )
        else:
            logger.warning("Extraction validation failed after %d attempt(s): %s", attempts, all_errors)
            return ExtractionResult(
                success=False,
                document_type=doc_type,
                data=parsed_dict,
                errors=all_errors,
                raw_response=raw_response,
                attempts=attempts,
                execution_time_seconds=elapsed,
                repaired=repaired
            )
