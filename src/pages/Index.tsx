

import { HeroSection } from "@/pages/home/HeroSection";
import { AudienceSelector } from "@/components/home/AudienceSelector";
import { VerificationTrustSection } from "@/components/home/VerificationTrustSection";
import { CalculatorPromo } from "@/components/home/CalculatorPromo";
import { HowItWorksSection } from "@/pages/home/HowItWorksSection";
import { SocialProofSection } from "@/pages/home/SocialProofSection";
import { SecuritySection } from "@/components/home/SecuritySection";
import { ClientProofSection } from "@/components/home/ClientProofSection";
import { CTASection } from "@/pages/home/CTASection";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/Header";
import { StickyCtaBar } from "@/components/solar-rewards/StickyCtaBar";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const Index = () => {
  const navigate = useNavigate();

  return (
    <>
      <Helmet>
        <title>Crunch Carbon — Turn Solar Energy into Cash</title>
        <meta name="description" content="Monetise your solar panels with verified carbon credits. Homeowners earn R600-R1,000+ annually. Business earn R900,000+ over 5 years per 1MWp. Free setup, Verra-certified." />
        <link rel="canonical" href="https://crunchcarbon.com/" />
        <meta property="og:title" content="Crunch Carbon — Turn Solar Energy into Cash" />
        <meta property="og:description" content="Monetise your solar panels with verified carbon credits. Homeowners earn R600-R1,000+ annually. Business earn R900,000+ over 5 years per 1MWp. Free setup, Verra-certified." />
        <meta property="og:url" content="https://crunchcarbon.com/" />
        <meta property="og:type" content="website" />
      </Helmet>
      <Header />
      <main>
        <HeroSection />
        <VerificationTrustSection />
        <AudienceSelector />
        <CalculatorPromo />
        <HowItWorksSection />
        <SocialProofSection />
        <ClientProofSection />
        <SecuritySection />
        <CTASection />
      </main>
      <Footer />
      <StickyCtaBar onCTAClick={() => navigate("/calculator")} />
    </>
  );
};

export default Index;
