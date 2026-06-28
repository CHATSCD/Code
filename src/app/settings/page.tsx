import Link from 'next/link';
import { ProviderSettingsCard } from '@/components/settings/ProviderSettingsCard';
import { ConnectionsCard } from '@/components/settings/ConnectionsCard';

export default function SettingsPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <Link href="/chat" className="text-sm font-medium text-brand-600 hover:underline">
            ← Back to chat
          </Link>
        </div>
        <div className="flex flex-col gap-6">
          <ConnectionsCard />
          <ProviderSettingsCard />
        </div>
      </div>
    </main>
  );
}
