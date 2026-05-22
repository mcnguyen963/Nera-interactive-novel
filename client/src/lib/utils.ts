export function generateId(): string {
  return crypto.randomUUID()
}

export function timestamp(): number {
  return Date.now()
}

const TOKEN_CHAR_ESTIMATE = 4

export function buildKVContext(
  scenario: { setting: string; companion: string; player: string; hook: string },
  recentParagraphs: { text: string }[],
  maxTokens: number = 3000,
): string {
  const maxChars = maxTokens * TOKEN_CHAR_ESTIMATE
  let recentText = ''
  for (let i = recentParagraphs.length - 1; i >= 0; i--) {
    const candidate = recentParagraphs[i].text + '\n' + recentText
    if (candidate.length > maxChars) break
    recentText = candidate
  }
  const kv: Record<string, string> = {
    'Story World': scenario.setting,
    'Companion/NPC': scenario.companion,
    'Your Role': scenario.player,
    'Recent Events': recentText,
  }
  return Object.entries(kv)
    .filter(([_, v]) => v && v.trim())
    .map(([k, v]) => `[${k}]\n${v}`)
    .join('\n\n')
}
