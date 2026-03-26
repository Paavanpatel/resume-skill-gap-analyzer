"""
Seed script for the skill taxonomy database.

Run: python scripts/seed_skills.py

This populates the skills table with a curated set of tech skills
organized by category. This forms the baseline for keyword matching
in the skill extraction pipeline.

The taxonomy is intentionally broad. The LLM-based extractor (Phase 5)
handles skills not in this list; this table accelerates exact-match
lookups and provides canonical names for normalization.
"""

import asyncio
import sys
from pathlib import Path

# Add backend to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.db.session import WriteSession
from app.models.skill import Skill

SKILL_TAXONOMY = [
    # ── Programming Languages ────────────────────────────────
    # weight: 2.5-3.0 for core languages (these are usually hard requirements)
    {"name": "Python", "category": "programming_language", "aliases": ["py", "python3"], "weight": 3.0},
    {"name": "JavaScript", "category": "programming_language", "aliases": ["js", "ES6", "ECMAScript"], "weight": 3.0},
    {"name": "TypeScript", "category": "programming_language", "aliases": ["ts"], "weight": 2.5},
    {"name": "Java", "category": "programming_language", "aliases": ["java8", "java11", "java17"], "weight": 3.0},
    {"name": "C#", "category": "programming_language", "aliases": ["csharp", "c-sharp", "dotnet"], "weight": 3.0},
    {"name": "C++", "category": "programming_language", "aliases": ["cpp", "cplusplus"], "weight": 3.0},
    {"name": "Go", "category": "programming_language", "aliases": ["golang"], "weight": 2.5},
    {"name": "Rust", "category": "programming_language", "aliases": [], "weight": 2.5},
    {"name": "Ruby", "category": "programming_language", "aliases": ["rb"], "weight": 2.5},
    {"name": "PHP", "category": "programming_language", "aliases": [], "weight": 2.0},
    {"name": "Swift", "category": "programming_language", "aliases": [], "weight": 2.5},
    {"name": "Kotlin", "category": "programming_language", "aliases": ["kt"], "weight": 2.5},
    {"name": "Scala", "category": "programming_language", "aliases": [], "weight": 2.0},
    {"name": "R", "category": "programming_language", "aliases": ["rlang"], "weight": 2.0},
    {"name": "SQL", "category": "programming_language", "aliases": ["structured query language"], "weight": 2.0},

    # ── Frontend Frameworks ──────────────────────────────────
    # weight: 2.0 for major frameworks, 1.0-1.5 for supplementary
    {"name": "React", "category": "framework", "aliases": ["reactjs", "react.js"], "weight": 2.5},
    {"name": "Next.js", "category": "framework", "aliases": ["nextjs"], "weight": 2.0},
    {"name": "Angular", "category": "framework", "aliases": ["angularjs", "angular.js"], "weight": 2.0},
    {"name": "Vue.js", "category": "framework", "aliases": ["vue", "vuejs"], "weight": 2.0},
    {"name": "Svelte", "category": "framework", "aliases": ["sveltekit"], "weight": 1.5},
    {"name": "TailwindCSS", "category": "framework", "aliases": ["tailwind", "tailwind css"], "weight": 1.0},
    {"name": "Bootstrap", "category": "framework", "aliases": [], "weight": 0.8},
    {"name": "HTML", "category": "framework", "aliases": ["html5"], "weight": 1.0},
    {"name": "CSS", "category": "framework", "aliases": ["css3", "scss", "sass", "less"], "weight": 1.0},

    # ── Backend Frameworks ───────────────────────────────────
    {"name": "FastAPI", "category": "framework", "aliases": ["fast-api"], "weight": 2.0},
    {"name": "Django", "category": "framework", "aliases": ["django rest framework", "drf"], "weight": 2.0},
    {"name": "Flask", "category": "framework", "aliases": [], "weight": 1.5},
    {"name": "Express.js", "category": "framework", "aliases": ["express", "expressjs"], "weight": 2.0},
    {"name": "Spring Boot", "category": "framework", "aliases": ["spring", "spring framework"], "weight": 2.5},
    {"name": "Node.js", "category": "framework", "aliases": ["node", "nodejs"], "weight": 2.0},
    {"name": "ASP.NET", "category": "framework", "aliases": ["asp.net core", "dotnet"], "weight": 2.0},
    {"name": "Ruby on Rails", "category": "framework", "aliases": ["rails", "ror"], "weight": 2.0},
    {"name": "Laravel", "category": "framework", "aliases": [], "weight": 1.5},
    {"name": "GraphQL", "category": "framework", "aliases": ["gql"], "weight": 1.5},
    {"name": "REST API", "category": "framework", "aliases": ["restful", "rest"], "weight": 1.5},

    # ── Databases ────────────────────────────────────────────
    # weight: 1.5-2.0 (important but usually learnable quickly)
    {"name": "PostgreSQL", "category": "database", "aliases": ["postgres", "pg", "psql"], "weight": 2.0},
    {"name": "MySQL", "category": "database", "aliases": ["mariadb"], "weight": 1.5},
    {"name": "MongoDB", "category": "database", "aliases": ["mongo"], "weight": 1.5},
    {"name": "Redis", "category": "database", "aliases": [], "weight": 1.5},
    {"name": "Elasticsearch", "category": "database", "aliases": ["elastic", "es"], "weight": 1.5},
    {"name": "SQLite", "category": "database", "aliases": [], "weight": 0.8},
    {"name": "DynamoDB", "category": "database", "aliases": ["dynamo"], "weight": 1.5},
    {"name": "Cassandra", "category": "database", "aliases": [], "weight": 1.5},
    {"name": "Oracle Database", "category": "database", "aliases": ["oracle", "oracle db"], "weight": 1.5},
    {"name": "Microsoft SQL Server", "category": "database", "aliases": ["mssql", "sql server"], "weight": 1.5},

    # ── DevOps & Cloud ───────────────────────────────────────
    # weight: 2.0-2.5 (high demand, significant learning curve)
    {"name": "Docker", "category": "devops", "aliases": ["docker-compose", "dockerfile"], "weight": 2.5},
    {"name": "Kubernetes", "category": "devops", "aliases": ["k8s", "kube"], "weight": 2.5},
    {"name": "AWS", "category": "devops", "aliases": ["amazon web services", "ec2", "s3", "lambda"], "weight": 2.5},
    {"name": "Azure", "category": "devops", "aliases": ["microsoft azure"], "weight": 2.0},
    {"name": "Google Cloud Platform", "category": "devops", "aliases": ["gcp", "google cloud"], "weight": 2.0},
    {"name": "CI/CD", "category": "devops", "aliases": ["continuous integration", "continuous deployment", "cicd"], "weight": 2.0},
    {"name": "Jenkins", "category": "devops", "aliases": [], "weight": 1.5},
    {"name": "GitHub Actions", "category": "devops", "aliases": ["gh actions"], "weight": 1.5},
    {"name": "GitLab CI", "category": "devops", "aliases": ["gitlab-ci"], "weight": 1.5},
    {"name": "Terraform", "category": "devops", "aliases": ["tf", "iac"], "weight": 2.0},
    {"name": "Ansible", "category": "devops", "aliases": [], "weight": 1.5},
    {"name": "Linux", "category": "devops", "aliases": ["ubuntu", "centos", "rhel", "bash"], "weight": 2.0},
    {"name": "Nginx", "category": "devops", "aliases": [], "weight": 1.0},
    {"name": "Git", "category": "devops", "aliases": ["github", "gitlab", "bitbucket"], "weight": 1.5},

    # ── Data Science & ML ────────────────────────────────────
    # weight: 2.0-3.0 (specialized, hard to acquire quickly)
    {"name": "Machine Learning", "category": "data_science", "aliases": ["ml"], "weight": 3.0},
    {"name": "Deep Learning", "category": "data_science", "aliases": ["dl", "neural networks"], "weight": 2.5},
    {"name": "TensorFlow", "category": "data_science", "aliases": ["tf"], "weight": 2.0},
    {"name": "PyTorch", "category": "data_science", "aliases": ["torch"], "weight": 2.0},
    {"name": "Scikit-learn", "category": "data_science", "aliases": ["sklearn"], "weight": 1.5},
    {"name": "Pandas", "category": "data_science", "aliases": [], "weight": 1.5},
    {"name": "NumPy", "category": "data_science", "aliases": ["numpy"], "weight": 1.0},
    {"name": "Natural Language Processing", "category": "data_science", "aliases": ["nlp"], "weight": 2.5},
    {"name": "Computer Vision", "category": "data_science", "aliases": ["cv", "opencv"], "weight": 2.5},
    {"name": "LLM", "category": "data_science", "aliases": ["large language models", "gpt", "llms"], "weight": 2.5},
    {"name": "Apache Spark", "category": "data_science", "aliases": ["spark", "pyspark"], "weight": 2.0},
    {"name": "Data Engineering", "category": "data_science", "aliases": ["etl", "data pipelines"], "weight": 2.0},

    # ── Architecture & Design ────────────────────────────────
    # weight: 2.0-2.5 (senior-level differentiators)
    {"name": "System Design", "category": "architecture", "aliases": ["systems design", "distributed systems"], "weight": 2.5},
    {"name": "Microservices", "category": "architecture", "aliases": ["micro-services", "service-oriented"], "weight": 2.0},
    {"name": "Event-Driven Architecture", "category": "architecture", "aliases": ["eda", "event driven"], "weight": 2.0},
    {"name": "Domain-Driven Design", "category": "architecture", "aliases": ["ddd"], "weight": 1.5},
    {"name": "Design Patterns", "category": "architecture", "aliases": ["gang of four", "gof"], "weight": 1.5},
    {"name": "API Design", "category": "architecture", "aliases": ["api-first"], "weight": 1.5},

    # ── Testing ──────────────────────────────────────────────
    # weight: 1.0-1.5 (expected but rarely a dealbreaker)
    {"name": "Unit Testing", "category": "testing", "aliases": ["unit tests"], "weight": 1.5},
    {"name": "Integration Testing", "category": "testing", "aliases": ["integration tests"], "weight": 1.5},
    {"name": "Test-Driven Development", "category": "testing", "aliases": ["tdd"], "weight": 1.0},
    {"name": "Jest", "category": "testing", "aliases": [], "weight": 1.0},
    {"name": "Pytest", "category": "testing", "aliases": ["py.test"], "weight": 1.0},
    {"name": "Selenium", "category": "testing", "aliases": [], "weight": 1.0},
    {"name": "Cypress", "category": "testing", "aliases": [], "weight": 1.0},

    # ── Tools & Practices ────────────────────────────────────
    # weight: 0.5-1.0 (nice-to-have, rarely critical)
    {"name": "Agile", "category": "methodology", "aliases": ["scrum", "kanban", "sprint"], "weight": 0.8},
    {"name": "Jira", "category": "tool", "aliases": [], "weight": 0.5},
    {"name": "Confluence", "category": "tool", "aliases": [], "weight": 0.5},

    # ── Soft Skills ──────────────────────────────────────────
    # weight: 0.5-1.0 (important but hard to quantify from a resume)
    {"name": "Leadership", "category": "soft_skill", "aliases": ["team lead", "tech lead"], "weight": 1.0},
    {"name": "Communication", "category": "soft_skill", "aliases": ["written communication", "verbal communication"], "weight": 0.8},
    {"name": "Problem Solving", "category": "soft_skill", "aliases": ["analytical thinking"], "weight": 0.8},
    {"name": "Mentoring", "category": "soft_skill", "aliases": ["coaching", "mentorship"], "weight": 0.7},
    {"name": "Cross-functional Collaboration", "category": "soft_skill", "aliases": ["cross-team", "stakeholder management"], "weight": 0.7},
]


async def seed():
    """Insert all skills into the database. Skips duplicates."""
    async with WriteSession() as session:
        inserted = 0
        skipped = 0
        for skill_data in SKILL_TAXONOMY:
            from sqlalchemy import select
            existing = await session.execute(
                select(Skill).where(Skill.name == skill_data["name"])
            )
            if existing.scalar_one_or_none() is None:
                skill = Skill(**skill_data)
                session.add(skill)
                inserted += 1
            else:
                skipped += 1

        await session.commit()
        print(f"Seed complete: {inserted} skills inserted, {skipped} skipped (already exist)")
        print(f"Total skills in taxonomy: {inserted + skipped}")


if __name__ == "__main__":
    asyncio.run(seed())
