; WebK9 Installer Script
; Requires NSIS 3.0+

!include "MUI2.nsh"

;--------------------------------
;General

  Name "WebK9"
  OutFile "../../release/WebK9_Setup.exe"
  Unicode True

  ; Default installation folder
  InstallDir "$PROGRAMFILES64\WebK9"
  
  ; Get installation folder from registry if available
  InstallDirRegKey HKCU "Software\WebK9" ""

  ; Request application privileges for Windows Vista+
  RequestExecutionLevel admin

;--------------------------------
;Interface Settings

  !define MUI_ABORTWARNING

;--------------------------------
;Pages

  !insertmacro MUI_PAGE_WELCOME
  !insertmacro MUI_PAGE_LICENSE "../../LICENSE" ; Assuming LICENSE file exists in root, otherwise comment out
  !insertmacro MUI_PAGE_DIRECTORY
  !insertmacro MUI_PAGE_INSTFILES
  
  !insertmacro MUI_PAGE_FINISH

  !insertmacro MUI_UNPAGE_WELCOME
  !insertmacro MUI_UNPAGE_CONFIRM
  !insertmacro MUI_UNPAGE_INSTFILES
  !insertmacro MUI_UNPAGE_FINISH

;--------------------------------
;Languages
 
  !insertmacro MUI_LANGUAGE "English"

;--------------------------------
;Installer Sections

Section "WebK9 Application" SecDummy

  SetOutPath "$INSTDIR"
  
  ; Files to be installed
  File "../../release/web-k9-windows-amd64.exe"
  Rename "$INSTDIR\web-k9-windows-amd64.exe" "$INSTDIR\web-k9.exe"

  ; Store installation folder
  WriteRegStr HKCU "Software\WebK9" "" $INSTDIR
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Create Shortcuts
  CreateDirectory "$SMPROGRAMS\WebK9"
  CreateShortcut "$SMPROGRAMS\WebK9\WebK9.lnk" "$INSTDIR\web-k9.exe"
  CreateShortcut "$SMPROGRAMS\WebK9\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\WebK9.lnk" "$INSTDIR\web-k9.exe"

SectionEnd

;--------------------------------
;Uninstaller Section

Section "Uninstall"

  Delete "$INSTDIR\web-k9.exe"
  Delete "$INSTDIR\Uninstall.exe"

  Delete "$SMPROGRAMS\WebK9\WebK9.lnk"
  Delete "$SMPROGRAMS\WebK9\Uninstall.lnk"
  Delete "$DESKTOP\WebK9.lnk"
  RMDir "$SMPROGRAMS\WebK9"

  RMDir "$INSTDIR"

  DeleteRegKey /ifempty HKCU "Software\WebK9"

SectionEnd
