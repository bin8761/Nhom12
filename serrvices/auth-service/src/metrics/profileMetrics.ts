import { Counter, Histogram, register } from 'prom-client';

const profileFetchCounter =
  (register.getSingleMetric('profile_fetch_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'profile_fetch_total',
    help: 'Total number of profile fetch operations',
    labelNames: ['role', 'status'],
  });

if (!register.getSingleMetric('profile_fetch_total')) {
  register.registerMetric(profileFetchCounter);
}

const profileUpdateCounter =
  (register.getSingleMetric('profile_update_total') as Counter<string> | undefined) ??
  new Counter({
    name: 'profile_update_total',
    help: 'Total number of profile update attempts',
    labelNames: ['role', 'status'],
  });

if (!register.getSingleMetric('profile_update_total')) {
  register.registerMetric(profileUpdateCounter);
}

const profileUpdateDurationHistogram =
  (register.getSingleMetric('profile_update_duration_seconds') as Histogram<string> | undefined) ??
  new Histogram({
    name: 'profile_update_duration_seconds',
    help: 'Profile update duration in seconds',
    labelNames: ['role', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

if (!register.getSingleMetric('profile_update_duration_seconds')) {
  register.registerMetric(profileUpdateDurationHistogram);
}

export function recordProfileFetch(role: 'CANDIDATE' | 'EMPLOYER', status: 'hit' | 'miss' | 'forbidden' | 'error'): void {
  try {
    profileFetchCounter.labels(role, status).inc();
  } catch {
    // Swallow metrics errors
  }
}

export function recordProfileUpdate(role: 'CANDIDATE' | 'EMPLOYER', status: 'success' | 'noop' | 'error', durationSeconds: number): void {
  try {
    profileUpdateCounter.labels(role, status).inc();
    profileUpdateDurationHistogram.labels(role, status).observe(durationSeconds);
  } catch {
    // Swallow metrics errors
  }
}
