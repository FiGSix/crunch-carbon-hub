import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProposalData } from "@/types/proposals";

interface TermsAndConditionsSectionProps {
  onScrolledToBottom: () => void;
  proposal: ProposalData;
}

interface LiveLegalDocument {
  id: string;
  title: string;
  content: string;
  current_version: number;
  effective_date: string;
  file_path: string | null;
  file_mime: string | null;
  set_live_at: string | null;
}

/**
 * Renders the CURRENTLY LIVE cession agreement, sourced from
 * Admin → Legal Documents. There is deliberately no hardcoded fallback text:
 * the live revision is the single source of truth for what a client reads and
 * signs, so if none is published we block rather than show stale wording.
 */
export function TermsAndConditionsSection({ onScrolledToBottom, proposal }: TermsAndConditionsSectionProps) {
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const [progress, setProgress] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max <= 0 ? 100 : Math.min(100, Math.round((el.scrollTop / max) * 100)));
  };

  // One screenful at a time — reading is still required, we only make the
  // gesture easier on a phone.
  const advance = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (hasReachedBottom) {
      el.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    el.scrollBy({ top: el.clientHeight * 0.85, behavior: "smooth" });
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ["live-legal-document", "cession_agreement"],
    queryFn: async (): Promise<LiveLegalDocument | null> => {
      const { data, error } = await supabase.rpc("get_live_legal_document", {
        p_document_type: "cession_agreement",
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as LiveLegalDocument) ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const ready = Boolean(data?.content);

  useEffect(() => {
    if (!ready) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasReachedBottom) {
          setHasReachedBottom(true);
          onScrolledToBottom();
        }
      },
      { threshold: 1.0 }
    );

    const node = sentinelRef.current;
    if (node) observer.observe(node);
    return () => observer.disconnect();
  }, [ready, hasReachedBottom, onScrolledToBottom]);

  // Split the extracted text into paragraphs, keeping the source order and
  // wording verbatim — we never re-typeset or paraphrase the legal text.
  const paragraphs = (data?.content ?? "")
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{data?.title || "Cession Agreement"}</CardTitle>
            {data && (
              <p className="text-xs text-muted-foreground mt-1">
                Revision {data.current_version}
                {data.effective_date
                  ? ` · effective ${new Date(data.effective_date).toLocaleDateString()}`
                  : ""}
              </p>
            )}
          </div>
          {hasReachedBottom && (
            <div className="flex items-center gap-2 text-sm text-green-600 shrink-0">
              <CheckCircle2 className="h-4 w-4" />
              <span>Scrolled to bottom</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Please scroll through and read all terms carefully before signing
        </p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {!isLoading && (error || !ready) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-900 font-medium">
                The agreement is temporarily unavailable
              </p>
              <p className="text-amber-800 text-sm mt-0.5">
                No live version of the Cession Agreement is currently published, so
                signing is disabled. Please contact us and we will send you a fresh link.
              </p>
            </div>
          </div>
        )}

        {!isLoading && ready && (
          <div className="relative">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              You have read {progress}%
            </p>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="max-h-[75vh] md:max-h-[400px] overflow-y-auto overscroll-contain border rounded-lg p-4 md:p-6 space-y-4"
            >
              {paragraphs.map((line, i) => (
                <p
                  key={i}
                  className="text-[15px] md:text-sm leading-7 md:leading-relaxed whitespace-pre-wrap text-foreground"
                >
                  {line}
                </p>
              ))}

              <div className="pt-6 border-t mt-6">
                <p className="text-xs text-muted-foreground">
                  Signing as: {proposal?.content?.clientInfo?.name || "the Owner"}
                  {proposal?.content?.projectInfo?.address
                    ? ` · Site: ${proposal.content.projectInfo.address}`
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your owner and site details are recorded on the signature page of the
                  signed document.
                </p>
              </div>

              <div ref={sentinelRef} className="h-1" />
            </div>

            <button
              type="button"
              onClick={advance}
              aria-label={hasReachedBottom ? "Back to top of agreement" : "Continue reading"}
              className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg active:scale-95 transition"
            >
              {hasReachedBottom ? (
                <>
                  <ArrowUp className="h-4 w-4" />
                  Back to top
                </>
              ) : (
                <>
                  <ArrowDown className="h-4 w-4" />
                  Continue reading
                </>
              )}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
