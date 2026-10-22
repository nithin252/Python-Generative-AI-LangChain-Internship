"""
Validation engine and JSON cleaning utilities.
Ensures raw LLM output is stripped of formatting anomalies and strictly validated
against target Pydantic schemas.
"""

import json
import re
import logging
from typing import Tuple, List, Optional, Dict, Any
from pydantic import ValidationError, BaseModel
from src.schemas import get_schema_for_type

logger = logging.getLogger("structured_extractor.validators")


def clean_and_parse_json(raw_text: str) -> Tuple[Optional[Dict[str, Any]], List[str]]:
    """
    Cleans common LLM formatting artifacts (markdown fences, conversational text)
    and parses into a Python dictionary.

    Args:
        raw_text: Raw string returned from LLM.

    Returns:
        Tuple of (parsed_dict, list_of_errors). If failed, parsed_dict is None.
    """
    errors: List[str] = []
    if not raw_text or not raw_text.strip():
        return None, ["Received empty or whitespace-only response from LLM."]

    cleaned = raw_text.strip()

    # Strip markdown code blocks (e.g. ```json ... ``` or ``` ...)
    if "```" in cleaned:
        logger.debug("Stripping markdown backticks from model output.")
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if match:
            cleaned = match.group(1).strip()
        else:
            # Fallback regex strip
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.MULTILINE)
            cleaned = re.sub(r"```$", "", cleaned, flags=re.MULTILINE).strip()

    # Attempt 1: Direct JSON parsing
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data, []
        return None, [f"Expected JSON object (dictionary), but received JSON {type(data).__name__}."]
    except json.JSONDecodeError as direct_err:
        errors.append(f"Direct JSON parse failed: {direct_err.msg} at line {direct_err.lineno}, col {direct_err.colno}")

    # Attempt 2: Locate first '{' and last '}'
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        candidate = cleaned[start_idx : end_idx + 1]
        try:
            data = json.loads(candidate)
            if isinstance(data, dict):
                logger.info("Successfully recovered JSON object using curly brace extraction.")
                return data, []
        except json.JSONDecodeError as candidate_err:
            errors.append(f"Sub-block JSON parse failed: {candidate_err.msg}")

    # Attempt 3: Trailing comma fixer
    fixed_commas = re.sub(r",\s*([}\]])", r"\1", cleaned)
    try:
        data = json.loads(fixed_commas)
        if isinstance(data, dict):
            logger.info("Successfully recovered JSON object after stripping trailing commas.")
            return data, []
    except json.JSONDecodeError:
        pass

    return None, errors


def validate_with_schema(data: Dict[str, Any], doc_type: str) -> Tuple[Optional[BaseModel], List[str]]:
    """
    Validates a parsed dictionary against the Pydantic schema for the specified document type.

    Args:
        data: Parsed dictionary data.
        doc_type: Document type name ('invoice', 'resume', etc.).

    Returns:
        Tuple of (validated_pydantic_instance, list_of_error_messages).
    """
    try:
        schema_cls = get_schema_for_type(doc_type)
    except ValueError as ve:
        return None, [str(ve)]

    try:
        validated_instance = schema_cls.model_validate(data)
        return validated_instance, []
    except ValidationError as val_err:
        formatted_errors: List[str] = []
        for err in val_err.errors():
            loc = " -> ".join(str(elem) for elem in err.get("loc", []))
            msg = err.get("msg", "Validation error")
            err_type = err.get("type", "value_error")
            formatted_errors.append(f"Field '{loc}': {msg} (error type: {err_type})")
        return None, formatted_errors


def format_validation_report(errors: List[str]) -> str:
    """Format a list of error strings into a human-readable diagnostic report."""
    if not errors:
        return "Validation passed without errors."
    header = f"Found {len(errors)} validation failure(s):"
    bullet_points = "\n".join(f"  • {e}" for e in errors)
    return f"{header}\n{bullet_points}"
