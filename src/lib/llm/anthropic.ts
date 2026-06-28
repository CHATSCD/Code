import type { ChatTurn, LlmClient } from './types';
import { LlmError } from './types';

export class AnthropicClient implements LlmClient {
  constructor(
    private apiKey: string,
    private model: string,
    private baseUrl: string = 'https://api.anthropic.com/v1'
  ) {}

  async complete(messages: ChatTurn[]): Promise<string> {
    const system = messages.find((m) => m.role === 'system')?.content;
    const turns = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role, content: m.content }));

    const url = `${this.baseUrl.replace(/\/$/, '')}/messages`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: this.model,
          system,
          messages: turns,
          max_tokens: 2048,
          temperature: 0.1,
        }),
      });
    } catch (err) {
      throw new LlmError(`Could not reach Anthropic: ${(err as Error).message}`);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new LlmError(`Anthropic returned ${res.status}: ${body.slice(0, 500)}`);
    }

    const data = await res.json();
    const content = data?.content?.[0]?.text;
    if (typeof content !== 'string') {
      throw new LlmError('Anthropic returned an unexpected response shape.');
    }
    return content;
  }
}
