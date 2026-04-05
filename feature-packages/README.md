# Feature Packages

This folder groups source files by business feature so each feature can be pushed to GitHub separately.

## Packages

- upload-cv: Candidate CV upload, parsing, storage, and download flow.
- apply-job: Candidate applies to a job and backend validation logic.
- application-history: Candidate/employer application listing, review status, and withdraw flow.

## Structure

Each package contains:

- README.md: feature summary and important endpoints.
- FILES.txt: source file list included in this package.
- source/: copied files with original relative paths.

## Regenerate package files

Run from project root:

```powershell
.\feature-packages\export-features.ps1
```

If you do not want to remove existing source folders before copying:

```powershell
.\feature-packages\export-features.ps1 -SkipClean
```
