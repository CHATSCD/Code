'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Stepper } from '@/components/onboarding/Stepper';
import { ConnectStep } from '@/components/onboarding/ConnectStep';
import { ProviderStep } from '@/components/onboarding/ProviderStep';
import type { Connection } from '@/types';

type Step = 0 | 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [connection, setConnection] = useState<Connection | null>(null);

  function finish() {
    if (connection) {
      router.push(`/chat?connection=${connection.id}`);
    } else {
      router.push('/chat');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl">
        <Stepper current={step} />

        {step === 0 && (
          <Card className="p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900">Welcome to ChatData</h1>
            <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">
              Ask your database questions in plain English and get instant answers — no SQL required. Two
              quick steps and you&apos;re chatting with your data.
            </p>
            <Button className="mt-6" onClick={() => setStep(1)}>
              Get started
            </Button>
          </Card>
        )}

        {step === 1 && (
          <ConnectStep
            onConnected={(conn) => {
              setConnection(conn);
              setStep(2);
            }}
          />
        )}

        {step === 2 && <ProviderStep onDone={() => setStep(3)} onSkip={() => setStep(3)} />}

        {step === 3 && (
          <Card className="p-8 text-center">
            <h2 className="text-xl font-semibold text-slate-900">You&apos;re all set!</h2>
            <p className="mt-2 text-sm text-slate-500">Start asking questions about your data.</p>
            <Button className="mt-6" onClick={finish}>
              Go to chat
            </Button>
          </Card>
        )}
      </div>
    </main>
  );
}
