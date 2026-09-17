 import { useState, useEffect } from "react";
 import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Calculator, ClipboardCheck } from "lucide-react";
 
 interface StickyCtaBarProps {
   onCTAClick: () => void;
   onCheckEligibility?: () => void;
 }
 
 export function StickyCtaBar({ onCTAClick, onCheckEligibility }: StickyCtaBarProps) {
   const handleEligibility = onCheckEligibility ?? onCTAClick;
   const [isVisible, setIsVisible] = useState(false);
 
   useEffect(() => {
     const handleScroll = () => {
       // Show after scrolling 400px
       setIsVisible(window.scrollY > 400);
     };
 
     window.addEventListener("scroll", handleScroll, { passive: true });
     return () => window.removeEventListener("scroll", handleScroll);
   }, []);
 
   return (
     <AnimatePresence>
       {isVisible && (
         <motion.div
           initial={{ y: 100, opacity: 0 }}
           animate={{ y: 0, opacity: 1 }}
           exit={{ y: 100, opacity: 0 }}
           transition={{ type: "spring", stiffness: 300, damping: 30 }}
           className="fixed bottom-0 left-0 right-0 z-50 p-4 md:hidden"
         >
            <div className="bg-background/95 backdrop-blur-md border border-border rounded-xl shadow-lg p-3 space-y-2">
              <Button
                onClick={onCTAClick}
                className="w-full h-12 text-base font-semibold gap-2"
                size="lg"
              >
                <Calculator className="w-5 h-5" />
                Calculate My Earnings
              </Button>
              <Button
                 onClick={handleEligibility}
                 variant="outline"
                className="w-full h-12 text-base font-semibold gap-2 border-2 border-crunch-black/20 hover:bg-crunch-yellow hover:text-crunch-black hover:border-crunch-yellow"
                size="lg"
              >
                <ClipboardCheck className="w-5 h-5" />
                Check Eligibility
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Free • 30 seconds • No commitment
              </p>
            </div>
         </motion.div>
       )}
     </AnimatePresence>
   );
 }