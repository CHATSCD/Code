import { redirect } from 'next/navigation';
import { listConnections } from '@/lib/db/app-db';

export default async function HomePage() {
  const connections = await listConnections();
  if (connections.length === 0) {
    redirect('/onboarding');
  }
  redirect('/chat');
}
