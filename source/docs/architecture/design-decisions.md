Retention Dữ Liệu Ứng Tuyển (project_overview.md:54)

Option 1: Giữ đầy đủ dữ liệu trong MySQL + log audit 24 tháng để đáp ứng khiếu nại; sau đó chạy job archive sang cold storage (S3 Glacier/R2 tier).

Email Template & Localization (project_overview.md:27,project_overview.md:53)

Option 1: Lưu template ở repo notification-service (folder templates/, dùng Handlebars/Nunjucks) + JSON cấu hình brand; dễ version control.

Phân Trang/Tìm Kiếm Job (project_overview.md:21-23)

Option 1: Page size mặc định 20 (tối đa 100); cho phép client gửi pageSize trong khoảng 10-50 để phù hợp mobile; filter hỗ trợ tag, salary range, location; sort theo thời gian đăng; áp rate limit theo user/IP.

Quản Lý Refresh Token (project_overview.md:52)

Option 1: Lưu token dạng hashed trong bảng refresh_tokens (MySQL), khóa chính = user + deviceId, có trường revoked_at.

Bảo Mật File CV (project_overview.md:44-46)

Option 1: Chỉ employer liên quan + candidate sở hữu mới tải; Application service kiểm tra quyền rồi yêu cầu File service tạo presigned URL 5 phút.

Rate Limiting & Chống Spam (project_overview.md:35-37)

Option 1: API Gateway áp limit theo IP/user (ví dụ 30 job posts/ngày, 100 applications/ngày) dùng Redis token bucket.

SLA Gửi Email (project_overview.md:27)

Option 1: Retry exponential backoff (3 lần, delay 1s-5s-30s) + lưu queue (BullMQ). Nếu thất bại báo lỗi qua Slack/webhook.

Phân Nhiệm Vụ Admin

Option 3: Chỉ cung cấp CLI/script nội bộ giai đoạn đầu, ghi log thao tác, sau này mới làm UI.

OpenAPI Coverage (project_overview.md:35-38)

Option 1: Mỗi service đều xuất /docs/openapi.json; API Gateway tổng hợp để client tham khảo.

Service Boundaries – File Delete API (project_overview.md:25-26)

Option 1: File service cung cấp DELETE /files/:id; chỉ Application service (hoặc admin) gọi khi ứng tuyển rút/cần purge.

NATS Subject Naming & Versioning (project_overview.md:37)

Option 1: Chuẩn service.domain.event.v1 (ví dụ job.application.submitted.v1), namespace rõ ràng.


-------------------------------------------------------------------------------------------------------------

Data Model

auth-service: users (id, email, password_hash, role, status, created_at, updated_at), refresh_tokens (id, user_id FK→users.id, device_id, token_hash, issued_at, expires_at, revoked_at, user_agent, ip_address), index on (user_id, device_id) and TTL cleanup job respecting 24‑month retention.
profile-service: profiles (id, user_id FK, full_name, phone, years_experience, skills JSON, cv_file_id FK→file_service.files.id, linkedin_url, company_name for employers, location, created_at, updated_at).
job-service: jobs (id, employer_id FK→users.id, title, description, salary_min, salary_max, currency, location, job_type enum, status enum pending/approved/rejected, published_at, expires_at, created_at, updated_at), job_tags (job_id FK, tag), job_audit_logs (id, job_id, action, actor_id, note, created_at).
application-service: applications (id, job_id FK, candidate_id FK→users.id, status enum submitted/reviewed/interview/offer/rejected, cv_file_id FK, cover_letter, created_at, updated_at), application_status_logs (id, application_id FK, status_from, status_to, actor_id, note, created_at).
file-service: files (id, owner_user_id, original_name, mime_type, size_bytes, storage_key, checksum, visibility enum private/internal, created_at, expires_at nullable), file_access_logs (id, file_id FK, actor_id, action enum upload/download/delete, ip_address, user_agent, created_at).
notification-service: email_templates (id, template_key, subject, body_html, body_text, locale, brand_config JSON, updated_at), email_outbox (id, recipient_email, template_key, payload JSON, status enum pending/sent/failed, last_error, attempt_count, last_attempt_at, created_at, updated_at).
API & Gateway

API Gateway exposes /api/v1/*, handles auth, rate limiting, forwards to services via internal URLs; OpenAPI served from /api/docs/{service} aggregating service specs.
Auth: POST /api/v1/auth/register, POST /api/v1/auth/login, POST /api/v1/auth/refresh, POST /api/v1/auth/logout; requests validated with Zod, errors using code AUTH_INVALID_CREDENTIALS, AUTH_TOKEN_REVOKED.
Profile: GET/PUT /api/v1/profiles/me, employer company profile PUT /api/v1/profiles/company; uses bearer JWT.
Job: POST /api/v1/jobs (employer), GET /api/v1/jobs (query page, pageSize 10-50 default20, tag, location, salaryMin, salaryMax, keyword), GET /api/v1/jobs/:id, PATCH /api/v1/jobs/:id/status (admin via CLI for now).
Application: POST /api/v1/jobs/:id/applications, GET /api/v1/applications/mine, employer GET /api/v1/jobs/:id/applications, PATCH /api/v1/applications/:id/status.
File: POST /api/v1/files/presign-upload, GET /api/v1/files/:id/download (gateway first calls Application service to verify rights), DELETE /api/v1/files/:id invoked by Application/Admin.
Notification: internal POST /internal/notifications/email (gateway-protected with service token) for future use; currently triggered via events.
Events & Queues

NATS subjects (publisher → subscribers): auth.user.registered.v1 (Auth → Profile, Notification), job.created.v1 (Job → Notification), job.status.changed.v1 (Job → Notification), application.submitted.v1 (Application → Notification, Job), application.status.changed.v1 (Application → Notification), file.deleted.v1 (File → Application). Payload includes IDs, timestamps, metadata version field.
BullMQ queues (Redis): email.dispatch (Notification worker, retry 1s → 5s → 30s, DLQ email.dispatch.dead), application.audit (writes status logs if async needed), file.cleanup (purge stale presigned metadata).
Business Flows

Registration: Client → Gateway /auth/register → Auth persists user, issues tokens, publishes auth.user.registered.v1; Profile creates default profile; Notification enqueues welcome email.
Job Posting: Employer → Gateway /jobs → Job service stores pending job, audit log, publishes job.created.v1; admin CLI approves job (updates status, emits job.status.changed.v1, triggers email).
Application Submit: Candidate requests presigned upload → File service returns URL; candidate uploads, then POST /applications -> Application validates job, links file, logs status, publishes application.submitted.v1; Notification enqueues email to employer.
Status Update: Employer/Admin PATCH -> Application updates status, logs change, publishes application.status.changed.v1; Notification sends email to candidate.
File Download/Delete: Client requests download → Gateway verifies via Application service; File service issues presigned URL (5 minutes), logs access. Delete initiated by Application or admin triggers File service removal, emits event for audit.
Security & Rate Limiting

JWT RS256 access tokens (15m) with refresh tokens hashed in MySQL (Option 1) stored per device_id, TTL 30 days, revoke sets revoked_at.
RBAC roles: candidate, employer, admin; CLI requires admin service token.
Rate limits at Gateway using Redis token bucket: login/register 10/min/IP, job post 30/day per employer, applications 100/day per candidate, file downloads 60/hour per user.
File access restricted via Application service authorization; presigned URL expires 5 minutes, includes signature and request id, logs all downloads.
Password hashing bcrypt cost 12; validation with Zod; all services enforce TLS (assumed in deployment).
Observability & Operations

Logging: Pino JSON with fields timestamp, service, level, msg, requestId, userId, route, statusCode.
Metrics: prom-client counters/gauges/histograms e.g. http_request_duration_seconds, queue_jobs_in_flight, emails_failed_total, file_downloads_total.
Health: GET /health checks DB, Redis, NATS connectivity; returns component statuses.
Config: .env managed per service (DB DSN, NATS URL, JWT keys, R2 credentials, SMTP/MailHog). Secrets stored locally via .env but flagged to migrate to vault when production-ready.
Seed Data

Script (Prisma seed) creates admin user, sample employer with company profile, 2 candidate profiles, initial job postings with tags, sample applications, default email templates (welcome, job-created, application-submitted/status-change).
Admin CLI (Initial)

Commands (Node script under admin-cli/): approve-job <jobId>, reject-job <jobId>, ban-employer <userId>, list-applications --job <jobId>, resend-email <emailOutboxId>, purge-file <fileId>.
Requires admin JWT or .env token; all actions log to admin_actions (timestamp, actor, command, payload).
Outputs JSON to stdout for audit trail; future work to wrap with TUI or portal.
--------------------------------------------------------------------------------
Bước 1 – Xác định phạm vi: Chốt những tính năng Auth cần mô tả trong TDD: đăng ký, đăng nhập, refresh token, logout, revoke theo device, quản lý role, event auth.user.registered.v1, rate limit login/register.

Bước 2 – Gom yêu cầu: Lấy nội dung từ todo.md:1 (Auth requirements), ans.md (các Option đã chọn về refresh token, rate limit, bảo mật), docs/technical-design.md phần Auth (data model, API, flow). Ghi lại đầy đủ để tránh sót.

Bước 3 – Tạo file: Mở docs/ và tạo file mới, ví dụ docs/tdd/auth-service.md.

Bước 4 – Điền cấu trúc TDD theo rule:

Overview – tóm tắt vai trò của Auth service.
Requirements
Functional: liệt kê user story cho từng API (đăng ký, đăng nhập, refresh, logout, event).
Non-Functional: bảo mật RS256, rate limit 10/min, latency mục tiêu, audit log, compliance.
Technical Design
Data Model Changes: chi tiết bảng users, refresh_tokens, index, migration cần.
API Changes: mô tả từng endpoint (method, path, auth, request/response JSON, mã lỗi).
UI Changes: không có (ghi rõ).
Logic Flow: sequence cho register/login/refresh/logout, event bus publish.
Dependencies: bcrypt, jsonwebtoken, jose, Prisma, NATS, Redis (nếu dùng rate limit).
Security Considerations: hashing, JWT lifespan, storage token, revocation, validation.
Performance & Reliability: rate limit, caching (nếu có), retry cho event publish (nếu cần).
Observability & Operations: log trường gì, metrics (đăng nhập lỗi/success), /health check.
Testing Plan: unit test service, integration test route với Supertest, mock NATS, seed user admin, kiểm tra rate limit.
Open Questions: ví dụ quy tắc password complexity, account lockout khi sai nhiều lần (nếu chưa quyết).
Alternatives Considered: các phương án đã loại (Redis lưu token, stateless JTI…).
Bước 5 – Rà soát: Đảm bảo số liệu khớp với TDD tổng, không sót flow; cập nhật TDD tổng nếu bạn bổ sung quyết định mới.

Bước 6 – Sẵn sàng cho Task Breakdown: Khi TDD Auth hoàn tất, dùng rule task-breakdown để sinh checklist implement.

-----------------------------
A (tích hợp SMTP gửi OTP trong Auth):
1) Thêm biến môi trường:
SMTP_HOST, SMTP_PORT, SMTP_SECURE=true|false, SMTP_USER, SMTP_PASS, SMTP_FROM
2) Cài thư viện gửi mail (Nodemailer).
3) Viết src/infra/email/smtpMailer.ts (khởi tạo transporter từ .env, hàm sendVerificationEmail({to, code, userId, locale})).
4) Sửa emailVerificationWorker.ts:
Bỏ gọi notificationClient.
Gọi smtpMailer.sendVerificationEmail(...).
Giữ cơ chế retry/backoff của BullMQ.
5) Cập nhật .env dev bằng thông tin SMTP của bạn.
C (thêm API xác minh OTP):
1) Thêm Zod schema:
verifyEmailRequestSchema: { email: string, code: string }
2) Route:
POST /api/v1/auth/verify-email trong routes/auth.routes.ts.
3) Controller:
Validate payload, gọi service.
4) Service auth.service.ts:
Tìm user theo email; lấy email_verifications theo user.id.
Kiểm tra expiresAt.
So sánh sha256(code) với code_hash.
Nếu khớp: cập nhật users.email_verified=true, verified_at=now(), xóa (hoặc vô hiệu) bản ghi email_verifications.
Trả 200. Nếu sai/hết hạn, trả lỗi phù hợp.
5) Cập nhật OpenAPI với endpoint mới.