const clientProof = [
  { value: "25 MWp", label: "a national property and retail group" },
  { value: "48 sites", label: "a JSE-listed residential developer" },
  { value: "12 MWp across 25 buildings", label: "a listed property fund" },
];

export function ClientProofSection() {
  return (
    <section className="bg-muted/60 py-16 md:py-20">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-crunch-yellow">
            Who&apos;s on the platform
          </p>
          <h2 className="mt-3 text-3xl font-bold lowercase text-crunch-black md:text-4xl">
            from single farms to 25 MWp portfolios.
          </h2>
          <p className="mt-5 text-muted-foreground md:text-lg">
            Property funds, retailers, manufacturers, farms, schools and game reserves — 600+ solar
            owners across South Africa are already registered on the Crunch Carbon Hub.
          </p>
        </div>

        <dl className="mt-10 grid gap-5 md:grid-cols-3">
          {clientProof.map((item) => (
            <div key={item.value} className="rounded-lg border border-border bg-card p-7 text-center">
              <dt className="text-2xl font-bold text-crunch-black md:text-3xl">{item.value}</dt>
              <dd className="mt-2 text-sm text-muted-foreground">{item.label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}