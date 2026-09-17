import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/footer";
import { HeroSection } from "./solar-rewards/HeroSection";
import { HowItWorks } from "./solar-rewards/HowItWorks";
import { BenefitsSection } from "./solar-rewards/BenefitsSection";
import { ValueCards } from "./solar-rewards/ValueCards";
import { EarningsEstimator } from "./solar-rewards/EarningsEstimator";
import { QualificationSection } from "./solar-rewards/QualificationSection";
import { TrustSection } from "./solar-rewards/TrustSection";
import { FinalCTA } from "./solar-rewards/FinalCTA";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { EligibilityModal } from "./solar-rewards/EligibilityModal";
import { ImpactStats } from "./solar-rewards/ImpactStats";
import { StickyCtaBar } from "@/components/solar-rewards/StickyCtaBar";
import { FAQSection } from "./solar-rewards/FAQSection";

import { TestimonialsSection } from "./solar-rewards/TestimonialsSection";
import { Helmet } from "react-helmet-async";

const SolarRewards = () => {
  const navigate = useNavigate();
  const [showEligibility, setShowEligibility] = useState(false);
  const goToCalculator = () =>
    navigate("/calculator?segment=homeowner#crunch-the-numbers");
  const openEligibility = () => setShowEligibility(true);
  const handleQualified = () => {
    setShowEligibility(false);
    goToCalculator();
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Monetise Your Solar System | Crunch Carbon</title>
        <meta name="description" content="Turn your solar panels into a revenue stream. Earn cash, support charities, or access premium services by sharing your solar data." />
        <link rel="canonical" href="https://crunchcarbon.com/home-owners" />
        <meta property="og:title" content="Monetise Your Solar System | Crunch Carbon" />
        <meta property="og:description" content="Turn your solar panels into a revenue stream. Earn cash, support charities, or access premium services by sharing your solar data." />
        <meta property="og:url" content="https://crunchcarbon.com/home-owners" />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          "name": "Solar Carbon Credit Monetization",
          "provider": { "@type": "Organization", "name": "Crunch Carbon" },
          "description": "Convert your solar energy generation into verified carbon credits and earn R600–R1,000+ annually from a typical 5kWp system",
          "areaServed": { "@type": "Country", "name": "South Africa" },
          "serviceType": "Carbon Credit Generation",
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "ZAR", "description": "Free registration - earn from your solar panels" }
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": [
            { "@type": "Question", "name": "How much can I earn from my solar panels?", "acceptedAnswer": { "@type": "Answer", "text": "A typical 5kWp residential solar system can earn R600-R1,000+ per year through verified carbon credits. Larger systems earn proportionally more." } },
            { "@type": "Question", "name": "Is it free to join Crunch Carbon?", "acceptedAnswer": { "@type": "Answer", "text": "Yes, registration is completely free. There are no setup costs or hidden fees. We only take a share of the carbon credit revenue generated." } },
            { "@type": "Question", "name": "When do I get paid?", "acceptedAnswer": { "@type": "Answer", "text": "Payouts are annual, typically in Q1 each year for the previous year's generation. This timing aligns with the carbon credit verification and issuance cycle." } },
            { "@type": "Question", "name": "What size solar system do I need?", "acceptedAnswer": { "@type": "Answer", "text": "Any size solar system qualifies. While larger systems earn more, even small 3kWp residential systems can participate and earn carbon credits." } }
          ]
        })}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          "name": "How to Earn Carbon Credits from Your Solar Panels",
          "description": "A simple guide to monetizing your solar energy through Crunch Carbon",
          "step": [
            { "@type": "HowToStep", "position": 1, "name": "Register your solar system", "text": "Sign up online in just 5 minutes with basic details about your solar installation." },
            { "@type": "HowToStep", "position": 2, "name": "Connect your inverter data", "text": "We integrate with your inverter monitoring system to track energy generation." },
            { "@type": "HowToStep", "position": 3, "name": "Verification", "text": "We verify your installation and begin automatic monitoring of your solar generation." },
            { "@type": "HowToStep", "position": 4, "name": "Carbon credits generated", "text": "Based on your actual energy production, carbon credits are generated and verified to Verra VCS standards." },
            { "@type": "HowToStep", "position": 5, "name": "Get paid", "text": "Receive annual payouts directly to your bank account after credits are sold on carbon markets." }
          ]
        })}</script>
      </Helmet>
      <Header />

      <main className="flex-1">
        <HeroSection onCTAClick={goToCalculator} />

        <ImpactStats />
        <HowItWorks onCheckEligibility={goToCalculator} />
        <BenefitsSection />
        <ValueCards />
        <TestimonialsSection />
        <EarningsEstimator onCalculateClick={goToCalculator} />
        <QualificationSection onCheckEligibility={goToCalculator} />
        <FAQSection />
        <TrustSection />
        <FinalCTA onCTAClick={goToCalculator} />
      </main>

      <Footer />

      <StickyCtaBar onCTAClick={goToCalculator} />
    </div>
  );
};

export default SolarRewards;
