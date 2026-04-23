import type { ClassifierAdapter } from './index'

// Clipboard "adapter" — never called by the orchestrator. It exists so the
// provider registry has a stable entry; the clipboard flow uses separate IPC
// (FiltersClipboardPrompt / FiltersClipboardApply) that generates the prompt
// and parses the user-pasted response via the shared prompts module.
export const clipboardAdapter: ClassifierAdapter = {
  provider: 'clipboard',
  defaultModel: 'clipboard:external',
  classify: async () => {
    throw new Error(
      "clipboard provider is handled via FiltersClipboardPrompt/FiltersClipboardApply, not direct classify()"
    )
  }
}
