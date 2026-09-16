import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { TrendingUp, Calculator } from "lucide-react";
import { useState } from "react";

interface EarningsEstimatorProps {
  onCalculateClick: () => void;
}

 // Simplified earnings calculation based on system size
 // Using ~R160/kWp/year as average (based on R800/year for 5kWp)
 const calculateEstimate = (sizeKwp: number): number => {
   return Math.round(sizeKwp * 160);
 };
 
export function EarningsEstimator({ onCalculateClick }: EarningsEstimatorProps) {
   const [systemSize, setSystemSize] = useState([5]);
   const estimatedEarnings = calculateEstimate(systemSize[0]);
 
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-gradient-to-br from-accent/50 to-muted/50">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-6">
            <TrendingUp className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-6">
            How Much Can I Earn?
          </h2>
          
          <p className="text-lg text-muted-foreground mb-4 leading-relaxed">
            Every home is different — but most clients earn annual payouts based on the size and output of their system.
          </p>
          
           {/* Interactive Slider */}
           <div className="bg-background rounded-xl p-6 md:p-8 shadow-sm border border-border/50 mb-8">
             <div className="mb-6">
               <p className="text-sm text-muted-foreground mb-2">Your system size</p>
               <p className="text-3xl md:text-4xl font-bold text-foreground">
                 {systemSize[0]} kWp
               </p>
             </div>
             
             <Slider
               value={systemSize}
               onValueChange={setSystemSize}
               min={2}
               max={50}
               step={0.5}
               className="mb-6"
             />
             
             <div className="flex justify-between text-xs text-muted-foreground mb-6">
               <span>2 kWp</span>
               <span>50 kWp</span>
             </div>
             
             <div className="bg-primary/5 rounded-lg p-4">
               <p className="text-sm text-muted-foreground mb-1">Estimated averaged annual earnings</p>
               <p className="text-3xl md:text-4xl font-bold text-primary">
                 R{estimatedEarnings.toLocaleString()}
                 <span className="text-lg font-normal text-muted-foreground">/year</span>
               </p>
             </div>
           </div>
          
          <Button 
            size="lg"
            onClick={onCalculateClick}
            className="h-14 px-10 text-lg font-semibold shadow-lg hover:shadow-xl transition-all"
          >
             Get My Detailed Calculation
          </Button>
           
           <p className="text-xs text-muted-foreground mt-4">
             * Estimates based on average South African solar production. Actual earnings may vary.
           </p>
        </div>
      </div>
    </section>
  );
}
