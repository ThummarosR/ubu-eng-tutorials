@echo off
chcp 65001 >nul
title Ripes Tutorial Launcher
cd /d "%~dp0"
set "PATH=%~dp0toolchain\bin;%PATH%"
start "" "%~dp0index.html"
start "" "%~dp0ripes\Ripes.exe"
exit