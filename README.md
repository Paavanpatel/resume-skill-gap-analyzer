# 📋 Resume Skill Gap Analyzer

> **Transform your resume into your competitive advantage.** Get instant AI-powered insights on how well your resume aligns with your dream job, identify missing skills, and unlock a personalized learning roadmap.

<div align="center">

![Project Status](https://img.shields.io/badge/status-production%20ready-success?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Python](https://img.shields.io/badge/python-3.11+-blue?style=flat-square)
![Node.js](https://img.shields.io/badge/node-20%20LTS-green?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ready-2496ed?style=flat-square)

[Live Demo](#-quick-start) • [Features](#-features) • [Architecture](#-architecture) • [Deployment](#-deployment)

</div>

---

## ✨ Features

### 🎯 Smart Resume Analysis
- **Match Score**: Quantified alignment (0–100) between your resume and target job description
- **Skill Breakdown**: Categorized skill analysis (technical, soft skills, domain expertise, certifications)
- **ATS Compatibility**: Scoring for structural elements, keyword density, formatting, and applicant tracking system optimization

### 🚀 AI-Powered Insights
- **Actionable Suggestions**: Hybrid rule-based + LLM-generated improvements for your resume
- **Learning Roadmap**: Prioritized resources and skill development plan for closing gaps
- **Career Advisor**: Personalized narrative guidance powered by advanced language models

### 📊 Professional Outputs
- **PDF Export**: Export your complete analysis report in publication-ready format
- **Analysis History**: Track your progress and compare results across multiple applications
- **Dark Mode**: Comfortable viewing experience in any lighting condition

### 🔐 User Management
- **Secure Authentication**: JWT-based dual-token system with refresh token rotation
- **Flexible Pricing Tiers**: Free tier + Pro features for power users
- **Rate Limiting & Protection**: Built-in security headers and request throttling

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | Next.js 16 + React 19 | Modern, performant UI with App Router |
| **Backend** | FastAPI + Python 3.11 | High-performance async REST API |
| **Database** | PostgreSQL + SQLAlchemy | Reliable data persistence with ORM |
| **AI** | OpenAI + Anthropic APIs | Multi-provider LLM for analysis |
| **File Processing** | PDF/DOCX/TXT Parsing | Resume extraction from multiple formats |
| **Export** | ReportLab | Professional PDF generation |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **Containerization** | Docker + Docker Compose | Consistent development and production |

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Web Browser                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │    Next.js Frontend   │
        │  (React 19 + Tailwind)│
        └──────────┬───────────┘
                   │
         ┌─────────▼─────────┐
         │   REST API (v1)   │
         └─────────┬─────────┘
                   │
        ┌──────────▼──────────────┐
        │   FastAPI Application   │
        │  (Services Architecture)│
        └──────────┬──────────────┘
                   │
        ┌──────────┴──────────────────┬──────────────┐
        │                             │              │
        ▼                             ▼              ▼
   ┌─────────────┐         ┌──────────────────┐  ┌─────────┐
   │ PostgreSQL  │         │  LLM Providers   │  │  File   │
   │  Database   │         │  (OpenAI/Claude) │  │ Storage │
   └─────────────┘         └──────────────────┘  └─────────┘
```

### Core Components

#### 📦 Backend Services
- **Resume Parser**: Extracts text from PDF, DOCX, and TXT files
- **Skill Extractor**: AI-powered skill identification from resumes and job descriptions
- **Gap Analyzer**: Intelligent comparison engine with scoring algorithms
- **ATS Checker**: Structural and formatting compliance analysis
- **PDF Exporter**: Generates professional analysis reports
- **Auth Service**: JWT-based authentication with role management

#### 🎨 Frontend Features
- **Dashboard Wizard**: Step-by-step analysis workflow
- **Results Viewer**: Tabbed interface for viewing analysis results
- **History Dashboard**: Track analyses with filtering, sorting, and comparison
- **Authentication Flows**: Secure login/registration with password strength validation
- **Responsive Design**: Mobile-first approach with Tailwind CSS

---

## 🚀 Quick Start

### Prerequisites

- **Git** (version control)
- **Python 3.11+** (backend runtime)
- **Node.js 20 LTS** (frontend runtime)
- **Docker & Docker Compose** (containerization)
- **PostgreSQL 15+** (database)

### Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/resume-skill-gap-analyzer.git
cd resume-skill-gap-analyzer
```

#### 2. Set Up Environment Variables

**Backend** (`.env`):
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rsga
DATABASE_ECHO=false

# OpenAI API
OPENAI_API_KEY=your_openai_key_here

# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_key_here

# JWT Security
JWT_SECRET_KEY=your-super-secret-key-keep-it-safe
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Application
APP_NAME=Resume Skill Gap Analyzer
APP_ENV=development
DEBUG=true

# CORS
CORS_ORIGINS=["http://localhost:3000"]
```

**Frontend** (`.env.local`):
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Resume Skill Gap Analyzer
```

#### 3. Start with Docker (Recommended)
```bash
# Start all services (PostgreSQL, Redis, Backend, Frontend, Nginx)
docker-compose up -d

# Check logs
docker-compose logs -f

# Access the application
# Frontend: http://localhost:3000
# API Docs: http://localhost:8000/docs
# API Redoc: http://localhost:8000/redoc
```

#### 4. Manual Setup (Local Development)

**Backend Setup**:
```bash
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend Setup**:
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Access at http://localhost:3000
```

---

## 📊 Project Status

### Completed Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Development Environment Setup | ✅ Complete |
| 1 | Database & ORM Layer | ✅ Complete |
| 2 | Authentication System | ✅ Complete |
| 3 | Resume Processing (PDF/DOCX/TXT) | ✅ Complete |
| 4 | AI Integration (OpenAI/Anthropic) | ✅ Complete |
| 5 | Skill Extraction Engine | ✅ Complete |
| 6 | Gap Analysis & ATS Checking | ✅ Complete |
| 7 | Suggestions & Learning Roadmap | ✅ Complete |
| 8 | PDF Export Generation | ✅ Complete |
| 9 | Frontend MVP | ✅ Complete |
| 10-16 | Frontend Enhancement Phases | ✅ Complete |

### Key Metrics

- **Backend Tests**: 365+ unit and integration tests
- **Test Coverage**: Comprehensive across all services
- **API Endpoints**: 20+ REST endpoints with OpenAPI documentation
- **Database Migrations**: 3+ Alembic versions
- **Frontend Components**: 40+ reusable UI components
- **Response Time**: <500ms average for analysis

---

## 🔧 Available Commands

### Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Install local quality tools
pip install pre-commit ruff

# Install git hooks
cd ..
pre-commit install
cd backend

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html

# Format code
ruff check app/ --select I --fix
ruff format app/

# Verify formatting before committing
ruff format --check app/

# Type checking
mypy app/

# Run linter
flake8 app/

# Generate API documentation
# Automatically available at /docs endpoint

# Database migrations
alembic revision --autogenerate -m "Description"
alembic upgrade head
alembic downgrade -1
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Test coverage
npm run test:coverage

# Type checking
npm run type-check

# Format code
npm run format

# Lint code
npm run lint
```

### Docker

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Stop all services
docker-compose down

# Remove volumes (database data)
docker-compose down -v

# Rebuild after dependency changes
docker-compose up -d --build
```

---

## 📁 Project Structure

```
resume-skill-gap-analyzer/
├── backend/                          # FastAPI Application
│   ├── app/
│   │   ├── api/                      # REST endpoint handlers
│   │   ├── services/                 # Business logic (20+ services)
│   │   ├── models/                   # SQLAlchemy ORM models
│   │   ├── schemas/                  # Pydantic request/response models
│   │   ├── repositories/             # Data access layer
│   │   ├── core/                     # Configuration, security, middleware
│   │   └── workers/                  # Celery async tasks
│   ├── tests/                        # 365+ unit/integration tests
│   ├── alembic/                      # Database migrations
│   ├── requirements.txt              # Python dependencies
│   └── main.py                       # FastAPI entry point
│
├── frontend/                         # Next.js 16 Application
│   ├── src/
│   │   ├── app/                      # Next.js App Router pages
│   │   ├── components/               # 40+ React components
│   │   ├── context/                  # React Context (Auth, Theme, Tracker)
│   │   ├── lib/                      # API client, utilities
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── types/                    # TypeScript interfaces
│   │   └── styles/                   # Global styles + Tailwind config
│   ├── jest.config.js                # Jest test configuration
│   ├── tailwind.config.ts            # Tailwind CSS configuration
│   └── package.json                  # Node.js dependencies
│
├── docker-compose.yml                # 5-service orchestration
├── docker-compose.prod.yml           # Production-optimized compose
├── nginx/                            # Nginx reverse proxy config
│
└── documentation/                    # Phase guides and architecture docs
    ├── PRD.md
    ├── PHASE-*.md
    └── TEST_COVERAGE_REPORT.md
```

---

## 🔐 Security Features

### Authentication
- **JWT Tokens**: Secure access and refresh token pattern
- **HttpOnly Cookies**: Protection against XSS attacks
- **Token Rotation**: Automatic refresh token management
- **Password Hashing**: Bcrypt with salt for user passwords

### API Security
- **CORS Protection**: Configurable cross-origin resource sharing
- **Security Headers**: X-Frame-Options, X-Content-Type-Options, CSP
- **Rate Limiting**: Prevent abuse with request throttling
- **Input Validation**: Pydantic schema validation on all endpoints

### Data Protection
- **Environment Variables**: Sensitive keys kept out of version control
- **Database Encryption**: PostgreSQL with SSL support
- **Secure File Storage**: Validated file uploads with virus scanning ready
- **HTTPS Ready**: SSL/TLS configuration in production

---

## 🚀 Deployment

### Docker Production Build

```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Environment Variables for Production

```bash
# Backend
APP_ENV=production
DEBUG=false
DATABASE_URL=postgresql://prod_user:secure_password@prod_db:5432/rsga_prod
JWT_SECRET_KEY=generate-with-openssl-rand-hex-32
CORS_ORIGINS=["https://yourdomain.com"]

# Frontend
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

### Deployment Checklist

- [ ] Set all environment variables for production
- [ ] Run database migrations: `alembic upgrade head`
- [ ] Enable HTTPS with SSL certificates
- [ ] Configure PostgreSQL backup strategy
- [ ] Set up monitoring and logging (Sentry/New Relic)
- [ ] Enable rate limiting on API endpoints
- [ ] Configure CDN for static assets
- [ ] Test backup and disaster recovery procedures

---

## 📚 Documentation

- **[PRD.md](PRD.md)** - Complete product requirements and design decisions
- **[PHASE-0-SETUP.md](PHASE-0-SETUP.md)** - Environment setup guide
- **[PHASE-1-ARCHITECTURE.md](PHASE-1-ARCHITECTURE.md)** - System architecture details
- **[PHASE-3-DATABASE.md](PHASE-3-DATABASE.md)** - Database schema and models
- **[FRONTEND_ENHANCEMENT_PLAN.md](FRONTEND_ENHANCEMENT_PLAN.md)** - UI/UX enhancements
- **[TEST_COVERAGE_REPORT.md](TEST_COVERAGE_REPORT.md)** - Test coverage analysis

API Documentation is available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

---

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/unit/services/test_gap_analyzer.py

# Run tests matching pattern
pytest -k "test_skill_extraction"

# Generate coverage report
pytest --cov=app --cov-report=html --cov-report=term
```

### Frontend Testing

```bash
cd frontend

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm run test:coverage
```

**Current Test Coverage**:
- Backend: 85%+ coverage across core services
- Frontend: Jest configured with 360+ tests
- Integration: E2E flows tested across full stack

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'Add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request with a clear description

### Code Standards

- **Backend**: Ruff formatting and import sorting, mypy, flake8
- **Frontend**: ESLint, Prettier, TypeScript strict mode
- **Commits**: Descriptive messages following Conventional Commits
- **Tests**: Maintain coverage above 80%

### Prevent Formatting Drift

```bash
# One-time setup from the repository root
pip install pre-commit ruff
pre-commit install

# Manual verification before pushing
cd backend
ruff format --check app/
```

If you use VS Code, the workspace includes Ruff format-on-save settings and recommends the Ruff extension. In PyCharm, set Ruff as the formatter or add a File Watcher that runs `ruff format $FilePath$` on Python saves.

---

## 📈 Pricing Tiers

| Tier | Analyses/Month | Resume Upload | ATS Check | Suggestions | Roadmap | Advisor | PDF Export | Price |
|------|---|---|---|---|---|---|---|---|
| **Free** | 5 | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | Free |
| **Pro** | 50 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | $9.99/mo |
| **Enterprise** | Unlimited | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Custom |

---

## 🐛 Troubleshooting

### Common Issues

**PostgreSQL connection error**
```bash
# Check if PostgreSQL is running
docker-compose ps

# View detailed logs
docker-compose logs postgres
```

**API not responding**
```bash
# Check backend container status
docker-compose logs backend

# Verify environment variables
docker-compose config
```

**Frontend build fails**
```bash
# Clear cache and reinstall
rm -rf frontend/node_modules frontend/.next
cd frontend && npm install
```

**LLM API errors**
- Verify API keys are set correctly in `.env`
- Check API usage limits on your accounts
- Ensure rate limits aren't exceeded

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/resume-skill-gap-analyzer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/resume-skill-gap-analyzer/discussions)
- **Email**: support@yourdomain.com

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [FastAPI](https://fastapi.tiangolo.com/), [Next.js](https://nextjs.org/), and [PostgreSQL](https://www.postgresql.org/)
- AI integration powered by [OpenAI](https://openai.com/) and [Anthropic](https://www.anthropic.com/)
- Styling with [Tailwind CSS](https://tailwindcss.com/)
- Icons and inspiration from the open-source community

---

<div align="center">

**[⬆ Back to Top](#-resume-skill-gap-analyzer)**

Made with ❤️ by the development team

</div>
