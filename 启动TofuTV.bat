@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\tofutv-launcher.ps1" -Action Start %*
set "TOFUTV_EXIT=%ERRORLEVEL%"
if not "%TOFUTV_EXIT%"=="0" pause
exit /b %TOFUTV_EXIT%
