# CV Pipeline Alert Runbook

## Alert: CV Parse Failure Rate >10% (15m)
- **Metric**: `cv_parse_total`
- **PromQL**:
  ```
  sum(rate(cv_parse_total{status="error"}[15m])) /
  sum(rate(cv_parse_total[15m])) > 0.10
  ```
- **Action**:
  1. Check `cv_processing_worker` logs for recent `cv_processing_failed`.
  2. Inspect cvProcessingQueue DLQ for recurring inputs.
  3. Verify OCR dependencies (`pdftoppm`, `tesseract`) are running.
  4. Restart worker pod if resource exhaustion detected.

## Alert: CV Queue Depth >100 (10m)
- **Metric**: `cv_processing_queue_depth`
- **PromQL**:
  ```
  max_over_time(cv_processing_queue_depth[10m]) > 100
  ```
- **Action**:
  1. Confirm Redis connection and worker health.
  2. Scale worker deployment (`QUEUE_CONCURRENCY` or replicas).
  3. Check upstream upload traffic for spikes.

## Alert: Average Parse Time >45s
- **Metric**: `cv_parse_duration_seconds`
- **PromQL**:
  ```
  histogram_quantile(0.5, sum by (le) (rate(cv_parse_duration_seconds_bucket[15m]))) > 45
  ```
- **Action**:
  1. Inspect worker logs for “cv_processing_completed” duration.
  2. Validate OCR host performance (CPU/memory).
  3. Ensure no large scanned PDFs stuck in OCR (check `cv_processing_queue_depth`).

## Alert: CV DLQ >5 Jobs
- **Metric**: `cv_processing_dlq_total`
- **PromQL**:
  ```
  increase(cv_processing_dlq_total[15m]) > 5
  ```
- **Action**:
  1. Read DLQ job payloads via BullMQ dashboard.
  2. Determine common `errorMessage` in candidate_cv table.
  3. Fix root issue, then requeue jobs manually.

## Escalation
- Contact on-call backend engineer via Slack #oncall-cv.
- If OCR dependency unavailable (tesseract/poppler), notify DevOps to restore base image or service.
