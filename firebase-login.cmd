@echo off
cd /d "%~dp0"
echo ==========================================================
echo  CONNEXION FIREBASE - ETAPE PAR ETAPE
echo ==========================================================
echo.
echo  1) Cette fenetre va afficher une adresse https://auth.firebase.tools...
echo     et la phrase "Enter authorization code:".
echo  2) COPIER l'adresse, la COLLER dans votre navigateur, puis
echo     vous connecter avec votre compte Google.
echo  3) La page affichera un CODE (commence par 4/0...).
echo     Copier ce code et le COLLER ici, puis appuyer sur ENTREE.
echo.
echo ==========================================================
echo.
npx --yes firebase-tools@latest login
if errorlevel 1 (
  echo.
  echo ECHEC DE LA CONNEXION. Relisez les instructions et
  echo relancez ce fichier (double-clic) ou signalez l'erreur.
  pause
  exit /b 1
)
echo.
echo Connexion OK ! Lancement du deploiement...
echo.
call deploy.cmd