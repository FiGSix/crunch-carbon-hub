import { Button } from "@/components/ui/button";
import { Check, ClipboardCheck } from "lucide-react";

interface QualificationSectionProps {
  onCheckEligibility: () => void;
}

export function QualificationSection({ onCheckEligibility }: QualificationSectionProps) {
  const requirements = [
    "System is in South Africa",
    "You own the solar system",
    "System is smaller than 50kWp (typical for homes)",
    "Not part of another carbon programme"
  ];

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-center text-foreground mb-6">
            Who Qualifies?
          </h2>
          
          <p className="text-center text-muted-foreground mb-12 text-lg">
            If you have a solar system in South Africa and meet these simple requirements, you're in:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {requirements.map((requirement, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border"
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <span className="text-foreground font-medium">{requirement}</span>
              </div>
            ))}
          </div>
          
          <div className="text-center">
            <Button 
              size="lg"
              onClick={onCheckEligibility}
              className="h-14 px-10 text-lg font-semibold"
            >
              See If I Qualify
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
