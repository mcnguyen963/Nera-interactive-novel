export interface UserProfile {
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FirestoreStory {
  id: string;
  userId: string;
  title: string;
  subtitle: string;
  scenarioId: string;
  scenario: {
    setting: string;
    companion: string;
    player: string;
    hook: string;
  };
  createdAt: number;
  updatedAt: number;
}

export interface FirestoreChapter {
  id: string;
  title: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  paragraphs: {
    id: string;
    text: string;
    role: 'narrator' | 'player';
    images: string[];
    order: number;
  }[];
}
