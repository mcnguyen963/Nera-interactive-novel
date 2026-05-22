export type ParaRole = 'narrator' | 'player';

export interface Paragraph {
  id: string;
  text: string;
  role: ParaRole;
  images: string[];
  imageDescriptions: string[];
  order: number;
}

export interface Chapter {
  id: string;
  title: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  paragraphs: Paragraph[];
}

export interface Scenario {
  setting: string;
  companion: string;
  player: string;
  hook: string;
}

export interface Story {
  id: string;
  userId: string;
  title: string;
  subtitle: string;
  scenarioId: string;
  scenario: Scenario;
  createdAt: number;
  updatedAt: number;
}

export interface ScenarioDef {
  id: string;
  title: string;
  sub: string;
  tag: string;
  setting: string;
  char: string;
  hook: string;
  player: string;
}

export interface Draft {
  id: string;
  story: Story;
  chapters: Chapter[];
  activeChapterIndex: number;
  savedAt: number;
}
