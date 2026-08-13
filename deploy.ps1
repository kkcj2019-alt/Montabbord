$ErrorActionPreference = "Stop"
Set-Location -LiteralPath $PSScriptRoot
$env:PATH = [Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [Environment]::GetEnvironmentVariable("Path","User")

$changed = git status --porcelain
if ($changed) {
  git add -A
  git commit -m "autodeploy: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" --quiet
  Write-Host "Commite cree"
} else {
  Write-Host "Aucun changement a commiter"
}

git push --quiet
Write-Host "Push OK"

& .\node_modules\.bin\firebase.cmd deploy --only hosting
if ($LASTEXITCODE -eq 0) {
  Write-Host "Deploiement reussi !"
} else {
  Write-Host "ERREUR lors du deploiement" -ForegroundColor Red
  exit $LASTEXITCODE
}
