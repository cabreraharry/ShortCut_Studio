; ShortCut Studio — custom NSIS hooks
; Included by electron-builder's NSIS template via nsis.include. Defines
; macros that electron-builder calls back at well-known points in the
; install lifecycle.

; ---------------------------------------------------------------------------
; customFinish — runs at the end of the install, before the Finish page closes.
;
; Surfaces optional local-LLM tools (Ollama, LM Studio) at install time so the
; user can opt in without remembering URLs later. Both tools have their own
; polished installers; we don't try to silently install them. Picking "Yes"
; opens both download pages in the user's default browser. Picking "No" is a
; no-op — the same links remain accessible inside the app on the LLMs page.
;
; /SD IDNO makes the default for silent installs (`Setup.exe /S`) "No", so
; running this in CI / unattended doesn't pop up unexpected browser tabs.
; ---------------------------------------------------------------------------
!macro customFinish
  ; Label is uniquified with __LINE__ so it can't collide with a future
  ; electron-builder template label of the same name (NSIS labels are
  ; file-global, not macro-scoped).
  MessageBox MB_YESNO "ShortCut Studio works best with at least one LLM provider configured.$\r$\n$\r$\nWould you like to open the download pages for the recommended local LLM tools?$\r$\n$\r$\n  - Ollama  (https://ollama.com)$\r$\n  - LM Studio  (https://lmstudio.ai)$\r$\n$\r$\nYou can always do this later from inside the app on the LLMs page." /SD IDNO IDNO scs_skip_optional_llm_tools_${__LINE__}
    ExecShell "open" "https://ollama.com/download"
    ExecShell "open" "https://lmstudio.ai/"
  scs_skip_optional_llm_tools_${__LINE__}:
!macroend
