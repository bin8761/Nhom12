# upload-cv

Feature scope:

- Candidate uploads CV (PDF).
- CV file validation, virus scan, and storage.
- Async CV parsing + AI analysis pipeline.
- Candidate CV retrieval and signed download link.

Main API endpoints:

- POST /api/candidates/:candidateId/cv
- GET /api/candidates/me/cv
- DELETE /api/candidates/me/cv
- GET /api/cv/download?token=...

Notes:

- File list is in FILES.txt.
- Copied source files are in source/.
