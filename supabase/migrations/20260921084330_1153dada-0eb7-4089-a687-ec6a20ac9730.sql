
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS resign_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resign_requested_at timestamptz;

ALTER TABLE public.proposal_agreements
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid REFERENCES public.proposal_agreements(id);

CREATE INDEX IF NOT EXISTS idx_proposals_resign_required
  ON public.proposals(resign_required) WHERE resign_required;
