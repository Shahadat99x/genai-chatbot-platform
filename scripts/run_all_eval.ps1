# Run Full Evaluation Suite

param (
    [string]$ApiBase = "http://127.0.0.1:8000",
    [int]$Limit = 0
)

Write-Host "Starting Evaluation Suite..." -ForegroundColor Cyan

# 1. Run Eval
Write-Host "Running 80+ prompts against Baseline, RAG, and RAG+Safety..."
$RunScript = Join-Path (Get-Location) "scripts\run_eval.py"

$ArgsList = @("--api-base", $ApiBase)
if ($Limit -gt 0) {
    Write-Host "Limiting to $Limit prompts per mode."
    $ArgsList += "--limit"
    $ArgsList += "$Limit"
}

python $RunScript @ArgsList

if ($LASTEXITCODE -ne 0) {
    Write-Error "Evaluation run failed. Check logs."
    exit 1
}

# 2. Find latest run
$EvalResults = Join-Path (Get-Location) "eval\results"
$LatestRun = Get-ChildItem -Path $EvalResults -Directory | Sort-Object CreationTime -Descending | Select-Object -First 1

if (-not $LatestRun) {
    Write-Error "No results found."
    exit 1
}

Write-Host "Latest Run: $($LatestRun.FullName)" -ForegroundColor Green

# 3. Summarize
Write-Host "Generating Summary..."
$SumScript = Join-Path (Get-Location) "scripts\summarize_eval.py"
python $SumScript --run "$($LatestRun.FullName)"

Write-Host "Done!" -ForegroundColor Cyan


