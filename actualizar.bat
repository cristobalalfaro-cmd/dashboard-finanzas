@echo off
:: ===========================
:: Actualizar Dashboard Finanzas
:: ===========================

chcp 65001 >nul
cd /d "%~dp0"

set "REPO_URL=https://github.com/cristobalalfaro-cmd/dashboard-finanzas.git"
set "BRANCH=main"

echo.
echo === Iniciando actualizacion del Dashboard ===
echo.

:: Asegura que sea un repo git
git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo 📁 Inicializando repositorio Git...
  git init
)

:: Configura remoto si no existe
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo 🔗 Configurando remoto origin...
  git remote add origin %REPO_URL%
)

:: Asegura nombre de rama
git branch -M %BRANCH%

echo 🔄 Sincronizando con remoto...
git fetch origin %BRANCH% >nul 2>&1
git pull --rebase origin %BRANCH% --allow-unrelated-histories

:: Agrega todos los archivos
git add -A

:: Crea commit solo si hay cambios
git diff --cached --quiet
if errorlevel 1 (
  for /f "tokens=1-3 delims=/- " %%a in ("%date%") do set TODAY=%%a-%%b-%%c
  for /f "tokens=1-2 delims=:." %%a in ("%time%") do set NOW=%%a-%%b
  git commit -m "Actualización automática %TODAY% %NOW%"
) else (
  echo No hay cambios nuevos para subir.
)

:: Sube los cambios
echo 🚀 Subiendo cambios a GitHub...
git push -u origin %BRANCH%
if errorlevel 1 (
  echo ❌ Error al hacer push. Verifica tu conexión o credenciales.
  pause
  exit /b 1
)

echo.
echo ✅ Repositorio actualizado correctamente en origin/%BRANCH%.
echo 🌐 Abriendo Dashboard publicado...
start https://cristobalalfaro-cmd.github.io/dashboard-finanzas/
echo.
pause
