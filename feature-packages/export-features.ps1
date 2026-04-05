[CmdletBinding()]
param(
  [switch]$SkipClean
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$featuresRoot = $PSScriptRoot

$featureMap = [ordered]@{
  'upload-cv' = @(
    'TEST_CV_FEATURES.md',
    'docs/CV_AI_ANALYSIS_FEATURE.md',
    'docs/CV_AI_ANALYSIS_LOGS.md',
    'docs/FRONTEND_CV_UPDATE_SUMMARY.md',
    'docs/tdd/cv-ocr.md',
    'docs/runbooks/cv-pipeline-runbook.md',
    'docs/runbooks/cv-pipeline-alerts.md',
    'fe/src/pages/CVManagement.tsx',
    'fe/src/services/cvService.ts',
    'fe/src/store/authStore.ts',
    'fe/src/components/Button.tsx',
    'fe/src/components/ParsedCvDisplay.tsx',
    'fe/src/components/CvDetailModal.tsx',
    'services/job-service/src/controllers/candidateCv.controller.ts',
    'services/job-service/src/controllers/cvDownload.controller.ts',
    'services/job-service/src/middlewares/cvUpload.ts',
    'services/job-service/src/middlewares/cvDownloadAuth.ts',
    'services/job-service/src/routes/candidates.routes.ts',
    'services/job-service/src/routes/cv.routes.ts',
    'services/job-service/src/services/cv/cvStorageService.ts',
    'services/job-service/src/services/cv/cvProcessingDispatcher.ts',
    'services/job-service/src/services/cv/cvParserService.ts',
    'services/job-service/src/services/cv/geminiCvAnalysisService.ts',
    'services/job-service/src/services/cv/virusScanService.ts',
    'services/job-service/src/jobs/cvProcessingQueue.ts',
    'services/job-service/src/workers/cvProcessingWorker.ts',
    'services/job-service/src/workers/runCvProcessingWorker.ts',
    'services/job-service/src/metrics/cvMetrics.ts',
    'services/job-service/src/contracts/cv.types.ts',
    'services/job-service/src/contracts/apiSchemas.ts',
    'services/job-service/src/routes/__tests__/candidates.routes.test.ts',
    'services/job-service/src/routes/__tests__/cvContract.test.ts',
    'services/job-service/src/routes/__tests__/cv.routes.test.ts',
    'services/job-service/src/services/cv/__tests__/cvParserService.test.ts',
    'services/job-service/src/services/cv/__tests__/cvStorageService.test.ts',
    'services/job-service/src/e2e/cvHappyPath.test.ts'
  )

  'apply-job' = @(
    'docs/architecture/technical-design.md',
    'docs/architecture/design-decisions.md',
    'docs/EMAIL_SYSTEM.md',
    'docs/SUMMARY_25_11_2025.md',
    'docs/tdd/cv-ocr.md',
    'fe/src/pages/JobDetail.tsx',
    'fe/src/components/Button.tsx',
    'fe/src/services/cvService.ts',
    'fe/src/services/chatService.ts',
    'fe/src/services/jobApi.ts',
    'fe/src/services/jobService.ts',
    'fe/src/store/authStore.ts',
    'fe/src/utils/jobTypeLabels.ts',
    'fe/src/utils/experienceLevelLabels.ts',
    'services/job-service/src/routes/publicJobs.routes.ts',
    'services/job-service/src/controllers/applicationApply.controller.ts',
    'services/job-service/src/services/application.service.ts',
    'services/job-service/src/routes/__tests__/applicationFlow.routes.test.ts',
    'services/job-service/src/services/__tests__/application.service.test.ts'
  )

  'application-history' = @(
    'TEST_CV_FEATURES.md',
    'docs/CV_AI_ANALYSIS_FEATURE.md',
    'docs/EMPLOYER_CHAT_ANALYSIS.md',
    'fe/src/pages/Dashboard.tsx',
    'fe/src/pages/Applications.tsx',
    'fe/src/components/Button.tsx',
    'fe/src/components/CvDetailModal.tsx',
    'fe/src/components/LocationUpdateModal.tsx',
    'fe/src/components/ParsedCvDisplay.tsx',
    'fe/src/services/chatService.ts',
    'fe/src/services/cvService.ts',
    'fe/src/services/jobApi.ts',
    'fe/src/services/jobService.ts',
    'fe/src/services/locationService.ts',
    'fe/src/store/authStore.ts',
    'fe/src/utils/jobTypeLabels.ts',
    'fe/src/utils/experienceLevelLabels.ts',
    'services/job-service/src/routes/candidates.routes.ts',
    'services/job-service/src/routes/employerJobs.routes.ts',
    'services/job-service/src/controllers/candidateApplications.controller.ts',
    'services/job-service/src/controllers/application.controller.ts',
    'services/job-service/src/services/application.service.ts',
    'services/job-service/src/routes/__tests__/applicationFlow.routes.test.ts',
    'services/job-service/src/routes/__tests__/candidates.routes.test.ts'
  )
}

function Export-Feature {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FeatureName,
    [Parameter(Mandatory = $true)]
    [string[]]$RelativeFiles
  )

  $featureDir = Join-Path $featuresRoot $FeatureName
  $sourceDir = Join-Path $featureDir 'source'

  if ((-not $SkipClean) -and (Test-Path $sourceDir)) {
    Remove-Item -Path $sourceDir -Recurse -Force
  }
  New-Item -Path $sourceDir -ItemType Directory -Force | Out-Null

  $uniqueFiles = $RelativeFiles | Sort-Object -Unique
  $normalizedList = $uniqueFiles | ForEach-Object { $_.Replace('\\', '/') }
  $filesListPath = Join-Path $featureDir 'FILES.txt'
  Set-Content -Path $filesListPath -Value ($normalizedList -join "`r`n")

  $copied = 0
  $missing = [System.Collections.Generic.List[string]]::new()

  foreach ($relPath in $uniqueFiles) {
    $normalized = $relPath.Replace('/', '\\')
    $sourcePath = Join-Path $repoRoot $normalized

    if (-not (Test-Path $sourcePath)) {
      $missing.Add($relPath)
      continue
    }

    $destinationPath = Join-Path $sourceDir $normalized
    $destinationFolder = Split-Path -Parent $destinationPath
    New-Item -Path $destinationFolder -ItemType Directory -Force | Out-Null

    Copy-Item -Path $sourcePath -Destination $destinationPath -Force
    $copied++
  }

  [PSCustomObject]@{
    Feature = $FeatureName
    TotalFiles = $uniqueFiles.Count
    CopiedFiles = $copied
    MissingFiles = $missing.Count
    MissingList = $missing
  }
}

$results = foreach ($featureName in $featureMap.Keys) {
  Export-Feature -FeatureName $featureName -RelativeFiles $featureMap[$featureName]
}

$results | ForEach-Object {
  Write-Host "[$($_.Feature)] copied $($_.CopiedFiles)/$($_.TotalFiles) files"
  if ($_.MissingFiles -gt 0) {
    Write-Warning "[$($_.Feature)] missing $($_.MissingFiles) files:"
    $_.MissingList | ForEach-Object { Write-Warning "  - $_" }
  }
}

$manifestPath = Join-Path $featuresRoot 'manifest.json'
$manifestData = [ordered]@{
  generatedAt = (Get-Date).ToString('o')
  repoRoot = $repoRoot
  features = @{}
}

foreach ($featureName in $featureMap.Keys) {
  $manifestData.features[$featureName] = ($featureMap[$featureName] | Sort-Object -Unique)
}

$manifestData | ConvertTo-Json -Depth 8 | Set-Content -Path $manifestPath

Write-Host ''
Write-Host 'Feature export completed.'
Write-Host "Manifest: $manifestPath"
