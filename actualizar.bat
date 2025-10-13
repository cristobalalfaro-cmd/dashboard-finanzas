@echo off
:: ============================================
::  actualizar.bat — Dashboard Finanzas (GitHub)
::  Repo: https://github.com/cristobalalfaro-cmd/dashboard-finanzas.git
:: ============================================

chcp 65001 >nul
cd /d "%~dp0"

set "REPO_URL=https://github.com/cristobalalfaro-cmd/dashboard-finanzas.git"
set "BRANCH=main"

echo.
echo === Iniciando actualizacion del Dashboard ===
echo Carpeta: %CD%
echo.

:: 1) Asegurar repo git
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo 📁 No es repo git. Inicializando...
  git init
)

:: 2) Configurar remoto origin si falta o es distinto
for /f "tokens=*" %%u in ('git remote get-url origin 2^>nul') do set CURR_URL=%%u
if "%CURR_URL%"=="" (
  echo 🔗 Configurando remoto origin -> %REPO_URL%
  git remote add origin %REPO_URL%
) else (
  if /I not "%CURR_URL%"=="%REPO_URL%" (
    echo ♻️ Remoto origin distinto. Reconfigurando...
    git remote remove origin
    git remote add origin %REPO_URL%
  ) else (
    echo 🔗 Remoto origin ok.
  )
)

:: 3) Asegurar rama
git branch -M %BRANCH%

:: 4) Sincronizar con remoto (traer README u otros si existen)
echo 🔄 Sincronizando con origin/%BRANCH%...
git fetch origin %BRANCH% >nul 2>&1
git pull --rebase origin %BRANCH% --allow-unrelated-histories

:: 5) (Opcional) Forzar cambio mínimo si no modificaste nada
:: echo updated %date% %time%> .bump

:: 6) Agregar y commitear SOLO si hay cambios
git add -A
git diff --cached --quiet
if errorlevel 1 (
  for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set TODAY=%%a-%%b-%%c
  for /f "tokens=1-2 delims=:." %%a in ("%time%") do set NOW=%%a-%%b
  git commit -m "Actualizacion automatica %TODAY% %NOW%"
) else (
  echo ✅ No hay cambios nuevos para commitear.
)

:: 7) Subir al remoto
echo 🚀 Subiendo a origin/%BRANCH%...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo ❌ Error al hacer push.
  echo    - Verifica tu conexion o credenciales (usa un PAT como contrasena si te lo pide).
  echo    - Si es un repo nuevo con cambios en remoto, intenta nuevamente tras el pull.
  echo.
  pause
  exit /b 1
)

echo.
echo ✅ Repositorio actualizado correctamente en origin/%BRANCH%.
echo 🌐 Abriendo Dashboard publicado...
start https://cristobalalfaro-cmd.github.io/dashboard-finanzas/
echo.
pause
