; Klive's additions to electron-builder's NSIS installer (package.json build.nsis.include).
;
; The `klive` command line (.plans/UNIT_TESTS_CLI_PLAN.md D12): the installer puts the launcher's
; folder, $INSTDIR\resources\cli, on the user's PATH, and the uninstaller takes it off again. Both
; first remove any copy of the entry, so an update or a repair never adds it twice.

!include "WordFunc.nsh"
!include "WinMessages.nsh"

!define KLIVE_CLI_DIR "$INSTDIR\resources\cli"

; --- $0 = the user's PATH without the CLI folder
!macro kliveReadPathWithoutCli WORDREPLACE
  ReadRegStr $0 HKCU "Environment" "Path"
  ${WORDREPLACE} "$0" ";${KLIVE_CLI_DIR}" "" "+" $0
  ${WORDREPLACE} "$0" "${KLIVE_CLI_DIR};" "" "+" $0
  StrCmp $0 "${KLIVE_CLI_DIR}" 0 +2
    StrCpy $0 ""
!macroend

!macro kliveWritePath
  StrCmp $0 "" 0 +3
    DeleteRegValue HKCU "Environment" "Path"
    Goto +2
  WriteRegExpandStr HKCU "Environment" "Path" "$0"
  ; --- Tell running programs (Explorer, new terminals) that the environment changed
  SendMessage ${HWND_BROADCAST} ${WM_SETTINGCHANGE} 0 "STR:Environment" /TIMEOUT=5000
!macroend

!macro customInstall
  !insertmacro kliveReadPathWithoutCli "${WordReplace}"
  StrCmp $0 "" 0 +3
    StrCpy $0 "${KLIVE_CLI_DIR}"
    Goto +2
  StrCpy $0 "$0;${KLIVE_CLI_DIR}"
  !insertmacro kliveWritePath
!macroend

!macro customUnInstall
  !insertmacro kliveReadPathWithoutCli "${un.WordReplace}"
  !insertmacro kliveWritePath
!macroend
