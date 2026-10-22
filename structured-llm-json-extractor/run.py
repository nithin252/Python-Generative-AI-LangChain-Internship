#!/usr/bin/env python3
"""
Datheon Internship Task 1: Structured LLM Prompt Pipeline & JSON Extractor
Entry point runner script.
"""

import sys
import os

# Ensure current directory is in Python module search path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.main import main

if __name__ == "__main__":
    sys.exit(main())
