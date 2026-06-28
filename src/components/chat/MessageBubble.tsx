import type { ChatMessage } from '@/types';
import { ResultTable } from './ResultTable';

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[75%] ${isUser ? '' : 'w-full'}`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            isUser ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-800'
          }`}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        {!isUser && message.sql && (
          <details className="mt-1.5 px-1">
            <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">
              View SQL query
            </summary>
            <pre className="mt-1.5 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
              <code>{message.sql}</code>
            </pre>
          </details>
        )}

        {!isUser && message.result && <ResultTable result={message.result} />}
      </div>
    </div>
  );
}
