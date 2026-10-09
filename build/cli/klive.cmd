@echo off
rem The `klive` command line (.plans/UNIT_TESTS_CLI_PLAN.md D1, D11): Klive's own binary in Node
rem mode runs the CLI bundle - no window, no GPU, no display. This launcher sits in the app's
rem resources\cli folder and finds the app relative to itself.
setlocal
set "RESOURCES=%~dp0.."
if defined KLIVE_ELECTRON (set "APP=%KLIVE_ELECTRON%") else (set "APP=%~dp0..\..\Klive IDE.exe")
if not exist "%APP%" (
  echo klive: the Klive IDE binary was not found at %APP% ^(set KLIVE_ELECTRON to its path^). 1>&2
  exit /b 4
)
if exist "%RESOURCES%\app.asar" (set "SCRIPT=%RESOURCES%\app.asar\out\main\cli.js") else (set "SCRIPT=%RESOURCES%\app\out\main\cli.js")
set ELECTRON_RUN_AS_NODE=1
"%APP%" "%SCRIPT%" %*
exit /b %ERRORLEVEL%
