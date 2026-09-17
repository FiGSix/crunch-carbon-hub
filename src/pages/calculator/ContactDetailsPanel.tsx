import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MapboxAddressAutocomplete } from "@/components/common/MapboxAddressAutocomplete";
import { ArrowRight, FileSignature, Loader2, Pencil } from "lucide-react";
import { useSendCalculatorResults } from "@/hooks/calculator/useCalculatorResults";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface ContactDetailsPanelProps {
  estimate: {
    systemSizeKwp: number;
    province: string;
    commissionDate: Date;
    segment: string;
    annualEnergyKwh: number;
    carbonCreditsPerYear: number;
  };
  onEdit: () => void;
  onReady: (proposalId: string, token: string) => void;
}

const phoneSchema = z
  .string()
  .trim()
  .min(1, "Contact number is required")
  .refine((v) => v.replace(/\D/g, "").length >= 9, "Please enter a valid contact number");

const baseSchema = {
  firstName: z.string().trim().min(2, "First name is required"),
  lastName: z.string().trim().min(2, "Surname is required"),
  phone: phoneSchema,
  email: z.string().trim().email("Please enter a valid email address"),
  address: z.string().trim().min(8, "Please enter the solar system address"),
};

export const ContactDetailsPanel = ({ estimate, onEdit, onReady }: ContactDetailsPanelProps) => {
  const isBusiness = estimate.segment === "business";

  const schema = useMemo(
    () =>
      z.object({
        ...baseSchema,
        companyName: isBusiness
          ? z.string().trim().min(2, "Business name is required")
          : z.string().trim().optional(),
      }),
    [isBusiness]
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [manualAddress, setManualAddress] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const sendResultsMutation = useSendCalculatorResults();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = schema.safeParse({ firstName, lastName, phone, email, address, companyName });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      const referralCode = localStorage.getItem("referralCode");
      const response = await sendResultsMutation.mutateAsync({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        companyName: isBusiness ? companyName.trim() : undefined,
        systemSizeKwp: estimate.systemSizeKwp,
        commissioningDate: format(estimate.commissionDate, "yyyy-MM-dd"),
        referralCode: referralCode || undefined,
        address: address.trim(),
        addressLat: coords?.lat,
        addressLng: coords?.lng,
        province: estimate.province,
        segment: estimate.segment,
        sendEmail: false,
      });

      onReady(response.proposalId, response.token);
    } catch (error) {
      logger.error("Failed to prepare calculator proposal", { error });
      toast.error(
        error instanceof Error
          ? error.message
          : "We could not prepare your agreement. Please try again."
      );
    }
  };

  const fieldError = (key: string) =>
    errors[key] ? <p className="text-sm text-destructive mt-1">{errors[key]}</p> : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="meta-card p-6 md:p-8"
    >
      <div className="flex items-center gap-2 mb-1">
        <FileSignature className="h-5 w-5 text-crunch-yellow" />
        <h2 className="text-xl md:text-2xl font-bold text-crunch-black">
          Almost there — let's get your agreement ready
        </h2>
      </div>
      <p className="text-sm text-crunch-black/60">
        A few details and we'll take you straight to your cession agreement to review and sign.
      </p>

      <div className="mt-5 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-crunch-yellow/10 border border-crunch-yellow/30 px-4 py-3 text-sm text-crunch-black/80">
        <span>
          <strong>{estimate.systemSizeKwp.toLocaleString()} kWp</strong> system
        </span>
        <span className="hidden sm:inline text-crunch-black/30">•</span>
        <span>{estimate.province}</span>
        <span className="hidden sm:inline text-crunch-black/30">•</span>
        <span>Commissioned {format(estimate.commissionDate, "dd MMM yyyy")}</span>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onEdit}
          className="h-auto p-0 ml-auto text-xs text-crunch-black/70"
        >
          <Pencil className="mr-1 h-3 w-3" />
          Edit solar system details
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="calcFirstName" className="text-crunch-black/70">
              First name
            </Label>
            <Input
              id="calcFirstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="e.g. Sarah"
              className="retro-input"
            />
            {fieldError("firstName")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="calcLastName" className="text-crunch-black/70">
              Surname
            </Label>
            <Input
              id="calcLastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="e.g. Naidoo"
              className="retro-input"
            />
            {fieldError("lastName")}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="calcPhone" className="text-crunch-black/70">
              Contact number
            </Label>
            <Input
              id="calcPhone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 082 123 4567"
              className="retro-input"
            />
            {fieldError("phone")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="calcEmail" className="text-crunch-black/70">
              Email address
            </Label>
            <Input
              id="calcEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="retro-input"
            />
            {fieldError("email")}
          </div>
        </div>

        {isBusiness && (
          <div className="space-y-2">
            <Label htmlFor="calcCompany" className="text-crunch-black/70">
              Business name
            </Label>
            <Input
              id="calcCompany"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Registered company name"
              className="retro-input"
            />
            {fieldError("companyName")}
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="calcAddress" className="text-crunch-black/70">
              Solar system address
            </Label>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => setManualAddress((m) => !m)}
            >
              {manualAddress ? "Use address search" : "Type it manually"}
            </Button>
          </div>
          {manualAddress ? (
            <Input
              id="calcAddress"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setCoords(null);
              }}
              placeholder="Street, suburb, city, postal code"
              className="retro-input"
            />
          ) : (
            <MapboxAddressAutocomplete
              value={address}
              onChange={(value, selected) => {
                setAddress(value);
                setCoords(selected ?? null);
              }}
              placeholder="Start typing the address where the system is installed…"
              className="retro-input"
            />
          )}
          {fieldError("address")}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={sendResultsMutation.isPending}
            className="w-full sm:w-auto bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black font-medium px-8 py-5 rounded-xl group"
          >
            {sendResultsMutation.isPending ? (
              <span className="flex items-center">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Preparing your agreement…
              </span>
            ) : (
              <span className="flex items-center">
                Continue to sign
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </Button>
          <p className="text-xs text-crunch-black/50 text-center sm:text-left">
            No spam. We keep your details private and only use them for your agreement.
          </p>
        </div>
      </form>
    </motion.div>
  );
};
