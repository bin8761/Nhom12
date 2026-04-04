# apply-job

Feature scope:

- Candidate applies to a public job.
- Duplicate/self-apply/job-state validation.
- CV prerequisite checks before apply.
- Application creation and notification trigger.

Main API endpoints:

- POST /api/public-jobs/:jobId/apply
- GET /api/public-jobs/:jobId

Notes:

- File list is in FILES.txt.
- Copied source files are in source/.
