"""
Tests for the skill normalizer.

Covers:
- Exact name matching (case-insensitive)
- Alias resolution
- Unknown skill pass-through
- Deduplication
- Weight and category enrichment from taxonomy
- Empty/edge cases
"""

import pytest

from app.services.skill_normalizer import (
    NormalizedSkill,
    SkillNormalizer,
    TaxonomyEntry,
    build_taxonomy_index,
)


@pytest.fixture
def sample_taxonomy():
    """A small taxonomy for testing."""
    return [
        TaxonomyEntry(
            name="Python",
            category="programming_language",
            weight=2.5,
            aliases=["python3", "py", "cpython"],
        ),
        TaxonomyEntry(
            name="JavaScript",
            category="programming_language",
            weight=2.0,
            aliases=["js", "ecmascript", "es6"],
        ),
        TaxonomyEntry(
            name="Kubernetes",
            category="devops",
            weight=2.0,
            aliases=["k8s", "kube"],
        ),
        TaxonomyEntry(
            name="Docker",
            category="devops",
            weight=1.5,
            aliases=["docker-compose", "dockerfile"],
        ),
        TaxonomyEntry(
            name="PostgreSQL",
            category="database",
            weight=1.8,
            aliases=["postgres", "psql", "pg"],
        ),
    ]


@pytest.fixture
def normalizer(sample_taxonomy):
    return SkillNormalizer(sample_taxonomy)


class TestSkillNormalizerMatching:
    """Test skill name matching against taxonomy."""

    def test_exact_name_match(self, normalizer):
        """Skills matching a taxonomy name get enriched."""
        skills = [{"name": "Python", "confidence": 0.95, "category": "lang"}]
        result = normalizer.normalize(skills)

        assert len(result) == 1
        assert result[0].name == "Python"
        assert result[0].category == "programming_language"  # From taxonomy
        assert result[0].weight == 2.5  # From taxonomy
        assert result[0].in_taxonomy is True

    def test_case_insensitive_match(self, normalizer):
        """Matching is case-insensitive."""
        skills = [{"name": "python", "confidence": 0.9, "category": "lang"}]
        result = normalizer.normalize(skills)

        assert result[0].name == "Python"  # Canonical name
        assert result[0].in_taxonomy is True

    def test_alias_match(self, normalizer):
        """Aliases resolve to the canonical taxonomy name."""
        skills = [{"name": "k8s", "confidence": 0.8, "category": "infra"}]
        result = normalizer.normalize(skills)

        assert result[0].name == "Kubernetes"
        assert result[0].category == "devops"
        assert result[0].weight == 2.0
        assert result[0].in_taxonomy is True

    def test_alias_case_insensitive(self, normalizer):
        """Alias matching is also case-insensitive."""
        skills = [{"name": "JS", "confidence": 0.85, "category": "lang"}]
        result = normalizer.normalize(skills)

        assert result[0].name == "JavaScript"

    def test_unknown_skill_passthrough(self, normalizer):
        """Unknown skills pass through with defaults."""
        skills = [{"name": "Terraform", "confidence": 0.7, "category": "devops"}]
        result = normalizer.normalize(skills)

        assert len(result) == 1
        assert result[0].name == "Terraform"
        assert result[0].category == "devops"  # From LLM
        assert result[0].weight == 1.0  # Default
        assert result[0].in_taxonomy is False


class TestSkillNormalizerDedup:
    """Test deduplication behavior."""

    def test_dedup_same_canonical(self, normalizer):
        """Two inputs mapping to the same canonical name are deduped."""
        skills = [
            {"name": "Python", "confidence": 0.95, "category": "lang"},
            {"name": "python3", "confidence": 0.8, "category": "lang"},
        ]
        result = normalizer.normalize(skills)

        assert len(result) == 1
        assert result[0].name == "Python"
        assert result[0].confidence == 0.95  # First one wins

    def test_dedup_case_variants(self, normalizer):
        """Case variants of unknown skills are also deduped."""
        skills = [
            {"name": "Terraform", "confidence": 0.9, "category": "devops"},
            {"name": "terraform", "confidence": 0.7, "category": "infra"},
        ]
        result = normalizer.normalize(skills)

        assert len(result) == 1
        assert result[0].name == "Terraform"


class TestSkillNormalizerEdgeCases:
    """Test edge cases and input validation."""

    def test_empty_skill_list(self, normalizer):
        """Empty input returns empty output."""
        result = normalizer.normalize([])
        assert result == []

    def test_skill_with_no_name(self, normalizer):
        """Skills without a name are skipped."""
        skills = [
            {"name": "", "confidence": 0.5, "category": "other"},
            {"confidence": 0.5, "category": "other"},
        ]
        result = normalizer.normalize(skills)
        assert result == []

    def test_confidence_clamping(self, normalizer):
        """Confidence is clamped to [0.0, 1.0]."""
        skills = [
            {"name": "Python", "confidence": 1.5, "category": "lang"},
        ]
        result = normalizer.normalize(skills)
        assert result[0].confidence == 1.0

        skills2 = [
            {"name": "Docker", "confidence": -0.3, "category": "devops"},
        ]
        result2 = normalizer.normalize(skills2)
        assert result2[0].confidence == 0.0

    def test_missing_confidence_defaults(self, normalizer):
        """Missing confidence defaults to 0.5."""
        skills = [{"name": "Python", "category": "lang"}]
        result = normalizer.normalize(skills)
        assert result[0].confidence == 0.5

    def test_source_field(self, normalizer):
        """Source field is passed through correctly."""
        skills = [{"name": "Python", "confidence": 0.9, "category": "lang"}]

        resume_result = normalizer.normalize(skills, source="resume")
        assert resume_result[0].source == "resume"

        job_result = normalizer.normalize(skills, source="job_description")
        assert job_result[0].source == "job_description"

    def test_required_field_for_job_skills(self, normalizer):
        """The 'required' field is preserved for job description skills."""
        skills = [
            {
                "name": "Python",
                "confidence": 0.95,
                "category": "lang",
                "required": True,
            },
            {
                "name": "Docker",
                "confidence": 0.6,
                "category": "devops",
                "required": False,
            },
        ]
        result = normalizer.normalize(skills, source="job_description")

        python_skill = next(s for s in result if s.name == "Python")
        docker_skill = next(s for s in result if s.name == "Docker")

        assert python_skill.required is True
        assert docker_skill.required is False

    def test_whitespace_in_name(self, normalizer):
        """Leading/trailing whitespace in names is stripped."""
        skills = [{"name": "  Python  ", "confidence": 0.9, "category": "lang"}]
        result = normalizer.normalize(skills)
        assert result[0].name == "Python"
        assert result[0].in_taxonomy is True


class TestBuildTaxonomyIndex:
    """Test the taxonomy index builder."""

    def test_basic_conversion(self):
        """Converts raw dicts to TaxonomyEntry objects."""
        data = [
            {
                "name": "Python",
                "category": "programming_language",
                "weight": 2.5,
                "aliases": ["py", "python3"],
            }
        ]
        result = build_taxonomy_index(data)

        assert len(result) == 1
        assert isinstance(result[0], TaxonomyEntry)
        assert result[0].name == "Python"
        assert result[0].weight == 2.5
        assert result[0].aliases == ["py", "python3"]

    def test_missing_weight_defaults(self):
        """Missing weight defaults to 1.0."""
        data = [{"name": "Go", "category": "programming_language"}]
        result = build_taxonomy_index(data)
        assert result[0].weight == 1.0

    def test_null_aliases_defaults(self):
        """Null aliases defaults to empty list."""
        data = [{"name": "Go", "category": "programming_language", "aliases": None}]
        result = build_taxonomy_index(data)
        assert result[0].aliases == []

    def test_empty_input(self):
        """Empty input returns empty list."""
        assert build_taxonomy_index([]) == []
