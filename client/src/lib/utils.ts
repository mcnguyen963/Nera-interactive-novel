export function generateId(): string {
  return crypto.randomUUID()
}

export function timestamp(): number {
  return Date.now()
}

export function buildKVContext(
  scenario: { setting: string; companion: string; player: string; hook: string },
  recentParagraphs: { text: string }[],
  maxChars: number = 3000,
): string {
  const recentText = recentParagraphs.map(p => p.text).join('\n').slice(-maxChars)
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
