; ShortCut Studio — custom NSIS hooks (web-stub installer, v0.5.0+)
; Included by electron-builder's NSIS template via nsis.include.
;
; What this file does at install time:
;   1. customInit       — parse CLI flags (/OPTIONAL=).
;   2. customWelcomePage — high-level "what's about to install" page.
;   3. customPageAfterChangeDir — optional components page (Ollama, LM Studio
;                         checkboxes; pre-selected by /OPTIONAL= flag).
;   4. customInstall    — runs after the .7z payload is extracted by electron-
;                         builder's nsis-web mechanism. Phase A: required
;                         component download/extract (ABORTS on failure).
;                         Phase B: optional component silent-install (best-
;                         effort; logs failures, doesn't abort).
;   5. customFinishPage — status summary + telemetry POST stub (Phase 3 will
;                         wire to API Gateway → SQS once that infra exists).
;
; Component data is HARDCODED in this file. The earlier design fetched a
; JSON manifest at install time and parsed it via nsJSON, but every NSIS
; JSON-plugin mirror we found has rotted (404 from the canonical NSIS Wiki
; URL). Hardcoding is fine because:
;   - Component versions only change when WE rebuild the stub anyway
;   - The runtime in-app updater (src/main/updater/) uses the JSON manifest
;     to detect new versions and downloads a fresh stub, which then has new
;     hardcoded values. Same end-user behavior, simpler installer code.
;
; When bumping IPFS Kubo / Nginx / Ollama / LM Studio versions, update the
; hardcoded URLs / sentinel files BELOW and the matching entries in
; src/shared/components-manifest.ts + build/fallback-manifest.json so the
; in-app updater + Settings → Components surfaces stay in sync.
;
; Plugins used:
;   - nsExec:: (subprocess execution) — built into NSIS
;   - System::  (Win32 calls)         — built into NSIS
;
; HTTPS downloads use curl.exe and zip extraction uses tar.exe — both ship
; with Windows 10 1803+ at C:\Windows\System32\, both work deterministically
; in elevated install contexts. Avoid:
;   - INetC: not bundled with electron-builder's nsis-web template
;   - PowerShell Invoke-WebRequest / Expand-Archive: work standalone but
;     fail in elevated nsExec contexts in ways we couldn't pin down quickly
;     (likely WinHTTP proxy resolution + .NET assembly load issues); also
;     a quote-escape minefield via -Command.
; Curl exit codes: https://curl.se/docs/manpage.html#EXIT
; Tar uses --strip-components=1 to peel off the wrapping folder ("kubo/"
; for IPFS Kubo, "nginx-1.26.2/" for Nginx) so binaries land directly
; under resources\extras\<id>\.
;
; SHA-256 verification of downloaded payloads is performed inline in
; DoZipExtract / DoSilentInstaller using `certutil.exe -hashfile <path> SHA256`
; (built into Windows; works deterministically in elevated nsExec contexts —
; PowerShell `Get-FileHash` does not). Expected hashes are hardcoded as
; !defines below; the maintainer updates them when bumping component versions
; alongside the matching values in src/shared/components-manifest.ts and
; build/fallback-manifest.json. A placeholder sentinel makes the install
; refuse to proceed if a maintainer forgets to fill the hash in before
; cutting a release — secure by default.

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
${StrLoc}

; ===========================================================================
; HARDCODED COMPONENT DATA — keep in sync with src/shared/components-manifest.ts
; ===========================================================================

; SHA placeholder sentinel. Any component whose hash equals this value is
; refused at install time so a missing-update can't silently ship without
; verification. Run `certutil -hashfile <path> SHA256` on the upstream zip
; / installer to get the real value when bumping a version.
!define COMPONENT_SHA_PLACEHOLDER "FILL_BEFORE_RELEASE_FROM_VENDOR_CACHE_OR_PUBLISH_RELEASE_MJS_LOG"

; ----- Required: IPFS Kubo --------------------------------------------------
!define IPFS_URL          "https://dist.ipfs.tech/kubo/v0.41.0/kubo_v0.41.0_windows-amd64.zip"
!define IPFS_VERSION      "v0.41.0"
!define IPFS_SHA256       "0af8c2b9aadc84e8efd4c5b6cc880f77e434b6345fcee691c4bc86f6f566ac7b"
!define IPFS_EXTRACTTO    "extras\ipfs"
!define IPFS_SENTINEL     "ipfs.exe"

; ----- Required: Nginx ------------------------------------------------------
!define NGINX_URL         "https://nginx.org/download/nginx-1.26.2.zip"
!define NGINX_VERSION     "1.26.2"
!define NGINX_SHA256      "942638cc31c836fe429fde22e4c46e497f89d3c2bbce46cd2c8800854fd71409"
!define NGINX_EXTRACTTO   "extras\nginx"
!define NGINX_SENTINEL    "nginx.exe"

; ----- Optional: Ollama -----------------------------------------------------
!define OLLAMA_URL        "https://github.com/ollama/ollama/releases/download/v0.5.4/OllamaSetup.exe"
!define OLLAMA_FLAGS      "/SILENT"

; ----- Optional: LM Studio --------------------------------------------------
!define LMSTUDIO_URL      "https://installers.lmstudio.ai/win32/x64/0.3.5/LM-Studio-0.3.5-Setup.exe"
!define LMSTUDIO_FLAGS    "/S"

; ----- Optional component SHAs ---------------------------------------------
; Generated by scripts/fetch-optional-components.mjs at build time. The
; included file is gitignored. `npm run build:win` chains
; `fetch-optional-components.mjs --ensure` so a placeholder file always exists
; before makensis runs (otherwise NSIS warning 7000 fires and electron-builder
; treats it as an error). When the SHA equals COMPONENT_SHA_PLACEHOLDER the
; install path fail-closes — zip-extract / silent-install both refuse to
; proceed. The maintainer runs `npm run fetch-optional-components` (no
; `--ensure`) before cutting a release to populate real values.
!include "${__FILEDIR__}\component-shas.nsh"

; ===========================================================================
; State variables
; ===========================================================================

; Optional component selection (set from /OPTIONAL CLI flag and the wizard
; checkboxes). "1" = install, "0" = skip.
Var OPT_SELECT_OLLAMA
Var OPT_SELECT_LMSTUDIO

; nsDialogs checkbox HWNDs for the Optional Components page.
Var OPT_HWND_OLLAMA
Var OPT_HWND_LMSTUDIO

; Telemetry correlation id — random hex generated in customInit. Unused
; until Phase 3 wires the SQS endpoint, but generated up-front so the
; Finish-page POST stub already has it ready.
Var TEL_INSTALL_ID

; Finish-page detection results.
Var OLLAMA_PRESENT
Var LMSTUDIO_PRESENT
Var FINISH_BODY_TEXT
Var FINISH_LINK_URL
Var FINISH_LINK_LABEL

; Component-install helper IO. Caller sets CI_ID + CI_DISPLAYNAME + CI_URL
; + CI_VERSION + CI_EXTRACTTO + CI_SENTINEL (zip-extract) or CI_SILENTFLAGS
; (silent-installer), then Calls a helper, then reads CI_RESULT.
Var CI_ID
Var CI_DISPLAYNAME
Var CI_URL
Var CI_VERSION
Var CI_SHA256
Var CI_EXTRACTTO
Var CI_SENTINEL
Var CI_SILENTFLAGS
Var CI_RESULT

; ===========================================================================
; customInit — parse CLI flags + generate install ID.
; ===========================================================================
!macro customInit
  StrCpy $OPT_SELECT_OLLAMA "0"
  StrCpy $OPT_SELECT_LMSTUDIO "0"

  ${GetParameters} $R0

  ; /OPTIONAL=OLLAMA,LMSTUDIO — opt in to specific optional components
  ; for silent / non-interactive installs.
  ClearErrors
  ${GetOptions} $R0 "/OPTIONAL=" $R1
  ${IfNot} ${Errors}
    ${StrLoc} $R2 "$R1" "OLLAMA" ">"
    ${If} $R2 != ""
      StrCpy $OPT_SELECT_OLLAMA "1"
    ${EndIf}
    ${StrLoc} $R2 "$R1" "LMSTUDIO" ">"
    ${If} $R2 != ""
      StrCpy $OPT_SELECT_LMSTUDIO "1"
    ${EndIf}
  ${EndIf}

  ; Generate random 16-hex-char install ID for telemetry correlation.
  ; Combination of GetTickCount + GetCurrentProcessId — not crypto-secure,
  ; but adversaries don't care; we just need uniqueness within a fleet.
  System::Call 'kernel32::GetTickCount() i .r0'
  IntFmt $TEL_INSTALL_ID "%08x" $0
  System::Call 'kernel32::GetCurrentProcessId() i .r0'
  IntFmt $1 "%08x" $0
  StrCpy $TEL_INSTALL_ID "$TEL_INSTALL_ID$1"
!macroend

; ===========================================================================
; customWelcomePage — replaces the default Welcome.
; ===========================================================================
!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to ShortCut Studio Setup"
  !define MUI_WELCOMEPAGE_TEXT "Setup will install ShortCut Studio on your computer.$\r$\n$\r$\nThe following components will be downloaded and installed:$\r$\n$\r$\n  - ShortCut Studio app (Electron)$\r$\n  - Background services for file scanning + topic detection$\r$\n  - Seed databases + privacy lists$\r$\n  - IPFS Kubo peer transport — required, ~41 MB$\r$\n  - Nginx reverse proxy — required, ~2 MB$\r$\n$\r$\nOptional local-LLM tools (Ollama, LM Studio) can be selected on the next page.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

; ===========================================================================
; customPageAfterChangeDir — slots the optional-components page in BETWEEN
; Install-Location and Installing.
; ===========================================================================
!macro customPageAfterChangeDir
  Page custom OptionalCompShow OptionalCompLeave
!macroend

Function OptionalCompShow
  !insertmacro MUI_HEADER_TEXT "Optional Components" "Pick the local-LLM tools to install alongside ShortCut Studio."

  ; Pre-detect existing installs so we can skip already-installed tools
  ; (no point re-running the third-party silent installer if the binary
  ; is already there). customInstall does the same check as a safety net
  ; for /S silent installs that bypass this page.
  StrCpy $OLLAMA_PRESENT "0"
  StrCpy $LMSTUDIO_PRESENT "0"
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\Ollama\ollama.exe"
    StrCpy $OLLAMA_PRESENT "1"
  ${EndIf}
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\LM Studio\LM Studio.exe"
    StrCpy $LMSTUDIO_PRESENT "1"
  ${EndIf}

  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0u 0u 100% 24u "These third-party tools pair with the LLMs page inside ShortCut Studio. They're large downloads (several hundred MB each) — leave unchecked if you'll configure cloud providers (OpenAI / Claude / Gemini) instead. You can install them later from Settings → Components."
  Pop $0

  ${If} $OLLAMA_PRESENT == "1"
    ${NSD_CreateCheckBox} 0u 32u 100% 12u "Ollama (already installed — will skip)"
    Pop $OPT_HWND_OLLAMA
    EnableWindow $OPT_HWND_OLLAMA 0
    StrCpy $OPT_SELECT_OLLAMA "0"
  ${Else}
    ${NSD_CreateCheckBox} 0u 32u 100% 12u "&Ollama (local LLM runtime, ~700 MB)"
    Pop $OPT_HWND_OLLAMA
    ${If} $OPT_SELECT_OLLAMA == "1"
      ${NSD_Check} $OPT_HWND_OLLAMA
    ${EndIf}
  ${EndIf}

  ${If} $LMSTUDIO_PRESENT == "1"
    ${NSD_CreateCheckBox} 0u 48u 100% 12u "LM Studio (already installed — will skip)"
    Pop $OPT_HWND_LMSTUDIO
    EnableWindow $OPT_HWND_LMSTUDIO 0
    StrCpy $OPT_SELECT_LMSTUDIO "0"
  ${Else}
    ${NSD_CreateCheckBox} 0u 48u 100% 12u "L&M Studio (local LLM server with model marketplace, ~500 MB)"
    Pop $OPT_HWND_LMSTUDIO
    ${If} $OPT_SELECT_LMSTUDIO == "1"
      ${NSD_Check} $OPT_HWND_LMSTUDIO
    ${EndIf}
  ${EndIf}

  nsDialogs::Show
FunctionEnd

Function OptionalCompLeave
  ; NSD_GetState stores BST_CHECKED (1) / BST_UNCHECKED (0) as integers.
  ; Normalize to "1" / "0" strings so downstream string compares work.
  ${NSD_GetState} $OPT_HWND_OLLAMA $0
  ${If} $0 = 1
    StrCpy $OPT_SELECT_OLLAMA "1"
  ${Else}
    StrCpy $OPT_SELECT_OLLAMA "0"
  ${EndIf}
  ${NSD_GetState} $OPT_HWND_LMSTUDIO $0
  ${If} $0 = 1
    StrCpy $OPT_SELECT_LMSTUDIO "1"
  ${Else}
    StrCpy $OPT_SELECT_LMSTUDIO "0"
  ${EndIf}
FunctionEnd

; ===========================================================================
; customInstall — runs after electron-builder extracts the .7z payload to
; $INSTDIR. We add IPFS/Nginx (required) and Ollama/LM Studio (optional, if
; selected) on top.
; ===========================================================================
!macro customInstall
  ; --- Phase A: required components (mandatory; abort on failure) ---------
  StrCpy $CI_ID          "ipfs"
  StrCpy $CI_DISPLAYNAME "IPFS Kubo"
  StrCpy $CI_URL         "${IPFS_URL}"
  StrCpy $CI_VERSION     "${IPFS_VERSION}"
  StrCpy $CI_SHA256      "${IPFS_SHA256}"
  StrCpy $CI_EXTRACTTO   "${IPFS_EXTRACTTO}"
  StrCpy $CI_SENTINEL    "${IPFS_SENTINEL}"
  StrCpy $CI_RESULT      ""
  Call DoZipExtract
  ${If} $CI_RESULT != "OK"
    DetailPrint "Required component install failed: $CI_RESULT"
    Call CleanupPartialExtras
    MessageBox MB_OK|MB_ICONSTOP "Setup failed to install IPFS Kubo:$\r$\n$\r$\n$CI_RESULT$\r$\n$\r$\nPlease check your internet connection and re-run setup."
    Abort "IPFS install failed"
  ${EndIf}

  StrCpy $CI_ID          "nginx"
  StrCpy $CI_DISPLAYNAME "Nginx"
  StrCpy $CI_URL         "${NGINX_URL}"
  StrCpy $CI_VERSION     "${NGINX_VERSION}"
  StrCpy $CI_SHA256      "${NGINX_SHA256}"
  StrCpy $CI_EXTRACTTO   "${NGINX_EXTRACTTO}"
  StrCpy $CI_SENTINEL    "${NGINX_SENTINEL}"
  StrCpy $CI_RESULT      ""
  Call DoZipExtract
  ${If} $CI_RESULT != "OK"
    DetailPrint "Required component install failed: $CI_RESULT"
    Call CleanupPartialExtras
    MessageBox MB_OK|MB_ICONSTOP "Setup failed to install Nginx:$\r$\n$\r$\n$CI_RESULT$\r$\n$\r$\nPlease check your internet connection and re-run setup."
    Abort "Nginx install failed"
  ${EndIf}

  ; --- Phase B: optional components (best-effort; doesn't abort) ----------
  ; Pre-detect each tool one more time before downloading — handles silent
  ; installs (/S /OPTIONAL=OLLAMA) that bypass the OptionalCompShow page,
  ; and the rare case where the user installed a tool in another window
  ; between the page and this point.
  ${If} $OPT_SELECT_OLLAMA == "1"
    ${If} ${FileExists} "$LOCALAPPDATA\Programs\Ollama\ollama.exe"
      DetailPrint "Ollama already installed; skipping download."
    ${Else}
      StrCpy $CI_ID          "ollama"
      StrCpy $CI_DISPLAYNAME "Ollama"
      StrCpy $CI_URL         "${OLLAMA_URL}"
      StrCpy $CI_SHA256      "${OLLAMA_SHA256}"
      StrCpy $CI_SILENTFLAGS "${OLLAMA_FLAGS}"
      StrCpy $CI_RESULT      ""
      Call DoSilentInstaller
      ${If} $CI_RESULT != "OK"
        DetailPrint "Ollama install failed (continuing): $CI_RESULT"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ${If} $OPT_SELECT_LMSTUDIO == "1"
    ${If} ${FileExists} "$LOCALAPPDATA\Programs\LM Studio\LM Studio.exe"
      DetailPrint "LM Studio already installed; skipping download."
    ${Else}
      StrCpy $CI_ID          "lmstudio"
      StrCpy $CI_DISPLAYNAME "LM Studio"
      StrCpy $CI_URL         "${LMSTUDIO_URL}"
      StrCpy $CI_SHA256      "${LMSTUDIO_SHA256}"
      StrCpy $CI_SILENTFLAGS "${LMSTUDIO_FLAGS}"
      StrCpy $CI_RESULT      ""
      Call DoSilentInstaller
      ${If} $CI_RESULT != "OK"
        DetailPrint "LM Studio install failed (continuing): $CI_RESULT"
      ${EndIf}
    ${EndIf}
  ${EndIf}

  ; --- Phase C: telemetry POST stub (no-op until Phase 3 wires SQS) -------
  Call PostInstallTelemetry
!macroend

; ===========================================================================
; Helper: zip-extract install.
; In:  $CI_ID, $CI_URL, $CI_VERSION, $CI_EXTRACTTO, $CI_SENTINEL
; Out: $CI_RESULT = "OK" or error message
; ===========================================================================
Function DoZipExtract
  Push $R0
  Push $R1
  Push $R2
  Push $R3

  ; Validate id before embedding it in any path or PowerShell command.
  Push $CI_ID
  Call ValidateComponentId
  Pop $R0
  ${If} $R0 != "OK"
    StrCpy $CI_RESULT "$R0 (rejected — id failed validation)"
    Goto zip_done
  ${EndIf}

  ; Forward-slash → backslash for Windows paths
  Push $CI_EXTRACTTO
  Call SlashToBackslash
  Pop $R0  ; sanitized extractTo

  ; Download to $PLUGINSDIR\<id>.zip via curl.exe.
  ;   -f  fail on HTTP 4xx/5xx (returns non-zero exit)
  ;   -s  silent (no progress meter — installer log doesn't render it)
  ;   -S  show errors even with -s
  ;   -L  follow redirects (e.g. github.com release URLs)
  ;   --retry 2 + --retry-delay 3 covers transient network blips
  ;   --max-time 180 generous for the ~41 MB IPFS Kubo on a mediocre line
  StrCpy $R1 "$PLUGINSDIR\$CI_ID.zip"
  DetailPrint "Downloading $CI_DISPLAYNAME from $CI_URL..."
  nsExec::ExecToLog 'curl.exe -fsSL --retry 2 --retry-delay 3 --max-time 180 -o "$R1" "$CI_URL"'
  Pop $R2
  ${If} $R2 != "0"
    StrCpy $CI_RESULT "Download failed (curl exit $R2; see https://curl.se/docs/manpage.html#EXIT)"
    Goto zip_done
  ${EndIf}

  ; --- SHA-256 verify before extract --------------------------------------
  ; Catches CDN compromise / DNS hijack / cache poisoning / partial write
  ; that would otherwise hand us arbitrary code via tar.exe.
  ${If} $CI_SHA256 == "${COMPONENT_SHA_PLACEHOLDER}"
    StrCpy $CI_RESULT "Component SHA-256 placeholder not filled in (refusing to install $CI_DISPLAYNAME unverified)"
    Goto zip_done
  ${EndIf}
  StrCpy $R2 "$PLUGINSDIR\$CI_ID-hash.txt"
  Delete "$R2"
  DetailPrint "Verifying $CI_DISPLAYNAME SHA-256..."
  nsExec::ExecToLog 'cmd.exe /c certutil -hashfile "$R1" SHA256 > "$R2"'
  Pop $R3
  ${If} $R3 != "0"
    StrCpy $CI_RESULT "Hash compute failed (certutil exit $R3)"
    Goto zip_done
  ${EndIf}
  FileOpen $R3 "$R2" r
  FileRead $R3 $R2   ; line 1 (header — discarded)
  FileRead $R3 $R2   ; line 2 (the 64-char hex hash)
  FileClose $R3
  ; Strip trailing CR/LF that FileRead leaves on the read line.
  zip_trim_loop:
    StrCpy $R3 $R2 1 -1
    StrCmp $R3 "$\n" zip_trim_one
    StrCmp $R3 "$\r" zip_trim_one
    Goto zip_trim_done
    zip_trim_one:
      StrCpy $R2 $R2 -1
      Goto zip_trim_loop
  zip_trim_done:
  ${If} $R2 != $CI_SHA256
    StrCpy $CI_RESULT "SHA-256 mismatch for $CI_DISPLAYNAME — refusing to extract$\r$\n  expected: $CI_SHA256$\r$\n  got:      $R2"
    Goto zip_done
  ${EndIf}

  ; Target dir + sentinel path
  StrCpy $R0 "$INSTDIR\resources\$R0"
  CreateDirectory "$R0"
  StrCpy $R3 "$R0\$CI_SENTINEL"

  ; tar.exe ships with Windows 10 1803+ at C:\Windows\System32\tar.exe
  ; (bsdtar 3.x; handles zip files natively via libarchive). We use
  ; --strip-components=1 to peel off the outer "kubo/" / "nginx-1.26.2/"
  ; wrapping folder so binaries land directly under $R0\.
  ;
  ; Replaces the previous Expand-Archive + flatten dance — same reason as
  ; the curl swap above: PowerShell calls from elevated nsExec contexts
  ; are unreliable in ways tar.exe is not.
  DetailPrint "Extracting $CI_DISPLAYNAME..."
  nsExec::ExecToLog 'tar.exe -xf "$R1" -C "$R0" --strip-components=1'
  Pop $R1
  ${If} $R1 != "0"
    StrCpy $CI_RESULT "Extract failed (tar exit $R1)"
    Goto zip_done
  ${EndIf}

  ${IfNot} ${FileExists} "$R3"
    StrCpy $CI_RESULT "Sentinel file $R3 missing after extract"
    Goto zip_done
  ${EndIf}

  ; Write VERSION file matching what the runtime detector expects.
  FileOpen $R1 "$R0\VERSION" w
  FileWrite $R1 "$CI_VERSION$\r$\n"
  FileClose $R1

  StrCpy $CI_RESULT "OK"

  zip_done:
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
FunctionEnd

; ===========================================================================
; Helper: silent-installer install.
; In:  $CI_ID, $CI_URL, $CI_SILENTFLAGS
; Out: $CI_RESULT = "OK" or error message
; ===========================================================================
Function DoSilentInstaller
  Push $R0
  Push $R1
  Push $R2
  Push $R3

  ; Validate id (gets embedded in $PLUGINSDIR\<id>-installer.exe path).
  Push $CI_ID
  Call ValidateComponentId
  Pop $R0
  ${If} $R0 != "OK"
    StrCpy $CI_RESULT "$R0 (rejected — id failed validation)"
    Goto silent_done
  ${EndIf}

  ; Download via curl.exe. Bigger --max-time because Ollama is ~700 MB and
  ; LM Studio ~500 MB — slow connections need real budget.
  StrCpy $R0 "$PLUGINSDIR\$CI_ID-installer.exe"
  DetailPrint "Downloading $CI_DISPLAYNAME silent installer..."
  nsExec::ExecToLog 'curl.exe -fsSL --retry 2 --retry-delay 3 --max-time 1800 -o "$R0" "$CI_URL"'
  Pop $R1
  ${If} $R1 != "0"
    StrCpy $CI_RESULT "Download failed (curl exit $R1; see https://curl.se/docs/manpage.html#EXIT)"
    Goto silent_done
  ${EndIf}

  ; --- SHA-256 verify before launch --------------------------------------
  ; Catches GitHub release tampering / CDN compromise / DNS hijack that
  ; would otherwise hand us arbitrary code via the third-party installer's
  ; elevated UAC prompt (much higher blast radius than the zip-extract path).
  ${If} $CI_SHA256 == "${COMPONENT_SHA_PLACEHOLDER}"
    StrCpy $CI_RESULT "Component SHA-256 placeholder not filled in (refusing to launch $CI_DISPLAYNAME unverified)"
    Goto silent_done
  ${EndIf}
  StrCpy $R1 "$PLUGINSDIR\$CI_ID-hash.txt"
  Delete "$R1"
  DetailPrint "Verifying $CI_DISPLAYNAME SHA-256..."
  nsExec::ExecToLog 'cmd.exe /c certutil -hashfile "$R0" SHA256 > "$R1"'
  Pop $R2
  ${If} $R2 != "0"
    StrCpy $CI_RESULT "Hash compute failed (certutil exit $R2)"
    Goto silent_done
  ${EndIf}
  FileOpen $R2 "$R1" r
  FileRead $R2 $R3   ; line 1 (header — discarded)
  FileRead $R2 $R3   ; line 2 (the 64-char hex hash)
  FileClose $R2
  ; Strip trailing CR/LF that FileRead leaves on the read line.
  silent_trim_loop:
    StrCpy $R1 $R3 1 -1
    StrCmp $R1 "$\n" silent_trim_one
    StrCmp $R1 "$\r" silent_trim_one
    Goto silent_trim_done
    silent_trim_one:
      StrCpy $R3 $R3 -1
      Goto silent_trim_loop
  silent_trim_done:
  ${If} $R3 != $CI_SHA256
    StrCpy $CI_RESULT "SHA-256 mismatch for $CI_DISPLAYNAME — refusing to launch$\r$\n  expected: $CI_SHA256$\r$\n  got:      $R3"
    Goto silent_done
  ${EndIf}

  ; ExecWait surfaces the third-party installer's UAC prompt as a separate
  ; dialog — that's expected for non-Microsoft installers.
  DetailPrint "Running $CI_DISPLAYNAME installer silently..."
  ExecWait '"$R0" $CI_SILENTFLAGS' $R2
  ${If} $R2 != "0"
    StrCpy $CI_RESULT "Installer exited $R2"
    Goto silent_done
  ${EndIf}

  StrCpy $CI_RESULT "OK"

  silent_done:
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
FunctionEnd

; ===========================================================================
; Helpers
; ===========================================================================

; Validate that a component id contains only [A-Za-z0-9_-]. Defense-in-depth
; for the case where someone modifies a hardcoded CI_ID below to read from
; an external source (or a future refactor reintroduces the manifest path).
;
; In:  Stack: <id>
; Out: Stack: "OK" or error message
Function ValidateComponentId
  Exch $R0  ; id
  Push $R1
  Push $R2
  Push $R3
  StrLen $R1 $R0
  ${If} $R1 = 0
    StrCpy $R0 "Component id is empty"
    Goto vci_done
  ${EndIf}
  ${If} $R1 > 64
    StrCpy $R0 "Component id is too long ($R1 chars)"
    Goto vci_done
  ${EndIf}
  StrCpy $R2 0
  vci_loop:
    ${If} $R2 >= $R1
      StrCpy $R0 "OK"
      Goto vci_done
    ${EndIf}
    StrCpy $R3 $R0 1 $R2
    ${If} $R3 S>= "A"
    ${AndIf} $R3 S<= "Z"
      Goto vci_ok_char
    ${EndIf}
    ${If} $R3 S>= "a"
    ${AndIf} $R3 S<= "z"
      Goto vci_ok_char
    ${EndIf}
    ${If} $R3 S>= "0"
    ${AndIf} $R3 S<= "9"
      Goto vci_ok_char
    ${EndIf}
    ${If} $R3 == "_"
      Goto vci_ok_char
    ${EndIf}
    ${If} $R3 == "-"
      Goto vci_ok_char
    ${EndIf}
    StrCpy $R0 "Component id contains forbidden character: $R3"
    Goto vci_done
    vci_ok_char:
    IntOp $R2 $R2 + 1
    Goto vci_loop
  vci_done:
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

; Replace forward-slashes with backslashes. Manifest uses '/' for cross-
; platform consistency; Windows paths want '\'.
Function SlashToBackslash
  Exch $R0
  Push $R1
  Push $R2
  Push $R3
  StrCpy $R1 ""
  StrCpy $R2 0
  s2b_loop:
    StrCpy $R3 $R0 1 $R2
    StrCmp $R3 "" s2b_done
    ${If} $R3 == "/"
      StrCpy $R1 "$R1\"
    ${Else}
      StrCpy $R1 "$R1$R3"
    ${EndIf}
    IntOp $R2 $R2 + 1
    Goto s2b_loop
  s2b_done:
  StrCpy $R0 $R1
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

; Remove any partial extras/ subdirs left behind when a required component
; install aborts mid-extract.
Function CleanupPartialExtras
  RMDir /r "$INSTDIR\resources\extras"
FunctionEnd

; Telemetry POST. Phase 3 wires the real endpoint. For now this is a no-op
; that just logs the install ID for debugging.
Function PostInstallTelemetry
  DetailPrint "Install complete (telemetry id: $TEL_INSTALL_ID)"
FunctionEnd

; ===========================================================================
; customFinishPage — Ollama / LM Studio detection + in-app deeplink.
; ===========================================================================
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
  StrCpy $OLLAMA_PRESENT "0"
  StrCpy $LMSTUDIO_PRESENT "0"
  IfFileExists "$LOCALAPPDATA\Programs\Ollama\ollama.exe" 0 ollama_check_done
    StrCpy $OLLAMA_PRESENT "1"
  ollama_check_done:
  IfFileExists "$LOCALAPPDATA\Programs\LM Studio\LM Studio.exe" 0 lmstudio_check_done
    StrCpy $LMSTUDIO_PRESENT "1"
  lmstudio_check_done:

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
  StrCpy $FINISH_BODY_TEXT "$FINISH_BODY_TEXT$\r$\n$\r$\nConfigure providers + API keys on the LLMs page after launch. Add or repair components from Settings → Components inside the app."

  ${If} $OLLAMA_PRESENT == "0"
    StrCpy $FINISH_LINK_LABEL "Download Ollama"
    StrCpy $FINISH_LINK_URL "https://ollama.com/download"
  ${ElseIf} $LMSTUDIO_PRESENT == "0"
    StrCpy $FINISH_LINK_LABEL "Download LM Studio"
    StrCpy $FINISH_LINK_URL "https://lmstudio.ai"
  ${Else}
    ; Both LLM tools detected — leave the link control empty. NSIS renders
    ; an invisible link when both label and URL are empty strings.
    StrCpy $FINISH_LINK_LABEL ""
    StrCpy $FINISH_LINK_URL ""
  ${EndIf}
FunctionEnd

!endif ; !ifndef BUILD_UNINSTALLER
