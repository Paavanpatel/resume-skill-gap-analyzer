"""
Skill normalization: matches LLM-extracted skills against the taxonomy.

The LLM extracts skill names from free text, but it doesn't know about our
database. This normalizer:
1. Tries to match each extracted skill to a canonical taxonomy entry
2. Resolves aliases (e.g., "K8s" -> "Kubernetes", "JS" -> "JavaScript")
3. Enriches matches with taxonomy metadata (weight, category)
4. Passes through unmatched skills with default weight

Why not just use the taxonomy names in the LLM prompt? Two reasons:
- The taxonomy has ~88 skills but real resumes reference hundreds more.
  We don't want to limit extraction to only known skills.
- The LLM is better at understanding context ("built microservices on EKS"
  implies both Kubernetes and AWS) than a keyword list.

The normalization flow: LLM output -> case-insensitive name match ->
alias match -> fuzzy match (future) -> pass-through with defaults.
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class TaxonomyEntry:
    """A flattened skill taxonomy entry for fast lookup."""

    name: str
    category: str
    weight: float
    aliases: list[str]


@dataclass
class NormalizedSkill:
    """A skill after normalization against the taxonomy."""

    name: str  # Canonical name (from taxonomy if matched)
    category: str  # Category (from taxonomy if matched, from LLM otherwise)
    confidence: float  # From LLM extraction
    weight: float  # From taxonomy (1.0 default for unmatched)
    in_taxonomy: bool  # Whether this skill matched a taxonomy entry
    source: str = "resume"  # "resume" or "job_description"
    required: bool | None = None  # Only for job description skills


class SkillNormalizer:
    """
    Matches extracted skills against a preloaded taxonomy.

    Usage:
        taxonomy_data = await skill_repo.get_all()
        normalizer = SkillNormalizer(taxonomy_data)
        normalized = normalizer.normalize(llm_skills)
    """

    def __init__(self, taxonomy: list[TaxonomyEntry]):
        # Build lookup indexes for O(1) matching
        self._by_name: dict[str, TaxonomyEntry] = {}
        self._by_alias: dict[str, TaxonomyEntry] = {}

        for entry in taxonomy:
            # Name index (lowercase for case-insensitive matching)
            self._by_name[entry.name.lower()] = entry

            # Alias index
            for alias in entry.aliases:
                self._by_alias[alias.lower()] = entry

    def _find_match(self, skill_name: str) -> TaxonomyEntry | None:
        """
        Try to match a skill name to a taxonomy entry.

        Match priority:
        1. Exact name match (case-insensitive)
        2. Alias match (case-insensitive)
        """
        lower = skill_name.lower().strip()

        # 1. Direct name match
        if lower in self._by_name:
            return self._by_name[lower]

        # 2. Alias match
        if lower in self._by_alias:
            return self._by_alias[lower]

        return None

    def normalize(
        self,
        extracted_skills: list[dict],
        source: str = "resume",
    ) -> list[NormalizedSkill]:
        """
        Normalize a list of LLM-extracted skills against the taxonomy.

        Args:
            extracted_skills: List of dicts from LLM output, each with
                              "name", "confidence", "category", and optionally "required".
            source: "resume" or "job_description"

        Returns:
            List of NormalizedSkill with taxonomy enrichment.
        """
        results: list[NormalizedSkill] = []
        seen_names: set[str] = set()  # Deduplicate by canonical name

        for skill in extracted_skills:
            name = skill.get("name", "").strip()
            if not name:
                continue

            confidence = min(max(float(skill.get("confidence", 0.5)), 0.0), 1.0)
            category = skill.get("category", "other")
            required = skill.get("required")

            match = self._find_match(name)

            if match:
                canonical = match.name
                # Use taxonomy category and weight
                final_category = match.category
                weight = match.weight
                in_taxonomy = True
            else:
                canonical = name
                final_category = category
                weight = 1.0  # Default weight for unknown skills
                in_taxonomy = False

            # Deduplicate (LLM might extract "Python" and "python3" which both map to "Python")
            dedup_key = canonical.lower()
            if dedup_key in seen_names:
                continue
            seen_names.add(dedup_key)

            results.append(
                NormalizedSkill(
                    name=canonical,
                    category=final_category,
                    confidence=confidence,
                    weight=weight,
                    in_taxonomy=in_taxonomy,
                    source=source,
                    required=required,
                )
            )

        matched_count = sum(1 for r in results if r.in_taxonomy)
        logger.info(
            "Normalized %d skills from %s: %d matched taxonomy, %d new",
            len(results),
            source,
            matched_count,
            len(results) - matched_count,
        )

        return results


def build_taxonomy_index(skills_data: list[dict]) -> list[TaxonomyEntry]:
    """
    Convert raw skill DB rows into TaxonomyEntry objects.

    Typically called once at startup or when the taxonomy cache refreshes.
    Validates required fields and logs warnings for malformed entries.
    """
    entries: list[TaxonomyEntry] = []
    for i, s in enumerate(skills_data):
        if not isinstance(s, dict):
            logger.warning(
                "Taxonomy entry %d is not a dict, skipping: %s", i, type(s).__name__
            )
            continue
        name = s.get("name")
        category = s.get("category")
        if not name or not isinstance(name, str):
            logger.warning("Taxonomy entry %d missing 'name', skipping: %s", i, s)
            continue
        if not category or not isinstance(category, str):
            logger.warning(
                "Taxonomy entry %d (%s) missing 'category', defaulting to 'other'",
                i,
                name,
            )
            category = "other"

        weight = s.get("weight", 1.0)
        if not isinstance(weight, (int, float)):
            weight = 1.0

        aliases = s.get("aliases", []) or []
        if not isinstance(aliases, list):
            aliases = []

        entries.append(
            TaxonomyEntry(
                name=name.strip(),
                category=category.strip(),
                weight=float(weight),
                aliases=[a for a in aliases if isinstance(a, str)],
            )
        )
    return entries
