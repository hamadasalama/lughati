@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Please install the LTS version from nodejs.org first.
  pause
  exit /b 1
)
node unpack.mjs
if errorlevel 1 (
  echo.
  echo Something went wrong - read the message above.
  pause
  exit /b 1
)
echo.
echo Unpacked. Save more pack files later and run this again anytime.
pause