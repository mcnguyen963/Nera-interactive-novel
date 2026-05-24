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

export function buildPreviousChaptersContext(
  chapters: { title: string; paragraphs: { text: string; role: string }[] }[],
  maxChars: number = 15000,
): string {
  let allText = ''
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]
    allText += `\n--- ${ch.title} ---\n`
    for (const para of ch.paragraphs) {
      if (para.text.trim()) {
        allText += para.text + '\n'
      }
    }
  }
  if (allText.length > maxChars) {
    allText = allText.slice(0, maxChars)
  }
  return allText.trim()
}
