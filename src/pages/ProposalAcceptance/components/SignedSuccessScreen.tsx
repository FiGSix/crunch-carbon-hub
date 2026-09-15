import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, MailCheck, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/auth";
import {
  buildReferralUrl,
  buildWhatsAppShareUrl,
  signedClientShareMessage,
} from "@/lib/referral";

interface SignedSuccessScreenProps {
  proposalId: string;
  clientEmail?: string | null;
  /** True when the signer already has an active session. */
  isAuthenticated: boolean;
}

/**
 * Shown after a successful signature. The signature is already recorded before
 * this renders, so nothing here can put the legal record at risk.
 */
export function SignedSuccessScreen({
  proposalId,
  clientEmail,
  isAuthenticated,
}: SignedSuccessScreenProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [sending, setSending] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [deferred, setDeferred] = useState(false);

  const onboardingPath = `/onboarding/${proposalId}`;

  const handleStartOnboarding = async () => {
    if (isAuthenticated) {
      navigate(onboardingPath);
      return;
    }

    if (!clientEmail) {
      toast({
        description:
          "We could not determine your email address. Please check your inbox for the signed copy, which includes a link to onboarding.",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: clientEmail,
        options: {
          emailRedirectTo: `${window.location.origin}${onboardingPath}`,
        },
      });
      if (error) throw error;
      setLinkSent(true);
    } catch (err) {
      console.error("Failed to send onboarding access link:", err);
      toast({
        description: "We could not send your access link. Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-12">
      <Card>
        <CardContent className="p-6 md:p-8 text-center">
          <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold mb-3">
            Your agreement has been signed successfully
          </h1>
          <p className="text-muted-foreground mb-2">
            Thank you — your acceptance has been recorded.
          </p>
          <p className="text-muted-foreground">
            A signed copy of your Cession Agreement has been emailed to you
            {clientEmail ? ` at ${clientEmail}` : ""}.
          </p>

          {linkSent ? (
            <div className="mt-8 rounded-lg border border-border bg-muted/40 p-5 text-left flex gap-3">
              <MailCheck className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground mt-1">
                  We've sent a secure link to {clientEmail}. Opening it takes you straight to
                  onboarding for this project — no password needed.
                </p>
              </div>
            </div>
          ) : deferred ? (
            <div className="mt-8 rounded-lg border border-border bg-muted/40 p-5 text-left">
              <p className="font-medium">No problem</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your agreement is signed and safe. When you're ready, use the link in your email to
                complete onboarding for this project.
              </p>
            </div>
          ) : (
            <div className="mt-8 space-y-4">
              <p className="text-sm text-muted-foreground">
                Next, we'll onboard your project: system details, compliance documents and data
                access. Your EPC partner can help complete this quickly.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button size="lg" onClick={handleStartOnboarding} disabled={sending}>
                  {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Start onboarding
                </Button>
                <Button size="lg" variant="outline" onClick={() => setDeferred(true)}>
                  I'll do this later
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="p-6 text-center">
          <h2 className="text-lg font-semibold mb-2">
            You're now earning carbon credits from your solar system. Tell someone.
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Share it as a message or a WhatsApp status — anyone with solar can check what
            theirs could earn.
          </p>
          <Button
            size="lg"
            className="bg-[#25D366] text-white hover:bg-[#1FB855]"
            onClick={() =>
              window.open(
                buildWhatsAppShareUrl(signedClientShareMessage(buildReferralUrl(profile?.id))),
                "_blank",
                "noopener,noreferrer"
              )
            }
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Share on WhatsApp
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
