"""
PDF export service -- Phase 9.

Generates a downloadable PDF report from a completed analysis.
The report includes:
- Header with job title, company, and date
- Score summary (match, ATS, format scores)
- Skill gap overview (matched and missing)
- Category breakdown table
- Top improvement suggestions
- Learning roadmap phases (if generated)

Uses ReportLab for PDF generation. The design is intentionally
simple and professional -- no heavy graphics, just clean typography
and color-coded scores.

Why ReportLab over WeasyPrint/wkhtmltopdf?
ReportLab is pure Python (no system dependencies), produces
consistent output across platforms, and gives precise control
over layout. WeasyPrint requires GTK/Cairo system libraries
which complicate Docker builds.
"""

from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from uuid import UUID

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
    KeepTogether,
)

logger = logging.getLogger(__name__)


# ── Color palette ────────────────────────────────────────────────

COLOR_PRIMARY = colors.HexColor("#2563eb")     # blue-600
COLOR_SUCCESS = colors.HexColor("#16a34a")     # green-600
COLOR_WARNING = colors.HexColor("#d97706")     # amber-600
COLOR_DANGER = colors.HexColor("#dc2626")      # red-600
COLOR_MUTED = colors.HexColor("#6b7280")       # gray-500
COLOR_HEADER_BG = colors.HexColor("#f0f4ff")   # blue-50
COLOR_ROW_ALT = colors.HexColor("#f9fafb")     # gray-50


def _score_color(score: float) -> colors.HexColor:
    """Return color based on score value."""
    if score >= 80:
        return COLOR_SUCCESS
    if score >= 60:
        return COLOR_PRIMARY
    if score >= 40:
        return COLOR_WARNING
    return COLOR_DANGER


def _priority_label(priority: str) -> str:
    """Format priority for display."""
    return priority.replace("_", " ").title()


# ── Styles ───────────────────────────────────────────────────────


def _build_styles() -> dict:
    """Create custom paragraph styles for the report."""
    base = getSampleStyleSheet()

    return {
        "title": ParagraphStyle(
            "ReportTitle",
            parent=base["Title"],
            fontSize=22,
            textColor=COLOR_PRIMARY,
            spaceAfter=6,
        ),
        "subtitle": ParagraphStyle(
            "ReportSubtitle",
            parent=base["Normal"],
            fontSize=11,
            textColor=COLOR_MUTED,
            spaceAfter=16,
        ),
        "heading": ParagraphStyle(
            "SectionHeading",
            parent=base["Heading2"],
            fontSize=14,
            textColor=COLOR_PRIMARY,
            spaceBefore=16,
            spaceAfter=8,
        ),
        "body": ParagraphStyle(
            "BodyText",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
            spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "SmallText",
            parent=base["Normal"],
            fontSize=8,
            textColor=COLOR_MUTED,
        ),
        "score_big": ParagraphStyle(
            "ScoreBig",
            parent=base["Normal"],
            fontSize=24,
            alignment=TA_CENTER,
            spaceAfter=2,
        ),
        "score_label": ParagraphStyle(
            "ScoreLabel",
            parent=base["Normal"],
            fontSize=9,
            alignment=TA_CENTER,
            textColor=COLOR_MUTED,
        ),
        "bullet": ParagraphStyle(
            "BulletItem",
            parent=base["Normal"],
            fontSize=10,
            leading=13,
            leftIndent=16,
            bulletIndent=4,
            spaceAfter=3,
        ),
    }


# ── Report sections ──────────────────────────────────────────────


def _build_header(
    styles: dict,
    job_title: str | None,
    job_company: str | None,
    created_at: str | None,
) -> list:
    """Build report header with title, job info, and date."""
    elements = []
    elements.append(Paragraph("Skill Gap Analysis Report", styles["title"]))

    subtitle_parts = []
    if job_title:
        subtitle_parts.append(job_title)
    if job_company:
        subtitle_parts.append(f"at {job_company}")

    if created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            subtitle_parts.append(f"-- {dt.strftime('%B %d, %Y')}")
        except (ValueError, AttributeError):
            pass

    if subtitle_parts:
        elements.append(Paragraph(" ".join(subtitle_parts), styles["subtitle"]))

    elements.append(HRFlowable(
        width="100%", thickness=1,
        color=colors.HexColor("#e5e7eb"), spaceAfter=12,
    ))

    return elements


def _build_score_cards(styles: dict, analysis: dict) -> list:
    """Build the three score cards row."""
    match = analysis.get("match_score") or 0
    ats = analysis.get("ats_score") or 0

    # Extract format score from ats_check
    ats_check = analysis.get("ats_check") or {}
    fmt = ats_check.get("format_score", 0) if isinstance(ats_check, dict) else 0

    scores = [
        ("Match Score", match, _score_color(match)),
        ("ATS Score", ats, _score_color(ats)),
        ("Format Score", fmt, _score_color(fmt)),
    ]

    score_cells = []
    for label, value, color in scores:
        cell_content = [
            Paragraph(f'<font color="{color.hexval()}">{value:.0f}%</font>', styles["score_big"]),
            Paragraph(label, styles["score_label"]),
        ]
        score_cells.append(cell_content)

    table = Table(
        [score_cells],
        colWidths=[2.1 * inch, 2.1 * inch, 2.1 * inch],
        rowHeights=[60],
    )
    table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#e5e7eb")),
        ("BOX", (1, 0), (1, 0), 0.5, colors.HexColor("#e5e7eb")),
        ("BOX", (2, 0), (2, 0), 0.5, colors.HexColor("#e5e7eb")),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafbfc")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))

    return [table, Spacer(1, 12)]


def _build_verdict(styles: dict, analysis: dict) -> list:
    """Build the verdict section with strengths and weaknesses."""
    elements = []
    explanation = analysis.get("score_explanation") or {}
    if not isinstance(explanation, dict):
        return elements

    verdict = explanation.get("overall_verdict", "")
    if verdict:
        label = verdict.replace("_", " ").title()
        elements.append(Paragraph(f"<b>Overall Verdict:</b> {label}", styles["body"]))

    strengths = explanation.get("strengths", [])
    if strengths:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph("<b>Strengths</b>", styles["body"]))
        for s in strengths[:5]:
            elements.append(Paragraph(f"\u2022 {s}", styles["bullet"]))

    weaknesses = explanation.get("weaknesses", [])
    if weaknesses:
        elements.append(Spacer(1, 6))
        elements.append(Paragraph("<b>Areas to Improve</b>", styles["body"]))
        for w in weaknesses[:5]:
            elements.append(Paragraph(f"\u2022 {w}", styles["bullet"]))

    return elements


def _build_skills_table(styles: dict, analysis: dict) -> list:
    """Build matched and missing skills tables."""
    elements = []
    elements.append(Paragraph("Skill Analysis", styles["heading"]))

    matched = analysis.get("matched_skills") or []
    missing = analysis.get("missing_skills") or []

    # Combined table
    headers = [
        Paragraph("<b>Matched Skills</b>", styles["body"]),
        Paragraph("<b>Missing Skills</b>", styles["body"]),
    ]

    max_rows = max(len(matched), len(missing), 1)
    rows = [headers]

    for i in range(min(max_rows, 15)):
        m_cell = ""
        if i < len(matched):
            m = matched[i]
            name = m.get("name", "") if isinstance(m, dict) else str(m)
            m_cell = Paragraph(f"<font color='#16a34a'>\u2713</font> {name}", styles["body"])

        g_cell = ""
        if i < len(missing):
            g = missing[i]
            name = g.get("name", "") if isinstance(g, dict) else str(g)
            priority = g.get("priority", "medium") if isinstance(g, dict) else "medium"
            g_cell = Paragraph(f"<font color='#dc2626'>\u2717</font> {name} ({priority})", styles["body"])

        rows.append([m_cell, g_cell])

    table = Table(rows, colWidths=[3.15 * inch, 3.15 * inch])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_HEADER_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))

    elements.append(table)
    return elements


def _build_categories(styles: dict, analysis: dict) -> list:
    """Build category breakdown section."""
    breakdowns = analysis.get("category_breakdowns") or []
    if not breakdowns:
        return []

    elements = []
    elements.append(Paragraph("Category Breakdown", styles["heading"]))

    headers = [
        Paragraph("<b>Category</b>", styles["body"]),
        Paragraph("<b>Match</b>", styles["body"]),
        Paragraph("<b>Matched</b>", styles["body"]),
        Paragraph("<b>Missing</b>", styles["body"]),
        Paragraph("<b>Priority</b>", styles["body"]),
    ]

    rows = [headers]
    for i, bd in enumerate(breakdowns[:10]):
        if not isinstance(bd, dict):
            continue
        pct = bd.get("match_percentage", 0)
        color = _score_color(pct)
        rows.append([
            Paragraph(bd.get("display_name", bd.get("category", "")), styles["body"]),
            Paragraph(f'<font color="{color.hexval()}">{pct:.0f}%</font>', styles["body"]),
            Paragraph(str(bd.get("matched_count", 0)), styles["body"]),
            Paragraph(str(bd.get("missing_count", 0)), styles["body"]),
            Paragraph(_priority_label(bd.get("priority", "")), styles["body"]),
        ])

    table = Table(
        rows,
        colWidths=[2.0 * inch, 0.8 * inch, 0.8 * inch, 0.8 * inch, 1.2 * inch],
    )
    style_cmds = [
        ("BACKGROUND", (0, 0), (-1, 0), COLOR_HEADER_BG),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]
    # Alternate row backgrounds
    for i in range(1, len(rows)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), COLOR_ROW_ALT))
    table.setStyle(TableStyle(style_cmds))

    elements.append(table)
    return elements


def _build_suggestions(styles: dict, analysis: dict) -> list:
    """Build top suggestions section."""
    suggestions = analysis.get("suggestions") or []
    if not suggestions:
        return []

    elements = []
    elements.append(Paragraph("Top Improvement Suggestions", styles["heading"]))

    for i, s in enumerate(suggestions[:6]):
        if not isinstance(s, dict):
            continue
        section = s.get("section", "general")
        suggested = s.get("suggested", "")
        reason = s.get("reason", "")
        priority = s.get("priority", "medium")

        elements.append(Paragraph(
            f"<b>{i + 1}. [{section.title()}] ({priority})</b>",
            styles["body"],
        ))
        if suggested:
            elements.append(Paragraph(suggested, styles["bullet"]))
        if reason:
            elements.append(Paragraph(
                f"<i>{reason}</i>",
                ParagraphStyle("ItalicSmall", parent=styles["body"], fontSize=9, textColor=COLOR_MUTED),
            ))
        elements.append(Spacer(1, 4))

    return elements


def _build_roadmap(styles: dict, roadmap: dict | None) -> list:
    """Build learning roadmap section if available."""
    if not roadmap:
        return []

    phases = roadmap.get("phases") or []
    if not phases:
        return []

    elements = []
    total_weeks = roadmap.get("total_weeks", 0)
    elements.append(Paragraph(
        f"Learning Roadmap ({total_weeks} weeks)", styles["heading"]
    ))

    for phase in phases[:8]:
        if not isinstance(phase, dict):
            continue
        week = phase.get("week_range", "")
        focus = phase.get("focus", "")

        elements.append(KeepTogether([
            Paragraph(f"<b>Weeks {week}: {focus}</b>", styles["body"]),
            *[
                Paragraph(f"\u2022 {obj}", styles["bullet"])
                for obj in (phase.get("objectives") or [])[:4]
            ],
            *[
                Paragraph(f"<font color='#2563eb'>Resource:</font> {res}", styles["small"])
                for res in (phase.get("resources") or [])[:2]
            ],
            Spacer(1, 6),
        ]))

    return elements


def _build_footer(styles: dict) -> list:
    """Build report footer."""
    return [
        Spacer(1, 20),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#e5e7eb")),
        Spacer(1, 6),
        Paragraph(
            "Generated by SkillGap Analyzer -- "
            f"{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            styles["small"],
        ),
    ]


# ── Main export function ─────────────────────────────────────────


def generate_pdf_report(
    analysis: dict,
    roadmap: dict | None = None,
) -> bytes:
    """
    Generate a PDF report from analysis data.

    Args:
        analysis: Complete analysis data as a dict (from AnalysisResult schema).
        roadmap: Optional roadmap data as a dict (from RoadmapResponse schema).

    Returns:
        PDF file contents as bytes.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        topMargin=0.6 * inch,
        bottomMargin=0.6 * inch,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        title="Skill Gap Analysis Report",
    )

    styles = _build_styles()
    elements = []

    # Header
    elements.extend(_build_header(
        styles,
        job_title=analysis.get("job_title"),
        job_company=analysis.get("job_company"),
        created_at=analysis.get("created_at"),
    ))

    # Score cards
    elements.extend(_build_score_cards(styles, analysis))

    # Verdict
    elements.extend(_build_verdict(styles, analysis))

    # Skills
    elements.extend(_build_skills_table(styles, analysis))

    # Categories
    elements.extend(_build_categories(styles, analysis))

    # Suggestions
    elements.extend(_build_suggestions(styles, analysis))

    # Roadmap
    elements.extend(_build_roadmap(styles, roadmap))

    # Footer
    elements.extend(_build_footer(styles))

    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    logger.info("Generated PDF report: %d bytes", len(pdf_bytes))
    return pdf_bytes
