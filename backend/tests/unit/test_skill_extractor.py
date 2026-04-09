"""
Tests for the skill extraction pipeline.

Since the extractor depends on LLM calls (external API), we mock
the LLM client and test the orchestration logic:
- Parallel extraction (resume + job)
- Normalization integration
- Matched/missing skill computation
- Priority assignment
- Error handling
- ExtractionResult serialization
"""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.skill_extractor import (
    ExtractionResult,
    _compute_priority,
    _strip_tech_suffix,
    extract_skills,
)
from app.services.skill_normalizer import NormalizedSkill, TaxonomyEntry


@pytest.fixture
def sample_taxonomy():
    """Taxonomy entries for testing."""
    return [
        TaxonomyEntry(
            name="Python", category="programming_language", weight=2.5, aliases=["py"]
        ),
        TaxonomyEntry(
            name="JavaScript",
            category="programming_language",
            weight=2.0,
            aliases=["js"],
        ),
        TaxonomyEntry(
            name="React", category="framework", weight=1.8, aliases=["reactjs"]
        ),
        TaxonomyEntry(
            name="Node.js", category="framework", weight=1.8, aliases=["nodejs", "node"]
        ),
        TaxonomyEntry(name="Docker", category="devops", weight=1.5, aliases=[]),
        TaxonomyEntry(
            name="PostgreSQL", category="database", weight=1.8, aliases=["postgres"]
        ),
        TaxonomyEntry(
            name="AWS", category="devops", weight=2.0, aliases=["amazon web services"]
        ),
    ]


def _make_llm_response(
    skills: list[dict], provider="openai", model="gpt-4o", tokens=500
):
    """Create a mock LLMResponse that returns parsed skills."""
    import json

    from app.services.llm_client import LLMResponse

    return LLMResponse(
        content=json.dumps({"skills": skills}),
        provider=provider,
        model=model,
        input_tokens=tokens // 2,
        output_tokens=tokens // 2,
    )


class TestComputePriority:
    """Test the priority assignment logic."""

    def test_high_priority_required_and_heavy(self):
        """Required skills with weight >= 2.0 are HIGH priority."""
        skill = NormalizedSkill(
            name="Python",
            category="programming_language",
            confidence=0.95,
            weight=2.5,
            in_taxonomy=True,
            required=True,
        )
        assert _compute_priority(skill) == "high"

    def test_high_priority_required_at_threshold(self):
        """Required with weight exactly 2.0 is HIGH."""
        skill = NormalizedSkill(
            name="AWS",
            category="devops",
            confidence=0.9,
            weight=2.0,
            in_taxonomy=True,
            required=True,
        )
        assert _compute_priority(skill) == "high"

    def test_medium_priority_required_low_weight(self):
        """Required skills with weight < 2.0 are MEDIUM."""
        skill = NormalizedSkill(
            name="Docker",
            category="devops",
            confidence=0.8,
            weight=1.5,
            in_taxonomy=True,
            required=True,
        )
        assert _compute_priority(skill) == "medium"

    def test_medium_priority_preferred_high_weight(self):
        """Preferred skills with weight >= 1.5 are MEDIUM."""
        skill = NormalizedSkill(
            name="React",
            category="framework",
            confidence=0.7,
            weight=1.8,
            in_taxonomy=True,
            required=False,
        )
        assert _compute_priority(skill) == "medium"

    def test_low_priority_preferred_low_weight(self):
        """Preferred skills with weight < 1.5 are LOW."""
        skill = NormalizedSkill(
            name="Jira",
            category="tool",
            confidence=0.5,
            weight=1.0,
            in_taxonomy=False,
            required=False,
        )
        assert _compute_priority(skill) == "low"

    def test_low_priority_no_required_flag(self):
        """Skills with required=None are treated as not required."""
        skill = NormalizedSkill(
            name="Git",
            category="tool",
            confidence=0.6,
            weight=1.2,
            in_taxonomy=False,
            required=None,
        )
        assert _compute_priority(skill) == "low"


class TestExtractionResultSerialization:
    """Test ExtractionResult.to_dict() for JSONB storage."""

    def test_to_dict_structure(self):
        """Verify the serialized structure matches what the Analysis model expects."""
        result = ExtractionResult(
            resume_skills=[
                NormalizedSkill(
                    name="Python",
                    category="programming_language",
                    confidence=0.95,
                    weight=2.5,
                    in_taxonomy=True,
                    source="resume",
                ),
            ],
            job_skills=[
                NormalizedSkill(
                    name="Python",
                    category="programming_language",
                    confidence=0.95,
                    weight=2.5,
                    in_taxonomy=True,
                    source="job_description",
                    required=True,
                ),
                NormalizedSkill(
                    name="Go",
                    category="programming_language",
                    confidence=0.8,
                    weight=1.0,
                    in_taxonomy=False,
                    source="job_description",
                    required=False,
                ),
            ],
            matched_skills=[
                NormalizedSkill(
                    name="Python",
                    category="programming_language",
                    confidence=0.95,
                    weight=2.5,
                    in_taxonomy=True,
                ),
            ],
            missing_skills=[
                NormalizedSkill(
                    name="Go",
                    category="programming_language",
                    confidence=0.8,
                    weight=1.0,
                    in_taxonomy=False,
                    required=False,
                ),
            ],
            provider="openai",
            model="gpt-4o",
            total_tokens=1000,
            extraction_time_ms=5000,
        )

        d = result.to_dict()

        # Check resume_skills
        assert len(d["resume_skills"]) == 1
        assert d["resume_skills"][0]["name"] == "Python"
        assert d["resume_skills"][0]["source"] == "resume"
        assert "confidence" in d["resume_skills"][0]

        # Check job_skills have 'required' field
        assert len(d["job_skills"]) == 2
        assert d["job_skills"][0]["required"] is True
        assert d["job_skills"][1]["required"] is False

        # Check matched_skills (no source/required)
        assert len(d["matched_skills"]) == 1
        assert "source" not in d["matched_skills"][0]

        # Check missing_skills have priority
        assert len(d["missing_skills"]) == 1
        assert d["missing_skills"][0]["priority"] == "low"
        assert "weight" in d["missing_skills"][0]


class TestExtractSkillsPipeline:
    """Test the full extraction pipeline with mocked LLM calls."""

    @pytest.mark.asyncio
    async def test_basic_extraction_flow(self, sample_taxonomy):
        """End-to-end extraction with matching and missing skills."""
        resume_response = _make_llm_response(
            [
                {
                    "name": "Python",
                    "confidence": 0.95,
                    "category": "programming_language",
                },
                {"name": "React", "confidence": 0.8, "category": "framework"},
                {"name": "Docker", "confidence": 0.7, "category": "devops"},
            ]
        )

        job_response = _make_llm_response(
            [
                {
                    "name": "Python",
                    "confidence": 0.95,
                    "category": "programming_language",
                    "required": True,
                },
                {
                    "name": "AWS",
                    "confidence": 0.9,
                    "category": "devops",
                    "required": True,
                },
                {
                    "name": "React",
                    "confidence": 0.7,
                    "category": "framework",
                    "required": False,
                },
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]

            result = await extract_skills(
                resume_text="Experienced Python developer with React and Docker.",
                job_description="Looking for a Python developer with AWS and React.",
                taxonomy=sample_taxonomy,
            )

        assert isinstance(result, ExtractionResult)

        # Resume has Python, React, Docker
        assert len(result.resume_skills) == 3
        resume_names = {s.name for s in result.resume_skills}
        assert resume_names == {"Python", "React", "Docker"}

        # Job wants Python, AWS, React
        assert len(result.job_skills) == 3

        # Matched: Python and React (in both)
        matched_names = {s.name for s in result.matched_skills}
        assert matched_names == {"Python", "React"}

        # Missing: AWS (in job but not resume)
        missing_names = {s.name for s in result.missing_skills}
        assert missing_names == {"AWS"}

        # Metadata
        assert result.provider == "openai"
        assert result.total_tokens == 1000  # 500 + 500
        assert (
            result.extraction_time_ms >= 0
        )  # 0 is valid with mocked instant LLM calls

    @pytest.mark.asyncio
    async def test_alias_resolution_in_matching(self, sample_taxonomy):
        """Skills matched via aliases are correctly identified as matches."""
        # Resume says "postgres", job says "PostgreSQL" -- both should resolve
        resume_response = _make_llm_response(
            [
                {"name": "postgres", "confidence": 0.9, "category": "database"},
            ]
        )

        job_response = _make_llm_response(
            [
                {
                    "name": "PostgreSQL",
                    "confidence": 0.9,
                    "category": "database",
                    "required": True,
                },
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]

            result = await extract_skills(
                resume_text="Built systems with postgres.",
                job_description="Must know PostgreSQL.",
                taxonomy=sample_taxonomy,
            )

        # Both resolve to "PostgreSQL" -- should be a match
        assert len(result.matched_skills) == 1
        assert result.matched_skills[0].name == "PostgreSQL"
        assert len(result.missing_skills) == 0

    @pytest.mark.asyncio
    async def test_no_overlap(self, sample_taxonomy):
        """When resume and job have zero overlap, all job skills are missing."""
        resume_response = _make_llm_response(
            [
                {
                    "name": "Python",
                    "confidence": 0.95,
                    "category": "programming_language",
                },
            ]
        )

        job_response = _make_llm_response(
            [
                {
                    "name": "JavaScript",
                    "confidence": 0.9,
                    "category": "programming_language",
                    "required": True,
                },
                {
                    "name": "React",
                    "confidence": 0.8,
                    "category": "framework",
                    "required": True,
                },
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]

            result = await extract_skills(
                resume_text="Python developer.",
                job_description="Need JS and React.",
                taxonomy=sample_taxonomy,
            )

        assert len(result.matched_skills) == 0
        assert len(result.missing_skills) == 2

    @pytest.mark.asyncio
    async def test_perfect_overlap(self, sample_taxonomy):
        """When resume has all job skills, nothing is missing."""
        skills = [
            {
                "name": "Python",
                "confidence": 0.95,
                "category": "programming_language",
                "required": True,
            },
        ]

        resume_response = _make_llm_response(skills)
        job_response = _make_llm_response(skills)

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]

            result = await extract_skills(
                resume_text="Expert Python developer.",
                job_description="Need Python developer.",
                taxonomy=sample_taxonomy,
            )

        assert len(result.matched_skills) == 1
        assert len(result.missing_skills) == 0

    @pytest.mark.asyncio
    async def test_llm_error_raises_parsing_error(self, sample_taxonomy):
        """If LLM calls fail, a ParsingError is raised."""
        from app.core.exceptions import ParsingError

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = RuntimeError("API timeout")

            with pytest.raises(ParsingError):
                await extract_skills(
                    resume_text="Some resume text.",
                    job_description="Some job description.",
                    taxonomy=sample_taxonomy,
                )


class TestStripTechSuffix:
    """Unit tests for the _strip_tech_suffix helper."""

    def test_strips_dot_js(self):
        assert _strip_tech_suffix("React.js") == "react"

    def test_strips_dot_ts(self):
        assert _strip_tech_suffix("Something.ts") == "something"

    def test_strips_dot_py(self):
        assert _strip_tech_suffix("Script.py") == "script"

    def test_no_suffix(self):
        assert _strip_tech_suffix("React") == "react"

    def test_no_suffix_typescript(self):
        """'TypeScript' should NOT be stripped — no dot before 'ts'."""
        assert _strip_tech_suffix("TypeScript") == "typescript"

    def test_case_insensitive(self):
        assert _strip_tech_suffix("React.JS") == "react"

    def test_whitespace(self):
        assert _strip_tech_suffix("  React.js  ") == "react"


class TestFuzzyVariantMatching:
    """Test that common skill name variants match correctly (no false negatives)."""

    @pytest.mark.asyncio
    async def test_react_vs_react_js(self, sample_taxonomy):
        """Resume 'React' matches job 'React.js' even though .js isn't a taxonomy alias."""
        resume_response = _make_llm_response(
            [
                {"name": "React", "confidence": 0.9, "category": "framework"},
            ]
        )
        job_response = _make_llm_response(
            [
                {
                    "name": "React.js",
                    "confidence": 0.9,
                    "category": "framework",
                    "required": True,
                },
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]
            result = await extract_skills(
                resume_text="Built UIs with React.",
                job_description="Must know React.js.",
                taxonomy=sample_taxonomy,
            )

        assert len(result.matched_skills) == 1
        assert len(result.missing_skills) == 0

    @pytest.mark.asyncio
    async def test_node_vs_node_js(self, sample_taxonomy):
        """Resume 'Node' matches job 'Node.js' via fuzzy suffix stripping."""
        # Use a taxonomy without Node so both pass through as unknown skills
        taxonomy_no_node = [e for e in sample_taxonomy if "node" not in e.name.lower()]
        resume_response = _make_llm_response(
            [
                {"name": "Node", "confidence": 0.85, "category": "framework"},
            ]
        )
        job_response = _make_llm_response(
            [
                {
                    "name": "Node.js",
                    "confidence": 0.85,
                    "category": "framework",
                    "required": True,
                },
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]
            result = await extract_skills(
                resume_text="Built APIs with Node.",
                job_description="Requires Node.js experience.",
                taxonomy=taxonomy_no_node,
            )

        assert len(result.matched_skills) == 1
        assert len(result.missing_skills) == 0

    @pytest.mark.asyncio
    async def test_postgresql_vs_postgres(self, sample_taxonomy):
        """'PostgreSQL' and 'Postgres' both resolve to canonical 'PostgreSQL' via alias."""
        resume_response = _make_llm_response(
            [
                {"name": "PostgreSQL", "confidence": 0.9, "category": "database"},
            ]
        )
        job_response = _make_llm_response(
            [
                {
                    "name": "Postgres",
                    "confidence": 0.9,
                    "category": "database",
                    "required": True,
                },
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]
            result = await extract_skills(
                resume_text="Used PostgreSQL for storage.",
                job_description="Requires Postgres.",
                taxonomy=sample_taxonomy,
            )

        assert len(result.matched_skills) == 1
        assert result.matched_skills[0].name == "PostgreSQL"
        assert len(result.missing_skills) == 0

    @pytest.mark.asyncio
    async def test_no_false_positives_different_skills(self, sample_taxonomy):
        """Completely different skills still register as missing."""
        resume_response = _make_llm_response(
            [
                {
                    "name": "Python",
                    "confidence": 0.95,
                    "category": "programming_language",
                },
            ]
        )
        job_response = _make_llm_response(
            [
                {
                    "name": "Go",
                    "confidence": 0.9,
                    "category": "programming_language",
                    "required": True,
                },
                {
                    "name": "Rust",
                    "confidence": 0.8,
                    "category": "programming_language",
                    "required": False,
                },
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]
            result = await extract_skills(
                resume_text="Python developer.",
                job_description="Need Go and Rust.",
                taxonomy=sample_taxonomy,
            )

        assert len(result.matched_skills) == 0
        missing_names = {s.name for s in result.missing_skills}
        assert missing_names == {"Go", "Rust"}

    @pytest.mark.asyncio
    async def test_tensorflow_version_fuzzy_match(self, sample_taxonomy):
        """'TensorFlow 2' on resume fuzzy-matches 'TensorFlow' in job via tier 3."""
        taxonomy_with_tf = sample_taxonomy + [
            TaxonomyEntry(
                name="TensorFlow",
                category="ml_framework",
                weight=2.0,
                aliases=[],
            )
        ]
        resume_response = _make_llm_response(
            [{"name": "TensorFlow 2", "confidence": 0.9, "category": "ml_framework"}]
        )
        job_response = _make_llm_response(
            [
                {
                    "name": "TensorFlow",
                    "confidence": 0.9,
                    "category": "ml_framework",
                    "required": True,
                }
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]
            result = await extract_skills(
                resume_text="Used TensorFlow 2 for model training.",
                job_description="Requires TensorFlow.",
                taxonomy=taxonomy_with_tf,
            )

        assert len(result.matched_skills) == 1
        assert len(result.missing_skills) == 0

    @pytest.mark.asyncio
    async def test_off_taxonomy_fuzzy_match(self, sample_taxonomy):
        """Off-taxonomy 'Postgres 14' fuzzy-matches off-taxonomy 'Postgres 15' via tier 3."""
        resume_response = _make_llm_response(
            [{"name": "Postgres 14", "confidence": 0.8, "category": "database"}]
        )
        job_response = _make_llm_response(
            [
                {
                    "name": "Postgres 15",
                    "confidence": 0.8,
                    "category": "database",
                    "required": True,
                }
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]
            result = await extract_skills(
                resume_text="Managed Postgres 14 databases.",
                job_description="Requires Postgres 15.",
                taxonomy=sample_taxonomy,
            )

        assert len(result.matched_skills) == 1
        assert len(result.missing_skills) == 0

    @pytest.mark.asyncio
    async def test_vue_js_vs_vue(self, sample_taxonomy):
        """Off-taxonomy 'Vue' matches off-taxonomy 'Vue.js' via fuzzy matching."""
        resume_response = _make_llm_response(
            [
                {"name": "Vue", "confidence": 0.8, "category": "framework"},
            ]
        )
        job_response = _make_llm_response(
            [
                {
                    "name": "Vue.js",
                    "confidence": 0.8,
                    "category": "framework",
                    "required": True,
                },
            ]
        )

        with patch("app.services.skill_extractor.call_llm") as mock_llm:
            mock_llm.side_effect = [resume_response, job_response]
            result = await extract_skills(
                resume_text="Built apps with Vue.",
                job_description="Requires Vue.js.",
                taxonomy=sample_taxonomy,
            )

        assert len(result.matched_skills) == 1
        assert len(result.missing_skills) == 0
