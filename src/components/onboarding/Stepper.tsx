const STEPS = ['Welcome', 'Connect a database', 'Set up AI', 'Done'];

export function Stepper({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-2">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
              i <= current ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {i + 1}
          </div>
          <span className={`hidden text-sm sm:inline ${i <= current ? 'text-slate-900' : 'text-slate-400'}`}>
            {label}
          </span>
          {i < STEPS.length - 1 && <div className="h-px w-6 bg-slate-300 sm:w-10" />}
        </div>
      ))}
    </div>
  );
}
