
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SafeMotionDiv } from "@/components/common/SafeMotionDiv";
import { OptimizedImage } from '@/components/ui/OptimizedImage';
export const HeroSection = () => {
  const navigate = useNavigate();
  
  return <section className="bg-gradient-to-br from-background to-accent py-16 md:py-24 overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="inline-block px-4 py-2 bg-card/60 backdrop-blur-md rounded-full shadow-md border border-border/40">
              <span className="text-sm font-medium text-muted-foreground">Verra-certified · VCS project 4799</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
              <span className="text-foreground">Turn Your Solar System</span>{" "}
              <span className="text-primary drop-shadow-sm">Into Cash</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-xl">
              <span className="text-primary font-bold">Homeowners</span> earn <span className="font-bold text-foreground">R600–R1,000+ per year from a typical 5kWp system</span>.&nbsp;<span className="text-primary font-bold">Business</span> earn <span className="font-bold text-foreground">R900,000+ over 5 years per 1MWp</span> through verified carbon credits. Free to join.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <SafeMotionDiv whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  onClick={() => navigate("/register")} 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-6 px-8 w-full sm:w-auto rounded-2xl shadow-sm hover:shadow-lg group transition-all duration-300" 
                  size="lg"
                >
                  <span>Start Earning</span>
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </SafeMotionDiv>
              <SafeMotionDiv whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button 
                  variant="outline" 
                  onClick={() => navigate("/calculator")} 
                  className="text-foreground text-lg py-6 px-8 w-full sm:w-auto rounded-2xl transition-all duration-300" 
                  size="lg"
                >
                  Calculate My Earnings
                </Button>
              </SafeMotionDiv>
            </div>
            
            <div className="flex items-center text-muted-foreground pt-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
              <span className="text-sm">Free setup • Verra certified • Annual payouts</span>
            </div>
          </div>
          
          <SafeMotionDiv className="hidden lg:block relative" initial={{
          opacity: 0,
          x: 20
        }} animate={{
          opacity: 1,
          x: 0
        }} transition={{
          duration: 0.5,
          delay: 0.2
        }}>
            <div className="relative">
              <div className="absolute -z-10 -right-4 -bottom-4 w-full h-full rounded-3xl bg-gradient-to-br from-primary/30 to-primary/10"></div>
              <div className="meta-card rounded-3xl p-6">
                <OptimizedImage
                  src="/lovable-uploads/9542096a-435e-4372-b09c-fb7cbaa80634.webp"
                  alt="CrunchCarbon Pac-Man Style Logo"
                  className="w-full h-auto rounded-2xl transition-all hover:scale-105 duration-500"
                  width={488}
                  height={275}
                  priority={true}
                  fetchPriority="high"
                  sizes="(max-width: 768px) 100vw, 488px"
                />
              </div>
              
              {/* Floating elements */}
              <SafeMotionDiv 
                className="absolute -top-10 -left-10 meta-card p-3 rounded-2xl flex items-center gap-2" 
                animate={{ y: [0, -10, 0] }} 
                transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              >
                <Shield className="text-green-500 h-6 w-6" />
                <span className="font-medium text-foreground">Verified Green</span>
              </SafeMotionDiv>
              <SafeMotionDiv 
                className="absolute -bottom-5 -left-20 meta-card p-3 rounded-2xl flex items-center gap-2" 
                animate={{ y: [0, 10, 0] }} 
                transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
              >
                <Zap className="text-primary h-6 w-6" />
                <span className="font-medium text-foreground">Energy → Revenue</span>
              </SafeMotionDiv>
            </div>
          </SafeMotionDiv>
        </div>
      </div>
    </section>;
};
