
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useFormAccessibility } from "@/hooks/useAccessibility";

interface RegisterSubmitButtonProps {
  isLoading: boolean;
  /** Seconds left before the form can be submitted again (email rate limit). */
  cooldownSeconds?: number;
}

export function RegisterSubmitButton({ isLoading, cooldownSeconds = 0 }: RegisterSubmitButtonProps) {
  const isCoolingDown = cooldownSeconds > 0 && !isLoading;

  return (
    <Button 
      type="submit" 
      className="w-full focus:ring-2 focus:ring-ring focus:ring-offset-2"
      disabled={isLoading || isCoolingDown}
      variant="default"
      aria-describedby="submit-help"
      aria-live="polite"
    >
      <div id="submit-help" className="sr-only">
        {isLoading 
          ? "Creating your account, please wait..." 
          : "Submit the registration form to create your account"
        }
      </div>
      
      {isLoading ? (
        <>
          <Loader2 
            className="mr-2 h-4 w-4 animate-spin" 
            aria-hidden="true"
          />
          <span>Creating Account...</span>
          <span className="sr-only">Processing, please wait</span>
        </>
      ) : (
        <>
          <span>Create Account</span>
          <span className="sr-only">Submit registration form</span>
        </>
      )}
    </Button>
  );
}
