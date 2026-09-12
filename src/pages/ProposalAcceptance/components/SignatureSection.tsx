import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, PenTool } from "lucide-react";
import { SignaturePad } from "@/components/proposals/signature/SignatureCanvas";

interface SignatureSectionProps {
  hasScrolledToBottom: boolean;
  hasAgreed: boolean;
  onAgreeChange: (checked: boolean) => void;
  signatureImage: string | null;
  onSignatureImageChange: (image: string | null) => void;
  clientName: string;
  /** Set when the cedent is a company — a natural person must be named. */
  companyName?: string | null;
  signatoryName: string;
  onSignatoryNameChange: (name: string) => void;
  signatoryNameLocked?: boolean;
  canSubmit: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function SignatureSection({
  hasScrolledToBottom,
  hasAgreed,
  onAgreeChange,
  signatureImage,
  onSignatureImageChange,
  clientName,
  companyName,
  signatoryName,
  onSignatoryNameChange,
  signatoryNameLocked = false,
  canSubmit,
  isSubmitting,
  onSubmit,
}: SignatureSectionProps) {
  const hasSignature = signatureImage !== null;

  
  return (
    <Card className="border-2 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PenTool className="h-5 w-5" />
          Digital Signature
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Complete the steps below to accept this proposal
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Scroll to bottom */}
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          {hasScrolledToBottom ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className="font-medium">Step 1: Read Terms & Conditions</p>
            <p className="text-sm text-muted-foreground">
              {hasScrolledToBottom ? "Completed" : "Scroll to the bottom of the terms"}
            </p>
          </div>
        </div>

        {/* Step 2: Agreement checkbox */}
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          {hasAgreed ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-medium">Step 2: Confirm Agreement</p>
              <p className="text-sm text-muted-foreground">Check the box to confirm you agree</p>
            </div>
            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                className="mt-0.5"
                checked={hasAgreed}
                onCheckedChange={(checked) => onAgreeChange(checked === true)}
                disabled={!hasScrolledToBottom}
              />
              <Label
                htmlFor="terms"
                className={`text-sm leading-relaxed cursor-pointer ${!hasScrolledToBottom ? 'opacity-50' : ''}`}
              >
                I have read and agree to the Carbon Right Cession Agreement and confirm that I am
                authorised to sign for the named party.
              </Label>
            </div>
          </div>
        </div>

        {/* Step 3: Sign */}
        <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
          {hasSignature ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
          ) : (
            <div className="h-5 w-5 rounded-full border-2 border-muted-foreground mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-medium">Step 3: Draw Your Signature</p>
              <p className="text-sm text-muted-foreground">
                Sign in the box below using your mouse, trackpad or touchscreen
              </p>

            </div>

            {companyName && (
              <div className="space-y-2 rounded-md border border-border bg-background p-3">
                <Label htmlFor="signatory-name">
                  Full name of the person signing for {companyName}
                  <span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="signatory-name"
                  type="text"
                  placeholder="e.g. Jane Ndlovu"
                  value={signatoryName}
                  onChange={(e) => onSignatoryNameChange(e.target.value)}
                  disabled={!hasAgreed || signatoryNameLocked}
                />
                <p className="text-xs text-muted-foreground">
                  {signatoryNameLocked
                    ? 'This verified account name will be printed on the agreement as the signatory.'
                    : 'A company signs through a natural person. This name is printed on the agreement as the signatory.'}
                </p>
              </div>
            )}
            <div className={`space-y-2 ${!hasAgreed ? 'pointer-events-none opacity-50' : ''}`}>
              <SignaturePad
                onSignatureChange={onSignatureImageChange}
                clientName={clientName}
              />
              {signatureImage && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Signature captured</span>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Submit button */}
        <div className="pt-4 border-t">
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || isSubmitting}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting Agreement...
              </>
            ) : (
              <>
                <PenTool className="mr-2 h-4 w-4" />
                Sign and accept proposal
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Your drawn signature is legally binding.
          </p>

        </div>
      </CardContent>
    </Card>
  );
}
