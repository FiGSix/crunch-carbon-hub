import { useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Mail, Lock, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSendCalculatorResults } from "@/hooks/calculator/useCalculatorResults";
import { format } from "date-fns";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface EmailGatePanelProps {
  estimate: {
    systemSizeKwp: number;
    province: string;
    commissionDate: Date;
    segment: string;
    annualEnergyKwh: number;
    carbonCreditsPerYear: number;
  };
  onEmailSubmitted: (proposalId: string, token: string) => void;
}

export const EmailGatePanel = ({ estimate, onEmailSubmitted }: EmailGatePanelProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);
  const sendResultsMutation = useSendCalculatorResults();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    try {
      const referralCode = localStorage.getItem("referralCode");
      const response = await sendResultsMutation.mutateAsync({
        email: email.trim(),
        name: name.trim(),
        systemSizeKwp: estimate.systemSizeKwp,
        commissioningDate: format(estimate.commissionDate, "yyyy-MM-dd"),
        referralCode: referralCode || undefined,
        province: estimate.province,
        segment: estimate.segment,
      });

      onEmailSubmitted(response.proposalId, response.token);
      setEmailDeliveryFailed(!response.emailDelivered);
      setEmailSent(true);
      if (response.emailDelivered) {
        toast.success("Proposal sent — check your inbox!");
      } else {
        toast.warning("Your proposal is ready below, but the email could not be delivered.");
      }
    } catch (error) {
      logger.error("Failed to send calculator proposal", { error });
      toast.error(error instanceof Error ? error.message : "Could not send your proposal. Please try again.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="meta-card p-6 md:p-8"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-5 w-5 text-crunch-yellow" />
            <h2 className="text-xl md:text-2xl font-bold text-crunch-black">
              Let's put your name on it
            </h2>
          </div>
          <p className="text-sm text-crunch-black/60">
            Get your full revenue forecast and a personalised proposal in your inbox.
          </p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-2xl font-bold text-crunch-yellow">2 min</p>
          <p className="text-xs text-crunch-black/50">to review & sign</p>
        </div>
      </div>

      {emailSent ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={emailDeliveryFailed
            ? "flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl"
            : "flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl"}
        >
          {emailDeliveryFailed ? (
            <AlertTriangle className="h-6 w-6 text-amber-700 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
          )}
          <div>
            <p className={emailDeliveryFailed ? "font-medium text-amber-950" : "font-medium text-green-900"}>
              {emailDeliveryFailed ? "Your proposal is ready below" : `On its way to ${email}`}
            </p>
            <p className={emailDeliveryFailed ? "text-sm text-amber-900/80" : "text-sm text-green-800/70"}>
              {emailDeliveryFailed
                ? "We could not deliver the email, but your secure proposal and full forecast are available below."
                : "Your full forecast and proposal preview are now unlocked below. The email link is valid for 10 days."}
            </p>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calcName" className="text-crunch-black/70">
                First name
              </Label>
              <Input
                id="calcName"
                type="text"
                placeholder="e.g. Sarah"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="retro-input"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calcEmail" className="text-crunch-black/70">
                Email address
              </Label>
              <Input
                id="calcEmail"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="retro-input"
                required
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <Button
              type="submit"
              disabled={sendResultsMutation.isPending}
              className="w-full sm:w-auto bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black font-medium px-8 py-5 rounded-xl"
            >
              {sendResultsMutation.isPending ? (
                <span className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </span>
              ) : (
                <span className="flex items-center">
                  <Mail className="mr-2 h-4 w-4" />
                  Unlock my full forecast
                </span>
              )}
            </Button>
            <p className="text-xs text-crunch-black/50 text-center sm:text-left">
              No spam. Unsubscribe anytime. We keep your details private.
            </p>
          </div>
        </form>
      )}
    </motion.div>
  );
};
