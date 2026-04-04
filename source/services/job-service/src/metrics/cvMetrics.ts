import { Counter, Gauge, Histogram, register } from 'prom-client';

const queueDepthGauge =
  (register.getSingleMetric('cv_processing_queue_depth') as Gauge<string> | undefined) ??
  new Gauge({
    name: 'cv_processing_queue_depth',
    help: 'Number of jobs waiting or delayed in the CV processing queue',
    labelNames: ['queue'],
  });

if (!register.getSingleMetric('cv_processing_queue_depth')) {
  register.registerMetric(queueDepthGauge);
}

const queueDlqCounter =
  (register.getSingleMetric('cv_processing_dlq_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'cv_processing_dlq_total',
    help: 'Number of jobs moved to CV DLQ',
    labelNames: ['reason'],
  });

if (!register.getSingleMetric('cv_processing_dlq_total')) {
  register.registerMetric(queueDlqCounter);
}

const uploadCounter =
  (register.getSingleMetric('cv_upload_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'cv_upload_total',
    help: 'Total CV uploads',
    labelNames: ['status'],
  });

if (!register.getSingleMetric('cv_upload_total')) {
  register.registerMetric(uploadCounter);
}

const uploadSizeHistogram =
  (register.getSingleMetric('cv_upload_size_bytes') as Histogram<string> | undefined) ??
  new Histogram({
    name: 'cv_upload_size_bytes',
    help: 'CV upload file sizes',
    buckets: [50 * 1024, 200 * 1024, 500 * 1024, 1 * 1024 * 1024, 5 * 1024 * 1024, 10 * 1024 * 1024],
  });

if (!register.getSingleMetric('cv_upload_size_bytes')) {
  register.registerMetric(uploadSizeHistogram);
}

const parseDurationHistogram =
  (register.getSingleMetric('cv_parse_duration_seconds') as Histogram<string> | undefined) ??
  new Histogram({
    name: 'cv_parse_duration_seconds',
    help: 'Duration of CV parsing operations',
    buckets: [1, 5, 10, 20, 30, 60],
  });

if (!register.getSingleMetric('cv_parse_duration_seconds')) {
  register.registerMetric(parseDurationHistogram);
}

const parseTotalCounter =
  (register.getSingleMetric('cv_parse_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'cv_parse_total',
    help: 'Count of CV parsing results',
    labelNames: ['status', 'method'],
  });

if (!register.getSingleMetric('cv_parse_total')) {
  register.registerMetric(parseTotalCounter);
}

export function recordCvUpload(status: 'success' | 'failed'): void {
  uploadCounter.labels(status).inc();
}

export function observeCvUploadSize(bytes: number): void {
  uploadSizeHistogram.observe(bytes);
}

export function observeCvParseDuration(seconds: number): void {
  parseDurationHistogram.observe(seconds);
}

export function recordCvParseResult(
  status: 'success' | 'error',
  method: 'text' | 'ocr' | 'openai' | 'gemini',
): void {
  parseTotalCounter.labels(status, method).inc();
}

export function setCvQueueDepth(queueName: string, depth: number): void {
  queueDepthGauge.labels(queueName).set(depth);
}

export function incrementCvDlq(reason: string): void {
  queueDlqCounter.labels(reason).inc();
}
