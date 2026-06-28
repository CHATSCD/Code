import type { ChatTurn, LlmClient } from './types';
import { LlmError } from './types';

/**
 * Works for OpenAI itself, and for any "OpenAI-compatible" endpoint
 * (Ollama, LM Studio, OpenRouter, vLLM, etc.) by overriding baseUrl.
 */
export class OpenAiCompatibleClient implements LlmClient {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string = 'https://api.openai.com/v1'
  ) {}

  async complete(messages: ChatTurn[]): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.1,
        }),
      });
    } catch (err) {
      throw new LlmError(`Could not reach the AI provider at ${this.baseUrl}: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LlmError(`AI provider returned ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new LlmError('AI provider returned an unexpected response shape.');
    }
    return content;
  }
}
