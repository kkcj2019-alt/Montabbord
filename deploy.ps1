param(
  [string]$Message = "Mise a jour application",
  [switch]$NoCommit
)
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot

if (-not $NoCommit) {
  git add -A
  $staged = git diff --cached --name-only
  if ($staged) {
    git commit -m $Message
  } else {
    Write-Host "[deploy] Rien de nouveau a committer."
  }
}

Write-Host "[deploy] git push..."
git push origin ma-version-deployee

Write-Host "[deploy] Firebase hosting..."
cmd /c "npx.cmd --yes firebase-tools@latest deploy --only hosting --project montabbord"

Write-Host "[deploy] Termine : https://montabbord.web.app"
