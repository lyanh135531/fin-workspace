export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-3xl items-center px-6 py-16">
      <section>
        <p className="text-sm font-medium text-zinc-500">Phase 0</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-zinc-950">
          Fin Workspace foundation is ready.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-600">
          Database schema, precision rules, and workspace data boundaries are being established before financial workflows are enabled.
        </p>
      </section>
    </main>
  );
}
