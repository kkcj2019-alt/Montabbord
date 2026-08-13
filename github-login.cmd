@echo off
cd /d "%~dp0"
echo Connexion a GitHub en cours...
echo Une fenetre de connexion va s'ouvrir. Connectez-vous avec votre compte GitHub (kkcj2019-alt).
echo.
call git push
echo.
if %errorlevel%==0 (
  echo PUSH REUSSI - vous pouvez fermer cette fenetre.
) else (
  echo La connexion a echoue. Reessayez, ou verifiez vos acces GitHub.
)
pause
