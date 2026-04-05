# application-history

Feature scope:

- Candidate views own application history.
- Candidate views application detail and withdraws application.
- Employer lists applications by job and reviews CV status.

Main API endpoints:

- GET /api/candidates/me/applications
- GET /api/candidates/me/applications/:applicationId
- DELETE /api/candidates/me/applications/:applicationId
- GET /api/jobs/:jobId/applications
- POST /api/jobs/:jobId/applications/:applicationId/decision

Notes:

- File list is in FILES.txt.
- Copied source files are in source/.
