export type LlmProvider = 'local' | 'openrouter';

export interface LlmSettings {
  provider: LlmProvider;
  localUrl: string;
  localModel: string;
  openrouterModel: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  contextWindow: number;
  systemPrompt: string;
}

export type ImageProvider = 'local' | 'cloud';

export interface ImageSettings {
  provider: ImageProvider;
  localUrl: string;
  cloudApiKey: string;
  model: string;
  corsProxyUrl: string;
  comfyWorkflow: string;
}

export interface BackupSettings {
  cloudTextBackup: boolean;
  cloudImageBackup: boolean;
}
