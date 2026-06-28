import type { ProviderSettings } from '@/types';
import type { LlmClient } from './types';
import { OpenAiCompatibleClient } from './openai';
import { AnthropicClient } from './anthropic';

export type { LlmClient, ChatTurn } from './types';
export { LlmError } from './types';

export function getLlmClient(settings: ProviderSettings): LlmClient {
  switch (settings.provider) {
    case 'anthropic':
      return new AnthropicClient(settings.apiKey, settings.model, settings.baseUrl || undefined);
    case 'mistral':
      return new OpenAiCompatibleClient(settings.apiKey, settings.model, settings.baseUrl || 'https://api.mistral.ai/v1');
    case 'openai-compatible':
      return new OpenAiCompatibleClient(
        settings.apiKey,
        settings.model,
        settings.baseUrl || 'http://localhost:11434/v1'
      );
    case 'openai':
    default:
      return new OpenAiCompatibleClient(settings.apiKey, settings.model, settings.baseUrl || undefined);
  }
}
