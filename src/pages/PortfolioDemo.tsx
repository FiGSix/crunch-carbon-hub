import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSignature, Layers3, Zap } from "lucide-react";

/** Read-only design preview of the portfolio signing page. Sample data only — nothing is saved. */
const SAMPLE_PROJECT_COUNT = 12;
const SAMPLE_TOTAL_KWP = 23_705;

export default function PortfolioDemo() {
  const tiles = [
    { icon: Layers3, label: "Projects", value: String(SAMPLE_PROJECT_COUNT) },
    { icon: Zap, label: "Portfolio size", value: `${(SAMPLE_TOTAL_KWP / 1000).toFixed(1)} MWp` },
  ];

  return (
    <main className="min-h-screen bg-background">
      <div className="bg-accent text-accent-foreground text-center text-sm py-2 px-4">
        <strong>Design preview – sample data.</strong> The project count and portfolio size are made up; signing is disabled.
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-2">
          <Badge variant="outline">Portfolio proposal</Badge>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Hi Shaun, here is your solar portfolio</h1>
          <p className="text-muted-foreground">Sample Property Group (Pty) Ltd · One signature covers this complete portfolio.</p>
        </header>

        <section className="grid grid-cols-2 gap-3">
          {tiles.map(({ icon: Icon, label, value }) => (
            <Card key={label}><CardContent className="p-4">
              <Icon className="h-5 w-5 text-primary mb-2" />
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="text-xl font-bold text-foreground">{value}</div>
            </CardContent></Card>
          ))}
        </section>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileSignature className="h-5 w-5" />Cession Agreement</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="h-48 overflow-y-auto rounded-md border border-border p-4 text-sm text-muted-foreground">
              <p className="mb-3">This signature covers all {SAMPLE_PROJECT_COUNT} projects in the {`${(SAMPLE_TOTAL_KWP / 1000).toFixed(1)} MWp`} portfolio. Each project-specific Cession Agreement will include its own proposal details. (Sample text for layout review.)</p>
              {Array.from({ length: 12 }).map((_, i) => <p key={i} className="mb-3">Clause {i + 1}. The agreement text appears here exactly as on the normal signing page. Scroll to the end to unlock signing.</p>)}
            </div>
            <Button className="w-full" size="lg" disabled>
              Signing disabled in preview
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
