"""
Data schemas for structured document extraction using Pydantic v2.
Defines strict schemas for Invoices, Resumes, and common document sub-entities.
"""

from typing import List, Optional, Union
from pydantic import BaseModel, Field, ConfigDict, field_validator


class LineItem(BaseModel):
    """Represents a single line item within an invoice or receipt."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    description: str = Field(
        ...,
        description="Detailed description or product name of the item or service."
    )
    quantity: float = Field(
        default=1.0,
        description="Quantity of units billed. Defaults to 1.0 if not specified."
    )
    unit_price: float = Field(
        ...,
        description="Price per single unit (numeric, excluding currency symbols)."
    )
    amount: float = Field(
        ...,
        description="Total monetary amount for this item (typically quantity * unit_price)."
    )

    @field_validator("quantity", "unit_price", "amount", mode="before")
    @classmethod
    def clean_numeric(cls, v: Union[float, int, str, None]) -> float:
        if v is None:
            return 0.0
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            # Strip currency symbols and commas e.g. "$1,250.00" -> 1250.00
            cleaned = v.replace("$", "").replace("€", "").replace("£", "").replace("₹", "").replace(",", "").strip()
            try:
                return float(cleaned)
            except ValueError:
                raise ValueError(f"Cannot convert '{v}' to a valid numeric amount.")
        return 0.0


class Invoice(BaseModel):
    """Strict schema for financial invoices and commercial bills."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    invoice_number: Optional[str] = Field(
        default=None,
        description="Invoice reference/identifier code (e.g. 'INV-2024-001'). Null if absent."
    )
    invoice_date: Optional[str] = Field(
        default=None,
        description="Date of invoice issue in ISO 8601 (YYYY-MM-DD) or explicit source format. Null if absent."
    )
    due_date: Optional[str] = Field(
        default=None,
        description="Payment due date in ISO 8601 (YYYY-MM-DD) or explicit format. Null if absent."
    )
    vendor_name: Optional[str] = Field(
        default=None,
        description="Legal entity or business name issuing the invoice. Null if absent."
    )
    customer_name: Optional[str] = Field(
        default=None,
        description="Legal entity or individual billed for the invoice. Null if absent."
    )
    currency: Optional[str] = Field(
        default=None,
        description="3-letter ISO 4217 currency code (e.g. 'USD', 'EUR', 'INR') or recognized currency symbol."
    )
    subtotal: Optional[float] = Field(
        default=None,
        description="Pre-tax monetary subtotal sum."
    )
    tax: Optional[float] = Field(
        default=None,
        description="Total sales tax, VAT, GST, or duty amount."
    )
    total: Optional[float] = Field(
        default=None,
        description="Final total payable amount inclusive of tax and fees."
    )
    line_items: List[LineItem] = Field(
        default_factory=list,
        description="List of individual items, goods, or services billed."
    )
    payment_status: Optional[str] = Field(
        default=None,
        description="Status such as 'Paid', 'Pending', 'Due', 'Overdue', or 'Draft'."
    )

    @field_validator("subtotal", "tax", "total", mode="before")
    @classmethod
    def clean_optional_numeric(cls, v: Union[float, int, str, None]) -> Optional[float]:
        if v is None or v == "":
            return None
        if isinstance(v, (int, float)):
            return float(v)
        if isinstance(v, str):
            cleaned = v.replace("$", "").replace("€", "").replace("£", "").replace("₹", "").replace(",", "").strip()
            try:
                return float(cleaned)
            except ValueError:
                return None
        return None

    @field_validator("currency", mode="before")
    @classmethod
    def clean_currency(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v_clean = str(v).strip().upper()
        # Normalization map for common symbols
        symbols = {"$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY"}
        return symbols.get(v_clean, v_clean)


# --- Resume Schemas ---

class EducationItem(BaseModel):
    """An educational credential or degree."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    degree: str = Field(
        ...,
        description="Title of degree or certification (e.g. 'Bachelor of Science in Computer Science')."
    )
    institution: str = Field(
        ...,
        description="Name of university, college, or educational institution."
    )
    graduation_year: Optional[str] = Field(
        default=None,
        description="Year or expected year of graduation (e.g. '2023')."
    )
    field_of_study: Optional[str] = Field(
        default=None,
        description="Major, minor, or concentration."
    )
    gpa: Optional[str] = Field(
        default=None,
        description="Reported GPA or grade classification if explicitly mentioned."
    )


class ExperienceItem(BaseModel):
    """A professional employment or internship engagement."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    job_title: str = Field(
        ...,
        description="Role or title held (e.g. 'Senior Software Engineer')."
    )
    company: str = Field(
        ...,
        description="Name of company or employing organization."
    )
    start_date: Optional[str] = Field(
        default=None,
        description="Start date (e.g. 'Jan 2021', '2021-01')."
    )
    end_date: Optional[str] = Field(
        default=None,
        description="End date or 'Present'/'Current'."
    )
    location: Optional[str] = Field(
        default=None,
        description="City, State/Country, or 'Remote'."
    )
    responsibilities: List[str] = Field(
        default_factory=list,
        description="Bullet points or key achievements for this role."
    )


class ProjectItem(BaseModel):
    """A portfolio, open source, or academic project."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    title: str = Field(
        ...,
        description="Name of the project."
    )
    description: Optional[str] = Field(
        default=None,
        description="Short summary of the project purpose and results."
    )
    technologies: List[str] = Field(
        default_factory=list,
        description="Tools, languages, and frameworks utilized."
    )
    link: Optional[str] = Field(
        default=None,
        description="URL or repository link if specified."
    )


class Resume(BaseModel):
    """Strict schema for parsed candidate resumes and CVs."""
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    full_name: Optional[str] = Field(
        default=None,
        description="Candidate's full legal or preferred name."
    )
    email: Optional[str] = Field(
        default=None,
        description="Primary email address for contact."
    )
    phone: Optional[str] = Field(
        default=None,
        description="Contact telephone or mobile number."
    )
    location: Optional[str] = Field(
        default=None,
        description="City, state, or country of residence."
    )
    skills: List[str] = Field(
        default_factory=list,
        description="List of technical, analytical, or domain skills explicitly listed."
    )
    education: List[EducationItem] = Field(
        default_factory=list,
        description="Degrees, universities, and academic qualifications."
    )
    experience: List[ExperienceItem] = Field(
        default_factory=list,
        description="Work experience history in reverse-chronological order."
    )
    certifications: List[str] = Field(
        default_factory=list,
        description="Professional certifications, licenses, and accreditations."
    )
    projects: List[ProjectItem] = Field(
        default_factory=list,
        description="Notable software, design, or business projects."
    )

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        cleaned = str(v).strip().lower()
        # Basic sanity check
        if "@" in cleaned and "." in cleaned:
            return cleaned
        return str(v).strip()


SCHEMA_MAP = {
    "invoice": Invoice,
    "receipt": Invoice,
    "resume": Resume,
    "cv": Resume,
}


def get_schema_for_type(doc_type: str):
    """Retrieve the Pydantic schema class for a given document type."""
    normalized = doc_type.strip().lower()
    schema = SCHEMA_MAP.get(normalized)
    if not schema:
        raise ValueError(
            f"Unsupported document type: '{doc_type}'. "
            f"Supported types are: {', '.join(sorted(SCHEMA_MAP.keys()))}"
        )
    return schema
