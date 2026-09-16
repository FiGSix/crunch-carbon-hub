import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Calculator } from "lucide-react";

interface FinalCTAProps {
  onCTAClick: () => void;
}

export function FinalCTA({ onCTAClick }: FinalCTAProps) {
  return (
    <section className="py-16 md:py-20 lg:py-24 bg-gradient-to-br from-accent via-background to-muted">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6 leading-tight">
            Join Hundreds of Homeowners Monetising Solar
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
            Your green energy is valuable — let us unlock that value for you.
          </p>
          
          <Button
            size="lg"
            onClick={onCTAClick}
            className="h-16 px-12 text-xl font-bold shadow-xl hover:shadow-2xl transition-all mb-6"
          >
            <Calculator className="mr-2 h-6 w-6" />
            Get Started
          </Button>
          
          <p className="text-sm text-muted-foreground mb-4">
            Free estimate • No obligations • Takes 30 seconds
          </p>
          
          <Link 
            to="/login" 
            className="text-sm text-primary hover:underline inline-block"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
