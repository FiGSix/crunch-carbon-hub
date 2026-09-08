import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Calculator, Phone, Building2, Factory, Wheat } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BusinessHeroSectionProps {
  onCalculateClick: () => void;
  onConsultationClick: () => void;
}

export function BusinessHeroSection({ onCalculateClick, onConsultationClick }: BusinessHeroSectionProps) {
  const navigate = useNavigate();

  return (
    <section className="relative py-16 md:py-24 overflow-hidden bg-gradient-to-br from-background to-accent">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-primary/5 rounded-full blur-2xl" />
      </div>

      <div className="container mx-auto px-4 max-w-6xl relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm mb-6">
              <Building2 className="h-4 w-4" />
              For Commercial & Industrial
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
              Monetise Your{" "}
              <span className="text-primary">Commercial Solar</span>{" "}
              Investment
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground mb-4">
              Turn your business's solar generation into a new revenue stream with verified carbon credits.
            </p>

            <div className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-4 mb-8">
              <p className="text-2xl md:text-3xl font-bold text-foreground">
                Earn <span className="text-primary">R10,000 - R100,000+</span> annually
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                Based on system sizes 50kWp to 1MW+
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-8 py-6 text-lg font-medium shadow-md hover:shadow-lg transition-all"
                onClick={onCalculateClick}
              >
                <Calculator className="mr-2 h-5 w-5" />
                Calculate ROI
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-xl px-8 py-6 text-lg"
                onClick={onConsultationClick}
              >
                <Phone className="mr-2 h-5 w-5" />
                Request Consultation
              </Button>
            </div>
          </motion.div>

          {/* Right: Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="hidden lg:block"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                  <Building2 className="h-10 w-10 text-primary mb-3" />
                  <h2 className="font-semibold text-foreground">Commercial</h2>
                  <p className="text-sm text-muted-foreground">Retail, offices, warehouses</p>
                </div>
                <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                  <Factory className="h-10 w-10 text-primary mb-3" />
                  <h2 className="font-semibold text-foreground">Industrial</h2>
                  <p className="text-sm text-muted-foreground">Manufacturing, data centers</p>
                </div>
              </div>
              <div className="space-y-4 mt-8">
                <div className="bg-card border border-border/40 rounded-2xl p-6 shadow-sm">
                  <Wheat className="h-10 w-10 text-primary mb-3" />
                  <h2 className="font-semibold text-foreground">Agricultural</h2>
                  <p className="text-sm text-muted-foreground">Farms, packhouses, wineries</p>
                </div>
                <div className="bg-primary/10 border border-primary/20 rounded-2xl p-6">
                  <p className="text-3xl font-bold text-primary">1MW+</p>
                  <p className="text-sm text-foreground mt-1">maximum 15MWp per project</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
