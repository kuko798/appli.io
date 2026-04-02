# Start Appli.io web app (http://127.0.0.1:8766)
# First time: creates .venv and installs dependencies.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..."
    py -m venv .venv
    & .\.venv\Scripts\pip install -r requirements.txt
}

Write-Host "Starting server at http://127.0.0.1:8766 (Ctrl+C to stop)"
& .\.venv\Scripts\python.exe main.py
