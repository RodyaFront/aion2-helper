$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
python -m pip install -r requirements.txt
python -m PyInstaller --noconfirm --clean --onefile --windowed --name AionBossTracker `
  --paths $PSScriptRoot `
  app.py
Write-Host "Built: $PSScriptRoot\dist\AionBossTracker.exe"
