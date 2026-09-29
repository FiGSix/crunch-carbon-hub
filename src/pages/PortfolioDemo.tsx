import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, FileSignature, Sun, Zap, Wallet, Percent } from "lucide-react";

/** Read-only design preview of the portfolio signing page. Sample data only — nothing is saved. */
const SITES: [string, string, number][] = [
  ["Northgate Mall", "Johannesburg, Gauteng", 8000],
  ["Riverside Mall Phase 2", "Vanderbijlpark, Gauteng", 3500],
  ["Eastern Cape Plaza", "Mthatha, Eastern Cape", 2200],
  ["Springfield Centre", "Springs, Gauteng", 1800],
  ["Harbour Walk", "Gqeberha, Eastern Cape", 1600],
  ["Limpopo Crossing", "Thohoyandou, Limpopo", 1400],
  ["Highveld Mall Phase 2", "Middelburg, Mpumalanga", 1300],
  ["Limpopo Crossing Phase 2", "Thohoyandou, Limpopo", 1300],
  ["Limpopo Retail Park", "Thohoyandou, Limpopo", 1152],
  ["Border Mall Phase 2", "Musina, Limpopo", 835],
  ["The Village Square", "Pretoria, Gauteng", 318],
  ["Parkside Centre", "Durban, KwaZulu-Natal", 300],
];
const RATE = 65;
const zar = (n: number) => "R " + Math.round(n).toLocaleString("en-ZA");

export default function PortfolioDemo() {
  const [open, setOpen] = useState<number | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const totalKwp = SITES.reduce((s, x) => s + x[2], 0);
  const tiles = [
    { icon: Sun, label: "Sites", value: String(SITES.length) },
    { icon: Zap, label: "Total capacity", value: `${(totalKwp / 1000).toFixed(1)} MWp` },
    { icon: Wallet, label: "Est. yearly income", value: zar(totalKwp * RATE) },
    { icon: Percent, label: "Your share", value: "70%" },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-accent text-accent-foreground text-center text-sm py-2 px-4">
        <strong>Design preview – sample data.</strong> Sites and figures are made up; signing is disabled.
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <Badge variant="outline">Portfolio proposal</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Hi Shaun, here is your solar portfolio</h1>
          <p className="text-muted-foreground">Sample Property Group (Pty) Ltd · Review every site below and sign one Cession Agreement that covers them all.</p>
        </header>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tiles.map(({ icon: Icon, label, value }) => (
            <Card key={label}><CardContent className="p-4">
              <Icon className="h-5 w-5 text-primary mb-2" />
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="text-xl font-bold text-foreground">{value}</div>
            </CardContent></Card>
          ))}
        </section>

        <Card>
          <CardHeader><CardTitle>Your sites</CardTitle></CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {SITES.map(([name, addr, kwp], i) => (
                <li key={name}>
                  <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => setOpen(open === i ? null : i)}>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{name}</div>
                      <div className="text-xs text-muted-foreground truncate">{addr}</div>
                    </div>
                    <div className="text-sm text-right whitespace-nowrap">
                      <div>{kwp.toLocaleString("en-ZA")} kWp</div>
                      <div className="text-muted-foreground">{zar(kwp * RATE)}/yr</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 transition-transform ${open === i ? "rotate-180" : ""}`} />
                  </button>
                  {open === i && (
                    <dl className="grid grid-cols-2 gap-2 px-4 pb-4 text-sm">
                      <dt className="text-muted-foreground">Est. yearly generation</dt><dd>{Math.round(kwp * 1.6).toLocaleString("en-ZA")} MWh</dd>
                      <dt className="text-muted-foreground">Claimable from</dt><dd>1 July 2026</dd>
                      <dt className="text-muted-foreground">10-year income</dt><dd>{zar(kwp * RATE * 10)}</dd>
                    </dl>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" />Cession Agreement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="h-48 overflow-y-auto rounded-md border border-border p-4 text-sm text-muted-foreground"
              onScroll={(e) => { const t = e.currentTarget; if (t.scrollTop + t.clientHeight >= t.scrollHeight - 8) setUnlocked(true); }}>
              <p className="mb-3">This single agreement covers all {SITES.length} sites listed above. (Sample text for layout review.)</p>
              {Array.from({ length: 12 }).map((_, i) => <p key={i} className="mb-3">Clause {i + 1}. The agreement text appears here exactly as on the normal signing page. Scroll to the end to unlock signing.</p>)}
            </div>
            <Button className="w-full" size="lg" disabled>
              {unlocked ? `Sign once for all ${SITES.length} sites (disabled in preview)` : "Scroll through the agreement to unlock signing"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
