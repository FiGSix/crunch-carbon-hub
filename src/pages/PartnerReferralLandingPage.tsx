import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";
import crunchLogo from "@/assets/crunch-carbon-logo.png.asset.json";
import { calculateComplete } from "@/services/calculations/carbon/core";

const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
];
const PROPERTY_TYPES = ["Residential", "Commercial", "Agricultural", "Industrial"];

interface PartnerInfo {
  valid: boolean;
  link_type?: "client" | "agent";
  link_id?: string;
  token?: string;
  owner_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  avatar_url?: string | null;
  company_logo_url?: string | null;
  referral_bio?: string | null;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  hasExisting: "yes" | "planning" | "no" | "";
  sizeKwp: string;
  province: string;
  propertyType: string;
}

export default function PartnerReferralLandingPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [step, setStep] = useState(0); // 0..3
  const [submitting, setSubmitting] = useState(false);
  const [proposalCreated, setProposalCreated] = useState(false);

  const prefersReducedMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    phone: "",
    hasExisting: "",
    sizeKwp: "",
    province: "",
    propertyType: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.rpc("get_referral_partner_info", { p_token: token });
      if (cancelled) return;
      if (error || !data) {
        setPartner({ valid: false });
        setLoading(false);
        return;
      }
      const info = data as unknown as PartnerInfo;
      if (info?.link_type === "agent") {
        // Agent-recruitment link: stash token and route to register
        try {
          localStorage.setItem("crunchcarbon_ref", JSON.stringify({ token, link_type: "agent" }));
        } catch {
          /* noop */
        }
        navigate("/register?role=agent&ref=" + encodeURIComponent(token));
        return;
      }
      setPartner(info);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const partnerName = [partner?.first_name, partner?.last_name].filter(Boolean).join(" ") || "Your partner";
  const ogTitle = partner?.first_name
    ? `${partner.first_name}${partner.company_name ? " from " + partner.company_name : ""} wants to show you what your solar earns`
    : "Find out what your solar earns · Crunch Carbon";
  const ogImage = partner?.avatar_url || "/og-default.png";
  const pageUrl = typeof window !== "undefined"
    ? `${window.location.origin}/ref/${token ?? ""}`
    : `https://crunchcarbon.com/ref/${token ?? ""}`;

  const [carbonProjection, setCarbonProjection] = useState({
    kwp: 0,
    annualEnergyMWh: 0,
    carbonTonnes: 0,
    clientRevenuePerYear: 0,
  });
  const [calcLoading, setCalcLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const kwp = parseFloat(form.sizeKwp) || 0;
    if (!kwp || kwp <= 0) {
      setCarbonProjection({ kwp: 0, annualEnergyMWh: 0, carbonTonnes: 0, clientRevenuePerYear: 0 });
      return;
    }
    setCalcLoading(true);
    (async () => {
      try {
        const result = await calculateComplete({
          sizeKwp: kwp,
          province: form.province || undefined,
          // Use Jan 1 of current year so the headline reflects a full 12 months
          // of revenue at the current vintage price (not pro-rated from today).
          commissionDate: new Date(new Date().getFullYear(), 0, 1).toISOString(),
        });
        if (cancelled) return;
        setCarbonProjection({
          kwp,
          annualEnergyMWh: result.annualEnergyKwh / 1000,
          carbonTonnes: result.carbonCreditsPerYear,
          clientRevenuePerYear: result.clientRevenuePerYear,
        });
      } catch {
        if (cancelled) return;
        setCarbonProjection({ kwp, annualEnergyMWh: 0, carbonTonnes: 0, clientRevenuePerYear: 0 });
      } finally {
        if (!cancelled) setCalcLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form.sizeKwp, form.province]);

  const progress = ((step + 1) / 4) * 100;

  function validateStep(s: number): string | null {
    if (s === 0) {
      if (!form.name.trim()) return "Please enter your name";
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return "Please enter a valid email";
    }
    if (s === 1) {
      if (!form.hasExisting) return "Please tell us about your solar status";
      const kwp = parseFloat(form.sizeKwp);
      if (!kwp || kwp <= 0) return "Please enter a valid system size";
      if (!form.province) return "Please select your province";
      if (!form.propertyType) return "Please select a property type";
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {
      toast({ title: "Almost there", description: err, variant: "destructive" });
      return;
    }
    setStep((s) => Math.min(3, s + 1));
  }
  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function submit() {
    if (!token) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-referral-proposal", {
        body: {
          token,
          client: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
          },
          system: {
            size_kwp: parseFloat(form.sizeKwp),
            property_type: form.propertyType,
            province: form.province,
            has_existing: form.hasExisting === "yes",
          },
        },
      });
      const resp = (data ?? {}) as { success?: boolean; error?: string };
      if (error || !resp.success) {
        throw new Error(resp.error || error?.message || "Could not create your proposal");
      }
      setProposalCreated(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      toast({ title: "Proposal could not be sent", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="h-8 w-8 animate-spin text-[#F5C518]" aria-hidden="true" />
      </div>
    );
  }

  if (!partner?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-zinc-100 px-4">
        <div className="max-w-md w-full text-center space-y-3">
          <h1 className="text-2xl font-bold">This link is no longer active.</h1>
          <p className="text-zinc-400">Ask your partner for an updated link, or visit Crunch Carbon directly.</p>
          <Button
            onClick={() => navigate("/")}
            className="w-full bg-[#F5C518] text-black hover:bg-[#FFD23F]"
          >
            Go to Crunch Carbon
          </Button>
        </div>
      </div>
    );
  }

  const YELLOW = "#F5C518";
  const cardClass = "rounded-xl bg-[#141414] border border-[rgba(245,197,24,0.15)]";
  const inputClass =
    "bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 focus-visible:ring-[rgba(245,197,24,0.4)] focus-visible:border-[#F5C518]";
  const selectClass =
    "w-full h-12 rounded-md border border-zinc-700 bg-zinc-900 px-3 text-base text-white focus:outline-none focus:border-[#F5C518] focus:ring-2 focus:ring-[rgba(245,197,24,0.4)]";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 pb-32 md:pb-12">
      <Helmet>
        <title>{`${partnerName} · Crunch Carbon`}</title>
        <meta name="description" content="Free 3-minute assessment. Find out how much your solar system could earn in carbon credits — no account needed." />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content="Free 3-minute assessment. Find out how much your solar system could earn in carbon credits — no account needed." />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>

      {/* Top bar */}
      <header className="bg-gradient-to-b from-black/60 to-transparent backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <img
            src={crunchLogo.url}
            alt="Crunch Carbon"
            className="h-12 w-auto object-contain"
          />
          {partner.company_logo_url && (
            <img
              src={partner.company_logo_url}
              alt={partner.company_name ?? "Company logo"}
              loading="lazy"
              className="h-12 w-auto object-contain"
            />
          )}
        </div>
        <Progress
          value={progress}
          className="h-1 rounded-none bg-zinc-800 [&>*]:bg-[#F5C518]"
        />
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait" initial={false}>
          {step === 0 && (
            <motion.section
              key="step0"
              initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-8 relative"
            >
              {/* Hero with radial yellow glow */}
              <div
                className="relative -mx-4 px-4 py-12 text-center overflow-hidden"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% -20%, rgba(245,197,24,0.18) 0%, transparent 70%)",
                }}
              >
                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.05]">
                  Find out what your <span style={{ color: YELLOW }}>solar</span> could earn
                </h1>
                <p className="text-zinc-400 mt-4 text-base md:text-lg">
                  Free assessment · No account needed · Takes 3 minutes
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {["No account needed", "Free to use", "Real carbon credits"].map((t) => (
                  <div
                    key={t}
                    className="rounded-xl bg-zinc-900 border-l-4 border-[#F5C518] px-4 py-3 text-sm text-zinc-200"
                  >
                    {t}
                  </div>
                ))}
              </div>

              <div className={`${cardClass} p-6 space-y-4 max-w-md mx-auto`}>
                <div className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-[#F5C518] text-black font-bold text-sm flex items-center justify-center">1</span>
                  <h2 className="text-xl font-semibold text-white">About you</h2>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-zinc-300">Full Name</Label>
                  <Input id="name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`text-base h-12 ${inputClass}`} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-zinc-300">Email Address</Label>
                  <Input id="email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`text-base h-12 ${inputClass}`} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-zinc-300">Phone Number (optional)</Label>
                  <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={`text-base h-12 ${inputClass}`} />
                </div>
              </div>
            </motion.section>
          )}

          {step === 1 && (
            <motion.section
              key="step1"
              initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className={`${cardClass} p-6 space-y-5 max-w-md mx-auto`}
            >
              <div className="flex items-center gap-3">
                <span className="h-7 w-7 rounded-full bg-[#F5C518] text-black font-bold text-sm flex items-center justify-center">2</span>
                <h2 className="text-xl font-semibold text-white">Your system</h2>
              </div>

              <div className="space-y-2">
                <Label className="text-zinc-300">Do you have solar installed?</Label>
                <div className="grid grid-cols-1 gap-2">
                  {([
                    ["yes", "Yes, already installed"],
                    ["planning", "Planning to install"],
                    ["no", "No"],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setForm({ ...form, hasExisting: value })}
                      className={`w-full min-h-[52px] rounded-lg border px-4 py-3 text-left text-base transition-colors ${
                        form.hasExisting === value
                          ? "border-[#F5C518] bg-[rgba(245,197,24,0.1)] text-white font-semibold"
                          : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="kwp" className="text-zinc-300">System size in kWp</Label>
                <Input
                  id="kwp"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={form.sizeKwp}
                  onChange={(e) => setForm({ ...form, sizeKwp: e.target.value })}
                  className={`text-base h-12 ${inputClass}`}
                />
                <p className="text-xs text-zinc-500">Not sure? Use your monthly kWh bill ÷ 137 as a rough kWp estimate.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="province" className="text-zinc-300">Province / Region</Label>
                <select
                  id="province"
                  value={form.province}
                  onChange={(e) => setForm({ ...form, province: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Select a province</option>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="proptype" className="text-zinc-300">Property type</Label>
                <select
                  id="proptype"
                  value={form.propertyType}
                  onChange={(e) => setForm({ ...form, propertyType: e.target.value })}
                  className={selectClass}
                >
                  <option value="">Select property type</option>
                  {PROPERTY_TYPES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="step2"
              initial={prefersReducedMotion ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 max-w-md mx-auto text-center"
            >
              <div
                className="rounded-2xl bg-black border border-[rgba(245,197,24,0.25)] p-8 space-y-4"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 0%, rgba(245,197,24,0.12) 0%, #000 70%)",
                }}
              >
                <div className="text-xs uppercase tracking-[0.2em] text-[#F5C518]/80">
                  You could earn approximately
                </div>
                {calcLoading ? (
                  <div className="flex items-center justify-center h-[72px] md:h-[80px]">
                    <Loader2 className="h-8 w-8 animate-spin text-[#F5C518]" aria-hidden="true" />
                  </div>
                ) : (
                  <CountUp
                    value={carbonProjection.clientRevenuePerYear}
                    prefix="R "
                    suffix=" / year"
                    reducedMotion={prefersReducedMotion}
                  />
                )}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                    <div className="text-2xl font-semibold text-white">
                      <span className="text-[#F5C518]">🌱</span> {carbonProjection.carbonTonnes.toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-400">tonnes CO₂ offset / year</div>
                  </div>
                  <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3">
                    <div className="text-2xl font-semibold text-white">
                      <span className="text-[#F5C518]">⚡</span> {carbonProjection.annualEnergyMWh.toFixed(2)}
                    </div>
                    <div className="text-xs text-zinc-400">MWh clean energy / year</div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border-l-4 border-amber-500 bg-amber-950 border border-amber-800 p-4 text-left">
                <div className="font-semibold text-amber-200">This is a conservative estimate.</div>
                <p className="text-sm text-amber-200/90 mt-1">
                  Your actual earnings depend on your real energy meter data — the final figure could be higher or lower.
                  We use verified data from your actual system to calculate precisely.
                </p>
              </div>

              <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-4 text-left">
                <div className="font-semibold text-zinc-200">For your system to qualify:</div>
                <ul className="text-sm mt-2 space-y-1 list-disc pl-5 text-zinc-400">
                  <li>The solar system must be located in South Africa.</li>
                  <li>Not registered with another Greenhouse Gas Emissions program.</li>
                  <li>Has a valid Certificate of Compliance (CoC) issued by a Registered Electrician (i.e. legally installed).</li>
                  <li>Switched on or commissioned on or after 1 July 2026.</li>
                  <li>I am the legal owner of the solar system or green attributes.</li>
                  <li>Not funded by or through South African Government Funded Initiative.</li>
                </ul>
                <p className="text-xs mt-2 text-zinc-500">Your proposal will confirm eligibility once submitted.</p>
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="step3"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-5 max-w-md mx-auto text-center"
            >
              {!proposalCreated ? (
                <div className="space-y-4 py-12">
                  {submitting ? (
                    <>
                      <Loader2 className="h-10 w-10 animate-spin text-[#F5C518] mx-auto" />
                      <p className="text-zinc-400">Creating your proposal…</p>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-10 w-10 text-[#F5C518] mx-auto" />
                      <p className="text-zinc-400">Ready to send your free proposal — tap below to confirm.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                  <div className="w-full max-w-md space-y-4 bg-zinc-900 border border-zinc-700 rounded-2xl p-6 my-8">
                    <div className="mx-auto h-16 w-16 rounded-full bg-[rgba(245,197,24,0.15)] flex items-center justify-center">
                      <CheckCircle2 className="h-10 w-10 text-[#F5C518]" aria-hidden="true" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Your proposal is on its way ✉️</h2>
                    <p className="text-zinc-400">A copy has been sent to {partner.first_name || "your partner"}.</p>
                    <div className="rounded-lg bg-black border border-zinc-800 p-4 text-left text-sm space-y-1 text-zinc-200">
                      <div><strong className="text-white">System size:</strong> {carbonProjection.kwp} kWp</div>
                      <div><strong className="text-white">Carbon credits:</strong> {carbonProjection.carbonTonnes.toFixed(2)} tCO₂ / year</div>
                      <div className="text-xs text-zinc-500">(conservative estimate)</div>
                    </div>
                    <p className="text-sm text-zinc-300">You can sign your proposal directly from the email — no account needed.</p>
                    <div className="pt-2 space-y-2">
                      <Button asChild className="w-full h-12 text-base bg-[#F5C518] text-black hover:bg-[#FFD23F] font-semibold">
                        <a href={`/register?email=${encodeURIComponent(form.email)}&ref=${encodeURIComponent(token ?? "")}`}>
                          Create a free account to track your credits
                        </a>
                      </Button>
                      <button onClick={() => navigate("/")} className="text-sm underline text-zinc-500 hover:text-zinc-300">
                        Maybe later — I'll check my email
                      </button>
                    </div>
                  </div>
                  {!prefersReducedMotion && <Confetti />}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile sticky nav */}
      {!proposalCreated && (
        <nav
          className="fixed md:static bottom-0 left-0 right-0 border-t border-zinc-800 bg-black md:bg-transparent md:border-0 px-4 py-3 md:max-w-3xl md:mx-auto"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
        >
          <div className="flex gap-2 max-w-md mx-auto">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-12 bg-transparent border-zinc-700 text-zinc-200 hover:bg-zinc-900 hover:text-white"
              onClick={back}
              disabled={step === 0 || submitting}
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < 2 && (
              <Button
                type="button"
                className="flex-1 h-12 text-base bg-[#F5C518] text-black hover:bg-[#FFD23F] font-semibold"
                onClick={next}
              >
                Next <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}
            {step === 2 && (
              <Button
                type="button"
                className="flex-1 h-12 text-base bg-[#F5C518] text-black hover:bg-[#FFD23F] font-semibold cta-pulse"
                onClick={() => {
                  setStep(3);
                  void submit();
                }}
              >
                Get my free proposal
              </Button>
            )}
            {step === 3 && !submitting && !proposalCreated && (
              <Button
                type="button"
                className="flex-1 h-12 text-base bg-[#F5C518] text-black hover:bg-[#FFD23F] font-semibold"
                onClick={() => void submit()}
              >
                Confirm and send
              </Button>
            )}
          </div>
        </nav>
      )}

      <style>{`
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 197, 24, 0.5); }
          50%      { box-shadow: 0 0 0 16px rgba(245, 197, 24, 0); }
        }
        .cta-pulse { animation: ctaPulse 2s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .cta-pulse { animation: none; } }
      `}</style>
    </div>
  );
}

function CountUp({
  value,
  prefix = "",
  suffix = "",
  reducedMotion,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  reducedMotion: boolean;
}) {
  const [display, setDisplay] = useState(reducedMotion ? value : 0);
  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const duration = 1500;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reducedMotion]);
  return (
    <div className="text-5xl md:text-6xl font-extrabold tracking-tight text-[#F5C518]">
      {prefix}
      {Math.round(display).toLocaleString()}
      {suffix}
    </div>
  );
}

function Confetti() {
  const colors = ["#F5C518", "#ffffff", "#B8860B"];
  const pieces = Array.from({ length: 60 });
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-40" aria-hidden="true">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.6;
        const duration = 1.8 + Math.random() * 1.6;
        const size = 6 + Math.random() * 6;
        const color = colors[i % colors.length];
        const rotate = Math.random() * 360;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              top: "-10px",
              left: `${left}%`,
              width: size,
              height: size * 0.4,
              background: color,
              transform: `rotate(${rotate}deg)`,
              animation: `confettiFall ${duration}s ${delay}s linear forwards`,
              borderRadius: 1,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confettiFall {
          to { transform: translateY(110vh) rotate(720deg); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}

