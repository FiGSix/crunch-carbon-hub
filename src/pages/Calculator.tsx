import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/footer";
import { useNavigate, useSearchParams } from "react-router-dom";
import { dynamicCarbonPricingService } from "@/lib/calculations/carbon/dynamicPricing";
import { Helmet } from "react-helmet-async";
import { UnifiedCarbonService } from "@/lib/calculations/carbon";
import { getYieldForProvince, primeRegionalYieldsCache } from "@/services/calculations/carbon/regionalYields";
import { toast } from "sonner";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { HeroSection } from "./calculator/HeroSection";
import { SystemInputPanel } from "./calculator/SystemInputPanel";
import { HeadlineResultPanel } from "./calculator/HeadlineResultPanel";
import { EmailGatePanel } from "./calculator/EmailGatePanel";
import { FullForecastPanel } from "./calculator/FullForecastPanel";
import { ProposalPreviewPanel } from "./calculator/ProposalPreviewPanel";
import { HowItWorksSection } from "./calculator/HowItWorksSection";
import { FinalCTASection } from "./calculator/FinalCTASection";

type Segment = "homeowner" | "business";
type CalculatorStep = "input" | "calculated";

interface EstimateData {
  systemSizeKwp: number;
  province: string;
  commissionDate: Date;
  segment: Segment;
  annualEnergyKwh: number;
  carbonCreditsPerYear: number;
  clientSharePercentage: number;
  revenueByYear: Record<string, number>;
  currentYearAnnualRevenue: number;
}

const Calculator = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();

  // Capture referral code from URL and store in localStorage
  useEffect(() => {
    const refCode = searchParams.get("ref");
    if (refCode) {
      localStorage.setItem("referralCode", refCode);
    }
  }, [searchParams]);

  // Prime pricing and regional yield caches on mount
  useEffect(() => {
    dynamicCarbonPricingService.getCarbonPrices().catch(() => {
      // Silently fail - fallback constants will be used
    });
    primeRegionalYieldsCache().catch(() => {
      // Silently fail - fallback national average will be used
    });
  }, []);

  // Input state
  const initialSegment: Segment =
    searchParams.get("segment") === "business" ? "business" : "homeowner";
  const [segment, setSegment] = useState<Segment>(initialSegment);
  const [systemSize, setSystemSize] = useState("");
  const [province, setProvince] = useState("");
  const [commissionDate, setCommissionDate] = useState<Date | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // UI state
  const [step, setStep] = useState<CalculatorStep>("input");
  const [estimate, setEstimate] = useState<EstimateData | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Proposal state (unlocked after email)
  const [proposalId, setProposalId] = useState<string | null>(null);
  const [proposalToken, setProposalToken] = useState<string | null>(null);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (!province) {
      newErrors.province = "Please select a province";
    }

    const sizeInKWp = UnifiedCarbonService.normalizeToKWp(systemSize);
    if (!systemSize || isNaN(sizeInKWp) || sizeInKWp <= 0) {
      newErrors.systemSize = "Please enter a valid system size";
    } else if (sizeInKWp > 15000) {
      newErrors.systemSize = "System size cannot exceed 15,000 kWp";
    }

    if (!commissionDate) {
      newErrors.commissionDate = "Please select a commissioning date";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [province, systemSize, commissionDate]);

  const handleCalculate = useCallback(async () => {
    if (!validate() || !commissionDate) return;

    setIsCalculating(true);

    try {
      const systemSizeKwp = UnifiedCarbonService.normalizeToKWp(systemSize);
      const yieldFactor = await getYieldForProvince(province);
      const annualEnergyKwh = UnifiedCarbonService.calculateAnnualEnergy(systemSizeKwp, yieldFactor);
      const carbonCreditsPerYear = UnifiedCarbonService.calculateCarbonCredits(
        systemSizeKwp,
        yieldFactor
      );
      const clientSharePercentage = UnifiedCarbonService.getClientSharePercentage(systemSizeKwp);
      const revenueByYear = await UnifiedCarbonService.calculateRevenueByYear(
        carbonCreditsPerYear,
        clientSharePercentage,
        commissionDate
      );

      // Headline uses the first full or partial year from today onward so the user sees
      // a relevant annual figure. If commissioning is in the future, use the first forecast year.
      const currentYear = new Date().getFullYear();
      const availableYears = Object.keys(revenueByYear)
        .map((y) => parseInt(y, 10))
        .filter((y) => y >= currentYear)
        .sort((a, b) => a - b);

      const headlineYear = availableYears.length > 0 ? availableYears[0] : currentYear;
      const currentYearAnnualRevenue = revenueByYear[headlineYear.toString()] ?? 0;

      setEstimate({
        systemSizeKwp,
        province,
        commissionDate,
        segment,
        annualEnergyKwh,
        carbonCreditsPerYear,
        clientSharePercentage,
        revenueByYear,
        currentYearAnnualRevenue,
      });
      setStep("calculated");
    } catch (error) {
      console.error("Error calculating estimate:", error);
      toast.error("Could not calculate your estimate. Please try again.");
    } finally {
      setIsCalculating(false);
    }
  }, [validate, systemSize, province, commissionDate, segment]);

  const handleEmailSubmitted = useCallback((id: string, token: string) => {
    setProposalId(id);
    setProposalToken(token);
  }, []);

  useEffect(() => {
    if (step === "calculated" && resultsRef.current) {
      // Allow one frame for AnimatePresence to mount the panel, then bring the
      // celebration badge into clear view below the sticky header.
      const timer = setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const handleEditDetails = useCallback(() => {
    setStep("input");
    setEstimate(null);
    setProposalId(null);
    setProposalToken(null);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Solar Carbon Credit Calculator | Crunch Carbon</title>
        <meta
          name="description"
          content="Calculate your solar carbon credit earnings instantly. Free tool for South African homeowners and businesses."
        />
        <link rel="canonical" href="https://crunchcarbon.com/calculator" />
        <meta property="og:title" content="Solar Carbon Credit Calculator | Crunch Carbon" />
        <meta
          property="og:description"
          content="Calculate your solar carbon credit earnings instantly. Free tool for South African homeowners and businesses."
        />
        <meta property="og:url" content="https://crunchcarbon.com/calculator" />
        <meta property="og:type" content="website" />
      </Helmet>

      <Header />

      <main className="flex-1">
        <HeroSection />

        <section className="py-12 md:py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <AnimatePresence mode="wait" initial={false}>
              {step === "input" ? (
                <motion.div
                  key="calculator-input"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -10 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                >
                  <SystemInputPanel
                    segment={segment}
                    onSegmentChange={setSegment}
                    systemSize={systemSize}
                    onSystemSizeChange={setSystemSize}
                    province={province}
                    onProvinceChange={setProvince}
                    commissionDate={commissionDate}
                    onCommissionDateChange={setCommissionDate}
                    errors={errors}
                    onCalculate={handleCalculate}
                    isCalculating={isCalculating}
                  />
                </motion.div>
              ) : estimate ? (
                <motion.div
                  key="calculator-results"
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.45 }}
                  className="space-y-8"
                >
                  <HeadlineResultPanel estimate={estimate} onEdit={handleEditDetails} />

                  {!proposalId || !proposalToken ? (
                    <motion.div
                      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: prefersReducedMotion ? 0 : 0.45,
                        delay: prefersReducedMotion ? 0 : 0.85,
                      }}
                    >
                      <EmailGatePanel estimate={estimate} onEmailSubmitted={handleEmailSubmitted} />
                    </motion.div>
                  ) : (
                    <>
                      <FullForecastPanel estimate={estimate} />
                      <ProposalPreviewPanel
                        estimate={estimate}
                        proposalId={proposalId}
                        proposalToken={proposalToken}
                      />
                    </>
                  )}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </section>

        <HowItWorksSection />
        <FinalCTASection navigate={navigate} />
      </main>

      <Footer />
    </div>
  );
};

export default Calculator;
