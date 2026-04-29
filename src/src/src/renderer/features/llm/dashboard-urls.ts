// URLs verified live 2026-04-29 (HEAD-checked redirect chains).
// Anthropic redirects console.anthropic.com → platform.claude.com; using the
// canonical destination so the user lands on the right page in one hop instead
// of two. Local providers (Ollama, LM Studio) intentionally absent — they
// have no remote billing surface.
export const USAGE_DASHBOARD_URL: Record<string, string> = {
  OpenAI: 'https://platform.openai.com/usage',
  Claude: 'https://platform.claude.com/settings/usage',
  Gemini: 'https://aistudio.google.com/usage',
  HuggingFace: 'https://huggingface.co/settings/billing'
}
