import { redirect } from 'next/navigation';
import { listConnections } from '@/lib/db/app-db';

export default function HomePage() {
  const connections = listConnections();
  if (connections.length === 0) {
    redirect('/onboarding');
  }
  redirect('/chat');
}
