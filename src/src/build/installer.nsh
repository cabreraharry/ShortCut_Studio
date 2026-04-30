; ShortCut Studio — custom NSIS hooks
; Included by electron-builder's NSIS template via nsis.include. Wires the
; well-known macros that electron-builder calls back at predictable points:
;
;   customInit                — early init (parse /COMPONENTS= CLI flag)
;   customWelcomePage         — first user-facing page (lists bundled stack)
;   customPageAfterChangeDir  — mid-flow page (Components opt-in/out)
;   customInstall             — runs during install section (post-copy cleanup)
;   customFinishPage          — last page (detect Ollama/LM Studio + link)
;
; The component-selection logic mirrors src/shared/components-manifest.ts so
; the NSIS surface and the in-app Settings -> Components panel agree on what
; "IPFS" and "NGINX" mean.

; ---------------------------------------------------------------------------
; File-scope includes + Var declarations.
;
; These must be at file scope (NOT inside a macro body) because the Function
; definitions below are compiled as soon as electron-builder !includes this
; file, and they reference MUI / nsDialogs / LogicLib symbols at compile time.
; If the includes were inside customHeader, the Functions would compile before
; the macro expanded.
;
; NSIS guards !include against double-processing by file path, so re-including
; MUI2.nsh / LogicLib.nsh is harmless even though the template includes them
; later.
; ---------------------------------------------------------------------------
; Everything in this file is installer-only — none of our macros are wired
; into the uninstaller pass. Gating on !ifndef BUILD_UNINSTALLER keeps the
; uninstaller compile from emitting "install function not referenced"
; warnings (NSIS warning 6010), which electron-builder treats as build
; errors. The closing !endif sits at the bottom of the file.
!ifndef BUILD_UNINSTALLER

!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!include "StrFunc.nsh"

; Register StrLoc so we can use ${StrLoc <args>} in customInit. StrFunc
; requires this no-args "declaration" call before subsequent usages compile.
${StrLoc}

; --- Component-selection state ---------------------------------------------
; "1" = install/keep this component, "0" = opt out (delete after copy).
; Defaults to "1" so users who click through Components keep everything.
; The /COMPONENTS= flag (if provided) overrides defaults.
Var INSTALL_IPFS
Var INSTALL_NGINX

; Checkbox handles for the Components page leave-callback to read state.
Var DLG_IPFS_HWND
Var DLG_NGINX_HWND

; Detection results, populated in the Finish-page PRE callback.
Var OLLAMA_PRESENT
Var LMSTUDIO_PRESENT

; Dynamic Finish-page strings. NSIS evaluates $-variables in MUI page texts
; at render time, so populating these in the PRE callback lets us show
; detection results without hardcoding text in the macro.
Var FINISH_BODY_TEXT
Var FINISH_LINK_URL
Var FINISH_LINK_LABEL

; ---------------------------------------------------------------------------
; customInit — runs early. Parse /COMPONENTS=IPFS,NGINX (etc.) into our two
; vars. If the flag is absent, both default to "1" (everything installed).
; ---------------------------------------------------------------------------
!macro customInit
  StrCpy $INSTALL_IPFS  "1"
  StrCpy $INSTALL_NGINX "1"

  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "/COMPONENTS=" $R1
  ${IfNot} ${Errors}
    ; Flag present — treat as exhaustive whitelist. Anything not listed is
    ; opted out.
    StrCpy $INSTALL_IPFS  "0"
    StrCpy $INSTALL_NGINX "0"

    ; Substring match. ${StrLoc} returns "" when needle isn't found, or the
    ; 0-based index otherwise. We don't care about position, only presence.
    ; ">" = scan left-to-right.
    ${StrLoc} $R2 "$R1" "IPFS" ">"
    ${If} $R2 != ""
      StrCpy $INSTALL_IPFS "1"
    ${EndIf}

    ${StrLoc} $R2 "$R1" "NGINX" ">"
    ${If} $R2 != ""
      StrCpy $INSTALL_NGINX "1"
    ${EndIf}
  ${EndIf}
!macroend

; ---------------------------------------------------------------------------
; customWelcomePage — replaces the default Welcome. Lists what the user is
; about to install so the bundled stack isn't invisible.
; ---------------------------------------------------------------------------
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to ShortCut Studio Setup"
  !define MUI_WELCOMEPAGE_TEXT "Setup will install ShortCut Studio on your computer.$\r$\n$\r$\nThis installer bundles:$\r$\n$\r$\n  - ShortCut Studio app (Electron)$\r$\n  - SCL background workers (root_watchdog, topic_watchdog, gemini_processor)$\r$\n  - Seed databases + privacy lists$\r$\n  - IPFS Kubo peer transport (optional, ~87 MB)$\r$\n  - Nginx reverse proxy (optional, ~3 MB)$\r$\n$\r$\nYou'll be able to opt out of the optional bundles on the Components page.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ---------------------------------------------------------------------------
; customPageAfterChangeDir — slots the Components page in BETWEEN the install-
; location page and the install-progress page (per electron-builder's
; assistedInstaller.nsh ordering).
; ---------------------------------------------------------------------------
!macro customPageAfterChangeDir
  Page custom ComponentsPageShow ComponentsPageLeave
!macroend

Function ComponentsPageShow
  !insertmacro MUI_HEADER_TEXT "Optional Components" "Choose which optional bundles to keep on disk."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0u 0u 100% 36u "These bundles support v2 features (peer-to-peer file sharing, ExecEngine HTTP layer). They're dormant in v0.4.0 — opting out saves disk space without affecting current functionality. You can re-add them later from Settings -> Components inside the app."
  Pop $0

  ${NSD_CreateCheckBox} 0u 44u 100% 12u "&IPFS Kubo (peer transport, ~87 MB)"
  Pop $DLG_IPFS_HWND
  ${If} $INSTALL_IPFS == "1"
    ${NSD_Check} $DLG_IPFS_HWND
  ${EndIf}

  ${NSD_CreateCheckBox} 0u 60u 100% 12u "&Nginx (reverse proxy, ~3 MB)"
  Pop $DLG_NGINX_HWND
  ${If} $INSTALL_NGINX == "1"
    ${NSD_Check} $DLG_NGINX_HWND
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function ComponentsPageLeave
  ${NSD_GetState} $DLG_IPFS_HWND  $INSTALL_IPFS
  ${NSD_GetState} $DLG_NGINX_HWND $INSTALL_NGINX

  ; If the user opted out of either component, double-check before proceeding.
  ; These bundles are dormant in v0.4.0 (so the install will work fine), but
  ; v2 features that ship later (peer-shared scan via IPFS, Nginx-fronted
  ; ExecEngine HTTP layer) won't function without them and the user would have
  ; to re-add via Settings -> Components or re-run the installer. Opting out is
  ; legitimate (saves ~90 MB), so the prompt is informational, not blocking.
  ${If} $INSTALL_IPFS == "0"
  ${OrIf} $INSTALL_NGINX == "0"
    StrCpy $0 ""
    ${If} $INSTALL_IPFS == "0"
      StrCpy $0 "$0$\r$\n  - IPFS Kubo (peer-to-peer file sharing)"
    ${EndIf}
    ${If} $INSTALL_NGINX == "0"
      StrCpy $0 "$0$\r$\n  - Nginx (reverse proxy for ExecEngine HTTP layer)"
    ${EndIf}
    MessageBox MB_YESNO|MB_ICONQUESTION "You opted out of:$0$\r$\n$\r$\nThese power v2 features (peer-shared file processing, ExecEngine HTTP layer) that aren't active yet. The app will install and run fine without them, but you'll need to re-add via Settings -> Components when those features ship.$\r$\n$\r$\nProceed with the current selection?" /SD IDYES IDYES scs_components_confirmed
    Abort
    scs_components_confirmed:
  ${EndIf}
FunctionEnd

; ---------------------------------------------------------------------------
; customInstall — runs after files are extracted. Post-copy cleanup for any
; component the user opted out of. Cheaper to do RMDir than to plumb
; conditional file-copy through electron-builder's NSIS template (the asar
; archive ships everything; we just delete what isn't wanted).
; ---------------------------------------------------------------------------
!macro customInstall
  ${If} $INSTALL_IPFS == "0"
    DetailPrint "Removing IPFS Kubo (per Components selection)..."
    RMDir /r "$INSTDIR\resources\extras\ipfs"
  ${EndIf}
  ${If} $INSTALL_NGINX == "0"
    DetailPrint "Removing Nginx (per Components selection)..."
    RMDir /r "$INSTDIR\resources\extras\nginx"
  ${EndIf}
!macroend

; ---------------------------------------------------------------------------
; customFinishPage — replaces the default Finish page. Detects Ollama and LM
; Studio install paths and shows inline status text + a single MUI link
; control pointing at whichever tool is missing first (or no link if both
; detected).
;
; NSIS evaluates $-variables in MUI page texts at render time, so we set the
; body text ($FINISH_BODY_TEXT) and link target ($FINISH_LINK_URL) in the
; PRE callback. The MUI macro then expands them when the page renders.
; ---------------------------------------------------------------------------
!macro customFinishPage
  !define MUI_FINISHPAGE_TITLE "ShortCut Studio is ready"
  !define MUI_FINISHPAGE_TEXT "$FINISH_BODY_TEXT"
  !define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
  !define MUI_FINISHPAGE_RUN_TEXT "Launch ShortCut Studio"
  !define MUI_FINISHPAGE_LINK "$FINISH_LINK_LABEL"
  !define MUI_FINISHPAGE_LINK_LOCATION "$FINISH_LINK_URL"
  !define MUI_PAGE_CUSTOMFUNCTION_PRE FinishPagePopulateText
  !insertmacro MUI_PAGE_FINISH
!macroend

Function FinishPagePopulateText
  ; Detection. Use named labels — relative jumps (`+N`) on IfFileExists are
  ; counted from the next instruction and are easy to off-by-one when the
  ; control flow grows. Named labels are unambiguous.
  StrCpy $OLLAMA_PRESENT "0"
  StrCpy $LMSTUDIO_PRESENT "0"
  IfFileExists "$LOCALAPPDATA\Programs\Ollama\ollama.exe" 0 ollama_check_done
    StrCpy $OLLAMA_PRESENT "1"
  ollama_check_done:
  IfFileExists "$LOCALAPPDATA\Programs\LM Studio\LM Studio.exe" 0 lmstudio_check_done
    StrCpy $LMSTUDIO_PRESENT "1"
  lmstudio_check_done:

  ; Compose the body text. Two state lines plus a one-line nudge to the
  ; in-app LLMs page so the user knows where to wire credentials/models.
  StrCpy $FINISH_BODY_TEXT "Setup completed.$\r$\n$\r$\nLocal LLM tools (recommended for offline scan):"
  ${If} $OLLAMA_PRESENT == "1"
    StrCpy $FINISH_BODY_TEXT "$FINISH_BODY_TEXT$\r$\n  Ollama: Detected"
  ${Else}
    StrCpy $FINISH_BODY_TEXT "$FINISH_BODY_TEXT$\r$\n  Ollama: Not installed"
  ${EndIf}
  ${If} $LMSTUDIO_PRESENT == "1"
    StrCpy $FINISH_BODY_TEXT "$FINISH_BODY_TEXT$\r$\n  LM Studio: Detected"
  ${Else}
    StrCpy $FINISH_BODY_TEXT "$FINISH_BODY_TEXT$\r$\n  LM Studio: Not installed"
  ${EndIf}
  StrCpy $FINISH_BODY_TEXT "$FINISH_BODY_TEXT$\r$\n$\r$\nConfigure providers + API keys on the LLMs page after launch. You can also re-add or download missing components from Settings -> Components inside the app."

  ; Pick which (if any) tool to link to. Prefer Ollama (more popular default)
  ; if both are missing.
  ${If} $OLLAMA_PRESENT == "0"
    StrCpy $FINISH_LINK_LABEL "Download Ollama"
    StrCpy $FINISH_LINK_URL "https://ollama.com/download"
  ${ElseIf} $LMSTUDIO_PRESENT == "0"
    StrCpy $FINISH_LINK_LABEL "Download LM Studio"
    StrCpy $FINISH_LINK_URL "https://lmstudio.ai"
  ${Else}
    ; Both detected — link to the LLMs page docs (placeholder, points to repo).
    StrCpy $FINISH_LINK_LABEL "ShortCut Studio on GitHub"
    StrCpy $FINISH_LINK_URL "https://github.com/cabreraharry/ShortCut_Studio"
  ${EndIf}
FunctionEnd

!endif ; !ifndef BUILD_UNINSTALLER
