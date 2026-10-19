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
if (-not $env:CLOUDFLARE_ACCOUNT_ID) { $env:CLOUDFLARE_ACCOUNT_ID = "4e8f173aa6a4b630bb6d651369ae2b23" }
if (-not $env:CLOUDFLARE_API_TOKEN) { Write-Host "[deploy] ATTENTION : CLOUDFLARE_API_TOKEN non defini, Cloudflare sera ignore." }
else { cmd /c "npx.cmd --yes wrangler pages deploy public --project-name montabbord --branch main" }

Write-Host "[deploy] Termine :"
Write-Host "  Firebase   : https://montabbord.web.app"
Write-Host "  Cloudflare : https://montabbord.pages.dev"
