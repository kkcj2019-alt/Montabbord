@echo off
cd /d "%~dp0"
call "node_modules\.bin\firebase.cmd" login
echo.
echo Si la connexion a reussi, vous pouvez fermer cette fenetre.
pause
