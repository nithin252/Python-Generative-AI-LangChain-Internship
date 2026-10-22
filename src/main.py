"""
Command-Line Interface for the Structured LLM Prompt Pipeline & JSON Extractor.
Parses CLI arguments, configures logging, reads documents, runs extraction,
and formats or writes validated JSON output.
"""

import sys
import os
import json
import logging
import argparse
from typing import Optional

from src.llm_client import get_llm_client, AuthenticationError, LLMClientError
from src.extractor import DocumentExtractor
from src.schemas import SCHEMA_MAP


def setup_logging(verbose: bool = False):
    """Configure stdout logging level and format."""
    level = logging.DEBUG if verbose else logging.INFO
    format_str = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
    logging.basicConfig(level=level, format=format_str, datefmt="%H:%M:%S")


def build_parser() -> argparse.ArgumentParser:
    """Build and configure the CLI argument parser."""
    parser = argparse.ArgumentParser(
        prog="structured-llm-json-extractor",
        description=(
            "Extract structured, strictly validated JSON from unstructured documents "
            "(invoices, resumes, receipts) using Google Gemini LLM and Pydantic v2."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Extract invoice with default Gemini provider:
  python run.py --input examples/sample_invoice.txt --type invoice --output outputs/invoice.json

  # Extract resume in formatted (pretty) JSON:
  python run.py --input examples/sample_resume.txt --type resume --output outputs/resume.json --pretty

  # Run offline mock mode without requiring an API key:
  python run.py --input examples/sample_invoice.txt --type invoice --mock --pretty

  # Read from stdin and output to stdout:
  cat examples/sample_invoice.txt | python run.py --type invoice --pretty
"""
    )

    parser.add_argument(
        "-i", "--input",
        type=str,
        default=None,
        help="Path to the input text document. Use '-' or omit to read from standard input."
    )

    parser.add_argument(
        "-t", "--type",
        type=str,
        required=True,
        choices=list(SCHEMA_MAP.keys()),
        help=f"Target document schema type. Choices: {', '.join(sorted(SCHEMA_MAP.keys()))}"
    )

    parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Path to write the extracted JSON output. If omitted, prints to standard output."
    )

    parser.add_argument(
        "-p", "--pretty",
        action="store_true",
        help="Format JSON output with 2-space indentation."
    )

    parser.add_argument(
        "--provider",
        type=str,
        default="gemini",
        choices=["gemini", "mock", "openai"],
        help="LLM provider (default: 'gemini')."
    )

    parser.add_argument(
        "--model",
        type=str,
        default=None,
        help="Override model name (e.g. 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3.8-flash')."
    )

    parser.add_argument(
        "--mock",
        action="store_true",
        help="Run in offline mock mode without making live API calls (ideal for CI/CD and testing)."
    )

    parser.add_argument(
        "--no-repair",
        action="store_true",
        help="Disable bounded 1-step repair attempt on initial validation failure."
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable detailed debug logging."
    )

    return parser


def read_input_content(input_path: Optional[str]) -> str:
    """Read content from file or standard input."""
    if not input_path or input_path == "-":
        if sys.stdin.isatty():
            raise ValueError(
                "No input file specified and no piped standard input detected. "
                "Specify --input <file_path> or pipe content into stdin."
            )
        return sys.stdin.read()

    if not os.path.exists(input_path):
        raise FileNotFoundError(f"Input file not found at: '{input_path}'")

    if not os.path.isfile(input_path):
        raise ValueError(f"Path is not a regular file: '{input_path}'")

    with open(input_path, "r", encoding="utf-8", errors="replace") as f:
        return f.read()


def main(args_list: Optional[list] = None) -> int:
    """
    Main entry point for command-line execution.
    Returns exit code (0: success, 1: validation error, 2: file/arg error, 3: API error).
    """
    parser = build_parser()
    args = parser.parse_args(args_list)

    setup_logging(verbose=args.verbose)
    logger = logging.getLogger("structured_extractor.cli")

    # Read document content
    try:
        content = read_input_content(args.input)
    except (FileNotFoundError, ValueError) as fe:
        sys.stderr.write(f"\n[CLI ERROR] {fe}\n")
        return 2

    # Instantiate LLM Client
    use_mock = args.mock or args.provider == "mock"
    try:
        client = get_llm_client(
            provider=args.provider,
            model=args.model,
            mock=use_mock
        )
    except AuthenticationError as auth_err:
        sys.stderr.write(f"\n[AUTHENTICATION ERROR] {auth_err}\n")
        sys.stderr.write("Tip: Run with '--mock' to test the extraction pipeline offline without an API key.\n\n")
        return 3
    except LLMClientError as client_err:
        sys.stderr.write(f"\n[LLM CLIENT ERROR] {client_err}\n")
        return 3

    # Instantiate Extractor
    extractor = DocumentExtractor(
        llm_client=client,
        enable_repair=not args.no_repair
    )

    # Execute extraction
    logger.info("Processing document extraction (type: %s, mock: %s)...", args.type, use_mock)
    result = extractor.extract(document_text=content, doc_type=args.type)

    if not result.success:
        sys.stderr.write("\n================ EXTRACTION FAILED ================\n")
        sys.stderr.write(f"Document Type : {args.type}\n")
        sys.stderr.write(f"Attempts Made : {result.attempts}\n")
        sys.stderr.write(f"Execution Time: {result.execution_time_seconds:.2f}s\n")
        sys.stderr.write("Validation Errors:\n")
        for err in result.errors:
            sys.stderr.write(f"  ❌ {err}\n")
        sys.stderr.write("===================================================\n\n")
        return 1

    # Format JSON
    indent = 2 if args.pretty else None
    json_output = json.dumps(result.data, indent=indent, ensure_ascii=False)

    # Write output to file or stdout
    if args.output:
        out_dir = os.path.dirname(args.output)
        if out_dir and not os.path.exists(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        with open(args.output, "w", encoding="utf-8") as out_f:
            out_f.write(json_output + "\n")
        logger.info("Successfully saved validated JSON to: %s", args.output)
    else:
        sys.stdout.write(json_output + "\n")

    return 0


if __name__ == "__main__":
    sys.exit(main())
