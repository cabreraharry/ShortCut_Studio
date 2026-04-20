export interface OnboardingStep {
  title: string
  body: string
  link?: { label: string; url: string }
}

export interface ProviderGuide {
  providerName: string
  intro: string
  steps: OnboardingStep[]
  keyFormat?: string
  keyPlaceholder: string
}

export const PROVIDER_GUIDES: Record<string, ProviderGuide> = {
  OpenAI: {
    providerName: 'OpenAI',
    intro:
      "OpenAI's API is usage-priced. You'll need a billing method on file before the key works. Use OpenAI only for busy-work tasks — don't share expertise you want to keep.",
    steps: [
      {
        title: 'Create an OpenAI account',
        body: 'Sign up (or sign in) at platform.openai.com. Free accounts can generate keys but most models require a paid plan.',
        link: { label: 'platform.openai.com', url: 'https://platform.openai.com/signup' }
      },
      {
        title: 'Add a billing method',
        body: 'Go to Settings → Billing and add a card. Without billing, most models return a 429 quota error even on fresh keys.',
        link: { label: 'Billing', url: 'https://platform.openai.com/settings/organization/billing/overview' }
      },
      {
        title: 'Create an API key',
        body: 'Go to Settings → API keys and click "Create new secret key". Copy it immediately — you only see it once.',
        link: { label: 'API keys', url: 'https://platform.openai.com/api-keys' }
      },
      {
        title: 'Paste the key below',
        body: 'Paste the key into the OpenAI row in this page. SCL stores it locally in your SQLite DB — never shared with us.'
      }
    ],
    keyFormat: 'sk-... (typically 164+ characters)',
    keyPlaceholder: 'sk-...'
  },
  Claude: {
    providerName: 'Claude (Anthropic)',
    intro: "Anthropic's Claude API is usage-priced. Keys start with 'sk-ant-'. Use for summarization and busy-work; not for proprietary analysis.",
    steps: [
      {
        title: 'Create an Anthropic Console account',
        body: 'Sign up at console.anthropic.com with email or Google.',
        link: { label: 'console.anthropic.com', url: 'https://console.anthropic.com' }
      },
      {
        title: 'Add billing (pay-as-you-go)',
        body: "Go to Settings → Plans & Billing. Claude won't respond without credits on your account.",
        link: { label: 'Billing', url: 'https://console.anthropic.com/settings/billing' }
      },
      {
        title: 'Create an API key',
        body: 'In Settings → API Keys, click "Create Key". Name it "SCL Admin" so you can identify it later. Copy once.',
        link: { label: 'API keys', url: 'https://console.anthropic.com/settings/keys' }
      },
      {
        title: 'Paste the key below',
        body: 'Paste into the Claude row. Stored locally in your SQLite DB.'
      }
    ],
    keyFormat: 'sk-ant-api03-... (typically 100+ characters)',
    keyPlaceholder: 'sk-ant-api03-...'
  },
  Gemini: {
    providerName: 'Gemini (Google)',
    intro: "Google's Gemini API has a generous free tier. Good for topic generation at low volume. Created via Google AI Studio (not Google Cloud Console).",
    steps: [
      {
        title: 'Open Google AI Studio',
        body: 'Sign in with a Google account at ai.google.dev. Regional restrictions may apply.',
        link: { label: 'ai.google.dev', url: 'https://ai.google.dev/' }
      },
      {
        title: 'Go to "Get API key"',
        body: 'Click "Get API key" in the left nav, then "Create API key in new project".',
        link: { label: 'API key page', url: 'https://aistudio.google.com/apikey' }
      },
      {
        title: 'Copy your key',
        body: 'Keys start with "AIza...". You can rotate them anytime from the same page.'
      },
      {
        title: 'Paste the key below',
        body: 'Paste into the Gemini row. Stored locally in your SQLite DB.'
      }
    ],
    keyFormat: 'AIza... (39 characters)',
    keyPlaceholder: 'AIza...'
  },
  Ollama: {
    providerName: 'Ollama (local)',
    intro:
      "Ollama runs open-source LLMs on your own machine. No API key, no usage fees, maximum privacy. The right default for work you don't want to share with commercial LLMs.",
    steps: [
      {
        title: 'Install Ollama',
        body: 'Download the Windows installer from ollama.com. It runs as a background service on port 11434.',
        link: { label: 'ollama.com/download', url: 'https://ollama.com/download' }
      },
      {
        title: 'Pull a model',
        body: "Open a terminal and run 'ollama pull llama3.2' (or another model). Pulls can take 1–10 minutes depending on size.",
        link: { label: 'Model library', url: 'https://ollama.com/library' }
      },
      {
        title: 'Verify Ollama is running',
        body: "Click 'Test connection' in the Ollama row. If ✓, you're set — no API key needed. If ✗, make sure Ollama is running (look for its tray icon)."
      }
    ],
    keyPlaceholder: '(no key required)'
  }
}
