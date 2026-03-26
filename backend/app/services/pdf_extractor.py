"""
PDF text extraction using PyMuPDF (fitz).

Why PyMuPDF over alternatives?
- pdfplumber: Great for tables but slower on plain text extraction.
- PyPDF2: Simpler API but much worse at handling complex PDF layouts.
- PyMuPDF: Best balance of speed, text quality, and layout preservation.
  It handles multi-column layouts, embedded fonts, and scanned-text PDFs
  better than most pure-Python libraries.

For truly scanned PDFs (image-only, no text layer), OCR would be needed.
That's out of scope for the MVP but the architecture supports adding
Tesseract OCR as a fallback later.
"""

import io
import logging

import fitz  # PyMuPDF

logger = logging.getLogger(__name__)


class PDFExtractionError(Exception):
    """Raised when PDF text extraction fails."""
    pass


def extract_text_from_pdf(file_content: bytes) -> str:
    """
    Extract all text from a PDF file.

    Processes pages sequentially, joining with double newlines to preserve
    page boundaries. Strips excessive whitespace from each page but keeps
    paragraph structure intact.

    Args:
        file_content: Raw bytes of the PDF file.

    Returns:
        The full extracted text as a single string.

    Raises:
        PDFExtractionError: If the PDF cannot be opened or has no extractable text.
    """
    try:
        doc = fitz.open(stream=file_content, filetype="pdf")
    except Exception as e:
        raise PDFExtractionError(f"Could not open PDF: {e}") from e

    if doc.page_count == 0:
        doc.close()
        raise PDFExtractionError("PDF has no pages.")

    pages_text: list[str] = []

    for page_num in range(doc.page_count):
        try:
            page = doc[page_num]
            # "text" mode gives us plain text with layout awareness.
            # Alternatives: "dict" (structured blocks), "html" (formatted).
            text = page.get_text("text")
            cleaned = text.strip()
            if cleaned:
                pages_text.append(cleaned)
        except Exception as e:
            logger.warning(f"Failed to extract text from page {page_num + 1}: {e}")
            continue

    doc.close()

    if not pages_text:
        raise PDFExtractionError(
            "No text could be extracted from the PDF. "
            "It may be a scanned image or have no selectable text."
        )

    return "\n\n".join(pages_text)
