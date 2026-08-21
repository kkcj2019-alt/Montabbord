@echo off
cd /d "%~dp0"
start "" http://localhost:8788
node serve-app.js
pause
