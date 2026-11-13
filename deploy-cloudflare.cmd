@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   MONTABBORD - Deploiement Cloudflare
echo   (site + functions/api)
echo ==========================================

echo.
echo [1/3] Preparation Git...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Mise a jour application"
) else (
  echo Rien de nouveau a committer.
)

for /f "delims=" %%b in ('git rev-parse --abbrev-ref HEAD') do set BRANCH=%%b
if "%BRANCH%"=="" set BRANCH=main
echo [2/3] Envoi sur GitHub (branche %BRANCH%)...
git push origin %BRANCH%

echo.
echo [3/3] Deploiement Cloudflare Pages...
npx wrangler pages deploy public --project-name montabbord --branch main --commit-dirty=true
if errorlevel 1 (
  echo.
  echo ECHEC du deploiement Cloudflare.
  echo Verifie que tu es connecte : npx wrangler login
  pause
  exit /b 1
)

echo.
echo Deploiement termine.
echo Site : https://montabbord.pages.dev
pause
