import { Counter, Histogram, Gauge, register } from 'prom-client';

const createdCounter =
  (register.getSingleMetric('job_post_created_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'job_post_created_total',
    help: 'Total job submissions received',
    labelNames: ['source'],
  });

if (!register.getSingleMetric('job_post_created_total')) {
  register.registerMetric(createdCounter);
}

const approvalCounter =
  (register.getSingleMetric('job_post_approved_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'job_post_approved_total',
    help: 'Total job approvals (auto/admin)',
    labelNames: ['channel'],
  });

if (!register.getSingleMetric('job_post_approved_total')) {
  register.registerMetric(approvalCounter);
}

const rejectionCounter =
  (register.getSingleMetric('job_post_rejected_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'job_post_rejected_total',
    help: 'Total job rejections (auto/admin)',
    labelNames: ['channel'],
  });

if (!register.getSingleMetric('job_post_rejected_total')) {
  register.registerMetric(rejectionCounter);
}

const updateDuration =
  (register.getSingleMetric('job_post_update_duration_seconds') as Histogram<string> | undefined) ??
  new Histogram({
    name: 'job_post_update_duration_seconds',
    help: 'Duration of job update operations',
    labelNames: ['result'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

if (!register.getSingleMetric('job_post_update_duration_seconds')) {
  register.registerMetric(updateDuration);
}

const rateLimitCounter =
  (register.getSingleMetric('job_post_rate_limit_hits_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'job_post_rate_limit_hits_total',
    help: 'Rate limit hits for job submissions',
    labelNames: ['namespace'],
  });

if (!register.getSingleMetric('job_post_rate_limit_hits_total')) {
  register.registerMetric(rateLimitCounter);
}

const workerRetryGauge =
  (register.getSingleMetric('job_post_worker_active_retries') as Gauge<string> | undefined) ??
  new Gauge({
    name: 'job_post_worker_active_retries',
    help: 'Number of worker retries in progress',
  });

if (!register.getSingleMetric('job_post_worker_active_retries')) {
  register.registerMetric(workerRetryGauge);
}

const searchRequestCounter =
  (register.getSingleMetric('job_search_requests_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'job_search_requests_total',
    help: 'Total public job search requests',
    labelNames: ['result'],
  });

if (!register.getSingleMetric('job_search_requests_total')) {
  register.registerMetric(searchRequestCounter);
}

const searchLatencyHistogram =
  (register.getSingleMetric('job_search_latency_seconds') as Histogram<string> | undefined) ??
  new Histogram({
    name: 'job_search_latency_seconds',
    help: 'Latency distribution for job search requests',
    labelNames: ['result'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

if (!register.getSingleMetric('job_search_latency_seconds')) {
  register.registerMetric(searchLatencyHistogram);
}

const searchCacheCounter =
  (register.getSingleMetric('job_search_cache_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'job_search_cache_total',
    help: 'Cache hits/misses for job search responses',
    labelNames: ['status'],
  });

if (!register.getSingleMetric('job_search_cache_total')) {
  register.registerMetric(searchCacheCounter);
}

const recommendationCounter =
  (register.getSingleMetric('job_recommendations_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'job_recommendations_total',
    help: 'Number of recommendation requests by result and reason',
    labelNames: ['result', 'reason'],
  });

if (!register.getSingleMetric('job_recommendations_total')) {
  register.registerMetric(recommendationCounter);
}

const recommendationLatency =
  (register.getSingleMetric('job_recommendations_latency_seconds') as Histogram<string> | undefined) ??
  new Histogram({
    name: 'job_recommendations_latency_seconds',
    help: 'Latency distribution for recommendation responses',
    labelNames: ['result'],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
  });

if (!register.getSingleMetric('job_recommendations_latency_seconds')) {
  register.registerMetric(recommendationLatency);
}

export function recordJobCreated(source: 'create' | 'update'): void {
  try {
    createdCounter.labels(source).inc();
  } catch {}
}

export function recordJobApproved(channel: 'auto' | 'admin'): void {
  try {
    approvalCounter.labels(channel).inc();
  } catch {}
}

export function recordJobRejected(channel: 'auto' | 'admin'): void {
  try {
    rejectionCounter.labels(channel).inc();
  } catch {}
}

export function observeJobUpdateDuration(result: 'success' | 'error', durationSeconds: number): void {
  try {
    updateDuration.labels(result).observe(durationSeconds);
  } catch {}
}

export function recordJobRateLimitHit(namespace: string): void {
  try {
    rateLimitCounter.labels(namespace).inc();
  } catch {}
}

export function setWorkerRetries(value: number): void {
  try {
    workerRetryGauge.set(value);
  } catch {}
}

export function recordSearchRequest(result: 'success' | 'error'): void {
  try {
    searchRequestCounter.labels(result).inc();
  } catch {}
}

export function observeSearchLatency(result: 'success' | 'error', durationSeconds: number): void {
  try {
    searchLatencyHistogram.labels(result).observe(durationSeconds);
  } catch {}
}

export function recordSearchCache(status: 'hit' | 'miss'): void {
  try {
    searchCacheCounter.labels(status).inc();
  } catch {}
}

export function recordRecommendationsOutcome(result: 'success' | 'error', reason: string): void {
  try {
    recommendationCounter.labels(result, reason).inc();
  } catch {}
}

export function observeRecommendationLatency(result: 'success' | 'error', durationSeconds: number): void {
  try {
    recommendationLatency.labels(result).observe(durationSeconds);
  } catch {}
}

