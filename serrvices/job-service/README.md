# Job Service

Service responsible for employer job postings, approval workflows, and associated background processing.

## Environment Variables

All variables below are read from `.env` (see `.env.example` for defaults):

| Variable | Description |
| --- | --- |
| `PORT` | HTTP port (default `4001`). |
| `DATABASE_URL` | Prisma connection string for the Job Service database. |
| `REDIS_URL` | Primary Redis connection used for rate limiting. |
| `BULLMQ_REDIS_URL` | Dedicated Redis for BullMQ queues/workers. |
| `JWT_PUBLIC_KEY` | Public key for verifying Auth Service JWTs. |
| `MAIL_SERVICE_URL` / SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) | Used by `sendJobApprovedEmail`/`sendJobRejectedEmail`. |
| `STORAGE_JOB_IMAGES_DIR` | Absolute/relative path for storing uploaded job images (default `storage/job-images`). |
| `JOB_RATE_LIMIT_MAX_SUBMISSIONS` | Maximum job submissions per employer within the sliding window (default `5`). |
| `JOB_RATE_LIMIT_WINDOW_MINUTES` | Window size in minutes for the submission limiter (default `10`). |

## Rate Limit Configuration

- `/api/jobs` POST uses a Redis sliding-window limiter keyed by employer id.
- Limit: `JOB_RATE_LIMIT_MAX_SUBMISSIONS` per `JOB_RATE_LIMIT_WINDOW_MINUTES`.
- Exceeding the limit returns `429` with `Retry-After`.

## Image Storage

- Files uploaded via `multer` are saved to `STORAGE_JOB_IMAGES_DIR/<jobId>/`.
- Service enforces allowed MIME types + max size from `loadAppConfig().storage`.
- When jobs/images are deleted, files are removed and empty directories cleaned up (see `ImageStorageService`).
- Ensure the `storage` directory is writable in your environment (Docker volume or local path).

## BullMQ Worker Deployment

Worker: `src/jobs/jobApprovalWorker.ts`

1. Requires access to `BULLMQ_REDIS_URL` and the same `.env` as the API (DB, mailer, NATS).
2. Either run within the API process (current `index.ts` bootstraps it) or deploy as a standalone worker process by importing `initJobApprovalWorker`.
3. Metrics:
   - Auto-approval publishes `job.approved.v1` and emails employer.
   - Failures after retries are routed to `jobApprovalQueue:dlq`.
4. When scaling horizontally, ensure only one worker instance handles a job (BullMQ deduplicates per job id).

Shutdown sequence (handled by `shutdownJobApprovalWorker`):

- Close worker + DLQ to flush pending jobs.
- Close Redis connections if running in a standalone worker.

## Local Development

```bash
pnpm install
pnpm dev        # starts API + worker (ts-node-dev)
pnpm test       # runs Jest suites (unit + Supertest + worker integration)
```

## Location Data & Seeding

1. Run the Prisma migration that introduces location metadata (new `Job` fields + reference tables).  
   ```bash
   pnpm prisma:migrate
   ```
   _Lưu ý_: mình không chạy lệnh này giúp bạn; hãy thực thi trong môi trường của bạn để đảm bảo DB cập nhật đúng.
2. Seed dữ liệu tỉnh/thành + quận/huyện từ `prisma/seed/locations.json` (có thể chỉnh sửa/ mở rộng).  
   ```bash
   pnpm seed:locations
   ```
   Script sử dụng upsert nên có thể chạy nhiều lần (idempotent). Sau khi seed, nên kiểm tra số lượng record bằng Prisma Studio hoặc query trực tiếp để đảm bảo dữ liệu đã nạp thành công.
3. Khi cập nhật danh mục, chỉ cần cập nhật file JSON và chạy lại script. Đừng quên commit cả dữ liệu và hướng dẫn nếu có thay đổi đáng kể.

## Public Search Cache

- API `/api/public/jobs/search` hỗ trợ cache trong Redis với TTL cấu hình qua `JOB_SEARCH_CACHE_TTL_SECONDS` (mặc định 30 giây).  
- Cache key bao gồm bộ filter và `job.updatedAt` gần nhất; mỗi khi job được tạo/cập nhật, dịch vụ sẽ tự động cập nhật freshness token để cache invalid ngay lập tức.  
- Đặt `JOB_SEARCH_CACHE_TTL_SECONDS=0` nếu muốn tắt cache (ví dụ môi trường local).
- Biến `LOCATION_SEED_VERSION` giúp theo dõi phiên bản dataset hiện tại; tăng giá trị này khi seed danh mục mới để dễ audit.
- Để buộc reindex lại search cache sau khi seed, có thể gọi `POST /internal/jobs/reindex-search` (đính kèm header secret) hoặc clear key `job-search:*` trong Redis.
- FE dropdown cần gọi `GET /api/public/locations/provinces` và `/districts` (có caching nhẹ) để luôn đồng bộ dữ liệu seeding.

## Sample Data Seeding

- Chạy `pnpm seed:sample` để thêm vài bản ghi demo cho `Candidate`, `Job`, `CandidateCv`, `Application`.  
- Script dùng `upsert` nên có thể chạy nhiều lần; đảm bảo đã chạy `seed:locations` trước đó để Job tham chiếu đúng `provinceCode/districtCode`.

## References

- API overview: `docs/job-service-api.md`
- OpenAPI spec: `docs/openapi/job-service.openapi.yaml`
- JSON contracts: `src/contracts/job.contract.ts`

## Candidate Recommendations Rollout

## Candidate Recommendations Rollout

### API usage
1. **Set preferred location** (`PUT /api/candidates/me/location`)
   ```bash
   curl -X PUT "$JOB_SERVICE_URL/api/candidates/me/location" \
     -H "Authorization: Bearer $CANDIDATE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "provinceCode": "VN-HCM",
       "districtCode": "VN-HCM-THU-DUC-AN-KHANH",
       "addressLine": "12 Nguyen Dinh Chieu",
       "note": "Prefer remote"
     }'
   ```
2. **Fetch recommendations** (`GET /api/candidates/me/recommendations?limit=10&sort=publishedAt_desc`)
   ```bash
   curl "$JOB_SERVICE_URL/api/candidates/me/recommendations?limit=10&sort=publishedAt_desc" \
     -H "Authorization: Bearer $CANDIDATE_TOKEN"
   ```
   Response contains `data: JobSummary[]` v� `meta { limit, sort, filters, reason }`. N?u candidate ch�a l�u location s? tr? `reason = "missing_location"`.

Postman collection: `docs/postman/job-service.postman_collection.json` (�? c� c? request location + recommendation). Import v� g�n bi?n `candidate_access_token`.

### Rollout checklist
1. **Apply migration** `20251201001_add_candidate_location_prefs` tr�n job-service DB tr�?c khi deploy API.
2. **Seed v� ki?m tra location catalog** (`pnpm seed:locations` n?u c?n) �? �?m b?o m? t?nh/qu?n t?n t?i cho UI v� validation.
3. **Config rate limiter**
   - `candidateRecommendationRateLimiter`: gi?i h?n 30 requests/ph�t/candidateId (m?c �?nh). �i?u ch?nh b?ng code n?u c?n.
4. **Metrics & Monitoring**
   - Prometheus metrics: `job_recommendations_total{result,reason}`, `job_recommendations_latency_seconds{result}`.
   - Logs: `job_recommendations_request` & `job_recommendations_error` ch?a candidateId, filters, duration.
   - Add dashboards/alerts: theo d?i error spikes v� latency p95.
5. **Warm-up cache** (optional): sau khi deploy c� th? �? ng�?i d�ng th?c hi?n request b?nh th�?ng; cache TTL m?c �?nh 30s n�n kh�ng c?n thao t�c th�m.
6. **Communication**: th�ng b�o cho FE/mobile team v? params `limit`/`sort` v� c�c reason (district/province/global/missing_location) �? h? x? l? UI ph� h?p.
