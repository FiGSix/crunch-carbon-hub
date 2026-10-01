import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Calculator } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { QuickCalcInputs } from "@/pages/QuickCalc";

const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];

interface QuickCalcFormProps {
  onCalculate: (inputs: QuickCalcInputs) => void;
  isCalculating: boolean;
  hasResults: boolean;
}

export const QuickCalcForm = ({ onCalculate, isCalculating, hasResults }: QuickCalcFormProps) => {
  const [province, setProvince] = useState<string>("");
  const [systemSize, setSystemSize] = useState<string>("");
  const [commissionDate, setCommissionDate] = useState<Date>();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!province) {
      newErrors.province = "Please select a province";
    }

    const size = parseFloat(systemSize);
    if (!systemSize || isNaN(size)) {
      newErrors.systemSize = "Please enter a valid system size";
    } else if (size <= 0) {
      newErrors.systemSize = "System size must be greater than 0";
    } else if (size > 15000) {
      newErrors.systemSize = "System size cannot exceed 15,000 kWp";
    }

    if (!commissionDate) {
      newErrors.commissionDate = "Please select a commissioning date";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate() && commissionDate) {
      onCalculate({
        province,
        systemSizeKwp: parseFloat(systemSize),
        commissionDate,
      });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Province Select */}
          <div className="space-y-2">
            <Label htmlFor="province">Province</Label>
            <Select value={province} onValueChange={(value) => {
              setProvince(value);
              setErrors(prev => ({ ...prev, province: "" }));
            }}>
              <SelectTrigger id="province" className={errors.province ? "border-destructive" : ""}>
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {SA_PROVINCES.map((prov) => (
                  <SelectItem key={prov} value={prov}>
                    {prov}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.province && (
              <p className="text-sm text-destructive">{errors.province}</p>
            )}
          </div>

          {/* System Size Input */}
          <div className="space-y-2">
            <Label htmlFor="systemSize">System Size (kWp)</Label>
            <Input
              id="systemSize"
              type="number"
              step="0.001"
              placeholder="e.g., 100"
              value={systemSize}
              onChange={(e) => {
                setSystemSize(e.target.value);
                setErrors(prev => ({ ...prev, systemSize: "" }));
              }}
              className={errors.systemSize ? "border-destructive" : ""}
            />
            {errors.systemSize && (
              <p className="text-sm text-destructive">{errors.systemSize}</p>
            )}
          </div>

          {/* Commissioning Date */}
          <div className="space-y-2">
            <Label>Commissioning Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !commissionDate && "text-muted-foreground",
                    errors.commissionDate && "border-destructive"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {commissionDate ? format(commissionDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={commissionDate}
                  onSelect={(date) => {
                    setCommissionDate(date);
                    setErrors(prev => ({ ...prev, commissionDate: "" }));
                  }}
                  disabled={(date) =>
                    date < new Date(2026, 6, 1) || date > new Date("2030-12-31")
                  }
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {errors.commissionDate && (
              <p className="text-sm text-destructive">{errors.commissionDate}</p>
            )}
          </div>
        </div>

        {/* Calculate Button */}
        <div className="flex justify-center">
          <Button
            type="submit"
            size="lg"
            disabled={isCalculating}
            className="bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black font-semibold px-8"
          >
            <Calculator className="mr-2 h-5 w-5" />
            {isCalculating ? "Calculating..." : hasResults ? "Recalculate" : "Calculate"}
          </Button>
        </div>
      </form>
    </div>
  );
};
