@echo off
REM Installe le demarrage automatique d'auto-deploy a l'ouverture de session
set NODE=%ProgramFiles%\nodejs\node.exe
if not exist "%NODE%" set NODE=C:\Program Files\nodejs\node.exe

REM Cree le lanceur invisible avec les chemins de CE PC
> "%~dp0auto-deploy-h.vbs" (
  echo Set sh = CreateObject^("WScript.Shell"^)
  echo sh.CurrentDirectory = "%~dp0"
  echo sh.Run """%NODE%"" ""%~dp0auto-deploy.js""", 0, False
)

schtasks /Create /F /SC ONLOGON /RL LIMITED /TN "MontabbordAutoDeploy" /TR "wscript.exe \"%~dp0auto-deploy-h.vbs\" /B"
if %errorlevel%==0 (
  echo.
  echo  Auto-deploy installe ! Il demarrera tout seul a l'ouverture de session.
) else (
  echo  Erreur lors de l'installation.
)
pause
