"""
Admin-only system observability endpoints.

  GET /api/v1/metrics          — Prometheus text-format metrics (admin-only)
  GET /api/v1/admin/system/metrics  — JSON metrics summary for the admin UI
  GET /api/v1/admin/system/logs     — Recent in-memory log entries

All /admin/* routes require at least the 'admin' role.
The /metrics route also requires admin to avoid exposing operational data
publicly; configure a Prometheus scrape job with a service-account bearer token
if you want automated collection.
"""

import logging
import time

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse

from app.core.dependencies import require_role
from app.core.log_buffer import LogBuffer
from app.core.metrics import get_metrics_text, REGISTRY

logger = logging.getLogger(__name__)

# ── Prometheus scrape endpoint (admin-only) ──────────────────
metrics_router = APIRouter(tags=["observability"])

_admin = require_role("admin")


@metrics_router.get(
    "/metrics",
    response_class=PlainTextResponse,
    summary="Prometheus metrics",
    dependencies=[Depends(_admin)],
)
async def prometheus_metrics():
    """
    Prometheus exposition format metrics.

    Secured with admin role so operational data isn't exposed publicly.
    Configure Prometheus with a bearer_token matching an admin JWT to scrape.
    """
    body, content_type = get_metrics_text()
    return PlainTextResponse(content=body.decode(), media_type=content_type)


# ── Admin system endpoints ────────────────────────────────────
system_router = APIRouter(prefix="/admin/system", tags=["admin"])

_admin_dep = require_role("admin")


@system_router.get(
    "/metrics",
    summary="JSON metrics summary",
    dependencies=[Depends(_admin_dep)],
)
async def metrics_summary():
    """
    Return a JSON-friendly summary of key Prometheus counters and histograms
    for display in the admin system dashboard.

    Reads current sample values directly from the registry so no Prometheus
    server is required.
    """
    summary: dict = {
        "http": {},
        "analyses": {},
        "llm": {},
        "timestamp": time.time(),
    }

    try:
        for metric in REGISTRY.collect():
            name = metric.name
            # Each metric's .samples is a list of Sample(name, labels, value, ...).
            # metric.name is the BASE metric name (e.g. "rsga_http_request_duration_seconds").
            # sample.name is the FULL sample name (e.g. "rsga_http_request_duration_seconds_count").
            # Counter names include the _total suffix (e.g. "rsga_http_requests_total").

            if name == "rsga_http_requests_total":
                # Only the _total samples carry label dimensions; skip _created samples
                value_samples = [s for s in metric.samples if s.name == name]
                summary["http"]["total_requests"] = int(sum(s.value for s in value_samples))
                # Count by HTTP status class (2xx, 4xx, 5xx, …)
                by_status: dict[str, int] = {}
                for s in value_samples:
                    status = s.labels.get("status", "") or "unknown"
                    cls = f"{status[0]}xx" if status and status[0].isdigit() else "other"
                    by_status[cls] = by_status.get(cls, 0) + int(s.value)
                summary["http"]["by_status_class"] = by_status

            elif name == "rsga_http_request_duration_seconds":
                # Histogram: extract count and sum from sample names within this metric
                count = sum(
                    s.value for s in metric.samples
                    if s.name == f"{name}_count"
                )
                total_sum = sum(
                    s.value for s in metric.samples
                    if s.name == f"{name}_sum"
                )
                if count:
                    summary["http"]["total_timed"] = int(count)
                    summary["http"]["avg_duration_ms"] = round(total_sum / count * 1000, 2)

            elif name == "rsga_analyses_total":
                value_samples = [s for s in metric.samples if s.name == name]
                summary["analyses"]["by_status"] = {
                    s.labels.get("status", "unknown"): int(s.value) for s in value_samples
                }
                summary["analyses"]["total"] = int(sum(s.value for s in value_samples))

            elif name == "rsga_llm_calls_total":
                value_samples = [s for s in metric.samples if s.name == name]
                summary["llm"]["total_calls"] = int(sum(s.value for s in value_samples))
                by_provider: dict[str, int] = {}
                for s in value_samples:
                    p = s.labels.get("provider", "unknown")
                    by_provider[p] = by_provider.get(p, 0) + int(s.value)
                summary["llm"]["by_provider"] = by_provider

            elif name == "rsga_llm_tokens_total":
                value_samples = [s for s in metric.samples if s.name == name]
                summary["llm"]["total_tokens"] = int(sum(s.value for s in value_samples))
    except Exception as exc:
        logger.warning("Failed to read metrics for summary: %s", exc)

    return summary


@system_router.get(
    "/logs",
    summary="Recent log entries",
    dependencies=[Depends(_admin_dep)],
)
async def recent_logs(
    limit: int = Query(default=100, ge=1, le=500),
    level: str = Query(default="INFO", pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$"),
    logger_prefix: str | None = Query(default=None, max_length=100),
):
    """
    Return the most recent *limit* log entries from the in-memory buffer.

    The buffer holds up to 500 records and is cleared on process restart.
    Filter by minimum log level and/or logger name prefix (e.g. 'app.api').
    """
    records = LogBuffer.get_records(
        limit=limit,
        level=level,
        logger_prefix=logger_prefix,
    )
    return {
        "records": records,
        "count": len(records),
        "note": "In-memory buffer; cleared on restart. Max 500 records.",
    }
