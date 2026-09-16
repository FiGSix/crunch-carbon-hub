import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { AvatarStack } from "@/components/solar-rewards/AvatarStack";
import { useHomeownerStats } from "@/hooks/useHomeownerStats";
import { Calculator, ClipboardCheck } from "lucide-react";

interface HeroSectionProps {
  onCTAClick: () => void;
}

export function HeroSection({ onCTAClick }: HeroSectionProps) {
  const { stats } = useHomeownerStats();
  return (
    <section className="relative bg-gradient-to-br from-accent via-background to-muted overflow-hidden">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMxYTFhMWEiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItaDJ2LTJoLTJ6bTAgNHYyaDJ2LTJoLTJ6bTAtOHYyaDJ2LTJoLTJ6bS0yIDJ2Mmgydi0yaC0yem00IDB2Mmgydi0yaC0yem0tNCAwdjJoMnYtMmgtMnptNCAwdjJoMnYtMmgtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-40"></div>
      
      <div className="container mx-auto px-4 py-12 md:py-20 lg:py-24 relative z-10">
        <motion.div 
          className="max-w-4xl mx-auto text-center"
          initial="initial"
          animate="animate"
          variants={{
            initial: {},
            animate: {
              transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1
              }
            }
          }}
        >
          <motion.h1 
            variants={{
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 }
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight"
          >
            <span className="text-foreground">Homeowners did you know? </span>
            <span className="text-crunch-yellow">Your solar system can earn you money.</span>
          </motion.h1>
          
          <motion.p 
            variants={{
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 }
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-xl font-bold text-foreground mb-8 leading-relaxed max-w-3xl mx-auto"
          >
            <span className="text-crunch-yellow font-semibold">Crunch Carbon</span> turns your clean energy into verified carbon credits, sell them and share the proceeds.
          </motion.p>
          
           <motion.div
             variants={{
               initial: { opacity: 0, y: 20 },
               animate: { opacity: 1, y: 0 }
             }}
             transition={{ duration: 0.4, ease: "easeOut" }}
             className="flex justify-center mb-8"
           >
             {stats?.homeownerCount != null && (
               <AvatarStack count={stats.homeownerCount} />
             )}
           </motion.div>
           
          <motion.div
            variants={{
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 }
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Button 
              size="lg"
              onClick={onCTAClick}
              className="h-14 md:h-16 px-8 md:px-12 text-lg md:text-xl font-semibold w-full md:w-auto shadow-lg hover:shadow-xl transition-all"
            >
              Get My Free Solar Credit Estimate
            </Button>
          </motion.div>
          
          <motion.p 
            variants={{
              initial: { opacity: 0, y: 20 },
              animate: { opacity: 1, y: 0 }
            }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="text-sm text-muted-foreground mt-4"
          >
            Takes 30 seconds. No costs. No commitments.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
