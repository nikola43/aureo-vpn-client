; Aureo VPN Client - NSIS Installer Script
; Requires admin privileges for installation

!include "MUI2.nsh"

; General
Name "Aureo VPN Client"
OutFile "AureoVPN-Setup.exe"
InstallDir "$PROGRAMFILES\Aureo VPN"
InstallDirRegKey HKLM "Software\Aureo VPN" "Install_Dir"
RequestExecutionLevel admin

; Version info
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "Aureo VPN Client"
VIAddVersionKey "CompanyName" "Aureo VPN"
VIAddVersionKey "FileDescription" "Aureo VPN Client Installer"
VIAddVersionKey "FileVersion" "1.0.0"
VIAddVersionKey "LegalCopyright" "Copyright Aureo VPN"

; Interface settings
!define MUI_ABORTWARNING
!define MUI_ICON "..\..\build\appicon.png"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

; Language
!insertmacro MUI_LANGUAGE "English"

; Installer section
Section "Aureo VPN Client" SecMain
    SectionIn RO

    ; Set output path to the installation directory
    SetOutPath $INSTDIR

    ; Install main application
    File "aureo-vpn-client.exe"

    ; Install bundled WireGuard binaries
    File "wg.exe"
    File "wireguard.exe"

    ; Write registry keys
    WriteRegStr HKLM "Software\Aureo VPN" "Install_Dir" "$INSTDIR"

    ; Add to Add/Remove Programs
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AureoVPN" "DisplayName" "Aureo VPN Client"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AureoVPN" "UninstallString" '"$INSTDIR\uninstall.exe"'
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AureoVPN" "InstallLocation" "$INSTDIR"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AureoVPN" "Publisher" "Aureo VPN"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AureoVPN" "DisplayVersion" "1.0.0"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AureoVPN" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AureoVPN" "NoRepair" 1

    ; Create uninstaller
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; Create Start Menu shortcuts
    CreateDirectory "$SMPROGRAMS\Aureo VPN"
    CreateShortcut "$SMPROGRAMS\Aureo VPN\Aureo VPN Client.lnk" "$INSTDIR\aureo-vpn-client.exe"
    CreateShortcut "$SMPROGRAMS\Aureo VPN\Uninstall.lnk" "$INSTDIR\uninstall.exe"

    ; Create Desktop shortcut
    CreateShortcut "$DESKTOP\Aureo VPN Client.lnk" "$INSTDIR\aureo-vpn-client.exe"
SectionEnd

; Uninstaller section
Section "Uninstall"
    ; Stop any running WireGuard tunnel
    nsExec::ExecToLog '"$INSTDIR\wireguard.exe" /uninstalltunnelservice wg0'

    ; Remove files
    Delete "$INSTDIR\aureo-vpn-client.exe"
    Delete "$INSTDIR\wg.exe"
    Delete "$INSTDIR\wireguard.exe"
    Delete "$INSTDIR\uninstall.exe"
    RMDir "$INSTDIR"

    ; Remove shortcuts
    Delete "$SMPROGRAMS\Aureo VPN\Aureo VPN Client.lnk"
    Delete "$SMPROGRAMS\Aureo VPN\Uninstall.lnk"
    RMDir "$SMPROGRAMS\Aureo VPN"
    Delete "$DESKTOP\Aureo VPN Client.lnk"

    ; Remove registry keys
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\AureoVPN"
    DeleteRegKey HKLM "Software\Aureo VPN"
SectionEnd
