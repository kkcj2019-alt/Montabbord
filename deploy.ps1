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
$curBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($curBranch -and $curBranch -ne 'HEAD') { git push origin $curBranch } else { git push origin ma-version-deployee }

Write-Host "[deploy] Firebase hosting..."
cmd /c "npx.cmd --yes firebase-tools@latest deploy --only hosting --project montabbord"

Write-Host "[deploy] Cloudflare Pages..."
cmd /c "npx.cmd --yes wrangler pages deploy public --project-name montabbord --branch main"

Write-Host "[deploy] Termine :"
Write-Host "  Firebase   : https://montabbord.web.app"
Write-Host "  Cloudflare : https://montabbord.pages.dev"
