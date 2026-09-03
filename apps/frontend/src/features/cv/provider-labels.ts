const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
  ollama: 'a self-hosted model',
}

export const providerLabel = (id: string | null | undefined): string | null => {
  if (!id) return null
  return PROVIDER_LABELS[id] ?? id
}
