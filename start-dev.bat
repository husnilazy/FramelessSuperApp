@echo off
:: ═══════════════════════════════════════════════════════════════════
::  FRAMELESS CREATIVE — Windows Startup Script
::  Jalankan file ini (double-click) untuk start semua server
:: ═══════════════════════════════════════════════════════════════════

title Frameless Creative Dev Server

echo.
echo  ███████╗██████╗  █████╗ ███╗   ███╗███████╗██╗     ███████╗███████╗███████╗
echo  ██╔════╝██╔══██╗██╔══██╗████╗ ████║██╔════╝██║     ██╔════╝██╔════╝██╔════╝
echo  █████╗  ██████╔╝███████║██╔████╔██║█████╗  ██║     █████╗  ███████╗███████╗
echo  ██╔══╝  ██╔══██╗██╔══██║██║╚██╔╝██║██╔══╝  ██║     ██╔══╝  ╚════██║╚════██║
echo  ██║     ██║  ██║██║  ██║██║ ╚═╝ ██║███████╗███████╗███████╗███████║███████║
echo  ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝╚══════╝╚══════╝╚══════╝╚══════╝
echo.
echo  Creative Production Hub — Dev Environment
echo  ═══════════════════════════════════════════
echo.

:: Check if .env exists
if not exist ".env" (
  echo  [!] File .env tidak ditemukan!
  echo      Membuat .env dari template...
  copy ".env.example" ".env" > nul 2>&1
  if exist ".env" (
    echo  [OK] .env berhasil dibuat. Edit DATABASE_URL sebelum lanjut.
    echo.
    notepad .env
    echo  Tekan Enter setelah selesai edit .env...
    pause > nul
  ) else (
    echo  [!] Gagal membuat .env. Buat manual dulu.
    pause
    exit /b 1
  )
)

:: Install dependencies if node_modules not found
if not exist "node_modules" (
  echo  [*] Installing dependencies...
  call pnpm install
  if errorlevel 1 (
    echo  [!] pnpm install gagal!
    pause
    exit /b 1
  )
)

:: Run DB push (create tables)
echo  [*] Pushing database schema...
call pnpm --filter @workspace/db db:push
if errorlevel 1 (
  echo  [!] db:push gagal. Pastikan DATABASE_URL benar dan PostgreSQL berjalan.
  echo      Lanjutkan? (Y/N)
  set /p cont=
  if /i "%cont%" neq "Y" (
    pause
    exit /b 1
  )
)

:: Build backend first
echo  [*] Building API server...
cd artifacts\api-server
call pnpm run build
if errorlevel 1 (
  echo  [!] Build API server gagal!
  cd ..\..
  pause
  exit /b 1
)
cd ..\..

echo.
echo  [OK] Setup selesai! Starting servers...
echo.
echo  ┌─────────────────────────────────────────────┐
echo  │  Frontend  →  http://localhost:5173          │
echo  │  Backend   →  http://localhost:8080/api      │
echo  │  Admin     →  http://localhost:5173/login    │
echo  └─────────────────────────────────────────────┘
echo.
echo  Login: admin@frameless.com / admin123
echo.

:: Start Backend in new window
start "Frameless API (port 8080)" cmd /k "title Frameless API && cd /d %~dp0 && set NODE_ENV=development && node --enable-source-maps artifacts\api-server\dist\index.mjs"

:: Wait for backend to initialize
timeout /t 3 /nobreak > nul

:: Start Frontend
start "Frameless Frontend (port 5173)" cmd /k "title Frameless Frontend && cd /d %~dp0 && pnpm --filter @workspace/frameless dev"

echo  Servers starting... Tunggu beberapa detik lalu buka browser.
echo  Tekan sembarang tombol untuk keluar dari launcher ini.
pause > nul
