export default function Home() {
  return (
    <main className="max-w-[1400px] mx-auto p-6">
      <header className="flex justify-between items-center mb-8 pb-6 border-b-2 border-border-color">
        <h1 className="text-3xl font-bold text-text-primary">
          Program Nova Dashboard
        </h1>
        <div className="flex gap-8">
          <div className="flex flex-col items-end">
            <span className="text-sm text-text-secondary mb-1">Status</span>
            <span className="text-xl font-semibold text-text-primary">Ready</span>
          </div>
        </div>
      </header>
      <div className="bg-bg-secondary border border-border-color rounded-lg p-6">
        <p className="text-text-secondary">
          Dashboard initialized. Phase 2 will add core infrastructure.
        </p>
      </div>
    </main>
  );
}
