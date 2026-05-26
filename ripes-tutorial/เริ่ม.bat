@echo off
chcp 65001 >nul
title Ripes Tutorial Launcher
cd /d "%~dp0"

rem เพิ่ม toolchain เข้า PATH เพื่อให้ Ripes ค้นพบ C compiler ได้
set "PATH=%~dp0toolchain\bin;%PATH%"

echo.
echo ============================================
echo    Ripes Tutorial - คู่มือการใช้งาน Ripes
echo ============================================
echo.
echo [1/2] เปิดเว็บคู่มือในเบราว์เซอร์...
start "" "%~dp0index.html"

echo [2/2] เปิดโปรแกรม Ripes...
start "" "%~dp0ripes\Ripes.exe"

echo.
echo เรียบร้อย! สามารถปิดหน้าต่างนี้ได้
echo (Done - you may close this window)
timeout /t 3 >nul
exit