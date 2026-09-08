import { useLocation } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth";
import {
  buildReferralUrl,
  buildWhatsAppShareUrl,
  defaultInviteMessage,
} from "@/lib/referral";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Routes where a floating button would get in the user's way
 * (auth flows, admin surfaces). Everywhere else it appears.
 */
const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/force-logout",
  "/admin",
];

export function FloatingShareButton() {
  const { pathname } = useLocation();
  const { profile } = useAuth();

  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const url = buildReferralUrl(profile?.id);
  const message = defaultInviteMessage(url);
  const shareHref = buildWhatsAppShareUrl(message);

  const handleClick = async () => {
    // Try to copy the URL as a convenient fallback; ignore failures
    // (permissions, insecure context) — WhatsApp still opens.
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        toast.success("Invite link ready to share");
      }
    } catch {
      /* clipboard blocked — silent */
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={shareHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleClick}
            aria-label="Invite a friend on WhatsApp"
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-crunch-yellow text-crunch-black shadow-lg transition-transform hover:scale-105 hover:bg-crunch-yellow/90 focus:outline-none focus:ring-2 focus:ring-crunch-yellow focus:ring-offset-2"
          >
            <MessageCircle className="h-7 w-7" fill="currentColor" strokeWidth={0} />
            <span className="sr-only">Invite a friend on WhatsApp</span>
          </a>
        </TooltipTrigger>
        <TooltipContent side="left">Invite a friend on WhatsApp</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default FloatingShareButton;
