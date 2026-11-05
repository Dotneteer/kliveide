@echo off
setlocal enabledelayedexpansion

:: Use which.exe to find the python executable path
for /f "delims=" %%i in ('which.exe python 2^>nul') do set UNIX_PATH=%%i

if "%UNIX_PATH%"=="" (
    echo Error: python executable not found by which.exe
    exit /b 1
)

:: Convert unix path (like /c/Users/...) to Windows path if necessary
if "%UNIX_PATH:~0,1%"=="/" (
    set DRIVE=%UNIX_PATH:~1,1%
    set REMAINING=%UNIX_PATH:~3%
    set WIN_PATH=!DRIVE!:^/!REMAINING!
    set WIN_PATH=!WIN_PATH:/=\!
) else (
    set WIN_PATH=%UNIX_PATH%
)

:: Execute serve_docs.py script located in the same directory as this batch file
"%WIN_PATH%" "%~dp0serve_docs.py" %*
