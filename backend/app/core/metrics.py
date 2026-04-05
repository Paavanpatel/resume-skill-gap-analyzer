"""
Prometheus metrics registry.

All application metrics are defined here as module-level singletons so
they can be imported and incremented from anywhere (middleware, services,
workers) without instantiation overhead.

Naming follows Prometheus conventions:
  <namespace>_<subsystem>_<name>_<unit>
  e.g.  rsga_http_request_duration_seconds

The custom REGISTRY isolates our metrics from the default CollectorRegistry
so that the default Python process metrics (gc, process, etc.) are not
included unless explicitly desired.

Usage:
    from app.core.metrics import http_requests_total, llm_calls_total

    http_requests_total.labels(method="GET", path="/api/v1/health", status="200").inc()
    llm_calls_total.labels(provider="openai", model="gpt-4o", status="success").inc()
"""

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
)

# Isolated registry — does not include default Python process metrics
REGISTRY = CollectorRegistry(auto_describe=True)

# ── HTTP request metrics ─────────────────────────────────────

http_requests_total = Counter(
    "rsga_http_requests_total",
    "Total HTTP requests processed",
    ["method", "path", "status"],
    registry=REGISTRY,
)

http_request_duration_seconds = Histogram(
    "rsga_http_request_duration_seconds",
    "HTTP request latency in seconds",
    ["method", "path"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
    registry=REGISTRY,
)

# ── Analysis pipeline metrics ────────────────────────────────

analysis_total = Counter(
    "rsga_analyses_total",
    "Total analysis jobs by outcome",
    ["status"],  # submitted | completed | failed
    registry=REGISTRY,
)

analysis_duration_seconds = Histogram(
    "rsga_analysis_duration_seconds",
    "End-to-end analysis processing time in seconds",
    ["provider"],  # openai | anthropic | unknown
    buckets=[1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0],
    registry=REGISTRY,
)

# ── LLM call metrics ─────────────────────────────────────────

llm_calls_total = Counter(
    "rsga_llm_calls_total",
    "Total LLM API calls made",
    ["provider", "model", "status"],  # status: success | error | fallback
    registry=REGISTRY,
)

llm_tokens_total = Counter(
    "rsga_llm_tokens_total",
    "Cumulative LLM tokens consumed",
    ["provider", "model", "type"],  # type: input | output
    registry=REGISTRY,
)


def get_metrics_text() -> tuple[bytes, str]:
    """Return (body_bytes, content_type) in Prometheus exposition format."""
    return generate_latest(REGISTRY), CONTENT_TYPE_LATEST
