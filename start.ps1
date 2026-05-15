#Requires -Version 5.1
<#
.SYNOPSIS
    venOM — one-command startup for Windows.

.DESCRIPTION
    First run: installs Python venv + frontend node_modules (one-time, ~1-2 min).
    Subsequent runs: just boots both services in ~3 seconds.

.EXAMPLE
    .\start.ps1

.NOTES
    Stop: Ctrl+C (kills both services cleanly).
    If PowerShell blocks the script with "running scripts is disabled":
       Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
#>

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

# ---- pretty output --------------------------------------------------------
function Say  ($msg) { Write-Host "✦ $msg" -ForegroundColor Green }
function Step ($msg) { Write-Host "→ $msg" -ForegroundColor Yellow }
function Fail ($msg) { Write-Host "✗ $msg" -ForegroundColor Red; exit 1 }

# ---- prereq check ---------------------------------------------------------
Say "venOM startup"

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $python) { Fail "Python 3 not found. Install from https://python.org (3.10+ required)." }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js not found. Install from https://nodejs.org (18+ required)."
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail "npm not found (it should ship with Node.js)."
}

# ---- backend setup --------------------------------------------------------
$venvDir    = Join-Path $PSScriptRoot "backend\.venv"
$venvPython = Join-Path $venvDir "Scripts\python.exe"

if (-not (Test-Path $venvPython)) {
    Step "Creating Python venv (one-time)…"
    & $python.Source -m venv $venvDir
}

Step "Ensuring backend dependencies…"
& $venvPython -m pip install --upgrade pip --quiet
& $venvPython -m pip install -q -r (Join-Path $PSScriptRoot "backend\requirements.txt")

# ---- frontend setup -------------------------------------------------------
if (-not (Test-Path (Join-Path $PSScriptRoot "frontend\node_modules"))) {
    Step "Installing frontend dependencies (one-time, ~1 min)…"
    Push-Location (Join-Path $PSScriptRoot "frontend")
    try { & npm install --silent --no-fund --no-audit }
    finally { Pop-Location }
}

# ---- launch both services -------------------------------------------------
Write-Host ""
Say   "Starting services. Ctrl+C stops both."
Write-Host "  Backend  →" -NoNewline; Write-Host " http://localhost:8000" -ForegroundColor DarkGray -NoNewline; Write-Host "  (Swagger: /docs)"
Write-Host "  Frontend →" -NoNewline; Write-Host " http://localhost:5173" -ForegroundColor DarkGray
Write-Host ""

# Spawn both as child processes in the same console (output interleaves)
$backend = Start-Process `
    -FilePath $venvPython `
    -ArgumentList "-m","uvicorn","main:app","--reload","--port","8000" `
    -WorkingDirectory (Join-Path $PSScriptRoot "backend") `
    -NoNewWindow -PassThru

$frontend = Start-Process `
    -FilePath "npm.cmd" `
    -ArgumentList "run","dev" `
    -WorkingDirectory (Join-Path $PSScriptRoot "frontend") `
    -NoNewWindow -PassThru

# Auto-open browser after a short delay (fire-and-forget)
Start-Job -ScriptBlock {
    Start-Sleep -Seconds 3
    Start-Process "http://localhost:5173"
} | Out-Null

# Wait for either process to exit; on Ctrl+C, the finally{} runs to clean up
try {
    while ((-not $backend.HasExited) -and (-not $frontend.HasExited)) {
        Start-Sleep -Milliseconds 400
    }
} finally {
    Write-Host ""
    Step "Stopping services…"
    # taskkill /T kills the entire process tree (catches npm.cmd → node, etc.)
    if ($backend  -and -not $backend.HasExited)  { & taskkill.exe /F /T /PID $backend.Id  2>$null | Out-Null }
    if ($frontend -and -not $frontend.HasExited) { & taskkill.exe /F /T /PID $frontend.Id 2>$null | Out-Null }
}
