"""
Service layer - all business logic lives here.

Each service is a single-responsibility module:
- resume_parser.py    (Phase 4) - PDF/DOCX text extraction
- skill_extractor.py  (Phase 5) - NLP + LLM skill identification
- gap_analyzer.py     (Phase 6) - Skill comparison and scoring
- roadmap_generator.py (Phase 9) - Learning path generation
- resume_advisor.py   (Phase 9) - Resume improvement suggestions
- ats_scorer.py       (Phase 6) - ATS compatibility scoring
- ai_client.py        (Phase 5) - Unified LLM provider wrapper
"""
