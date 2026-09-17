import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { CalendarIcon, Calculator, Home, Building2, ChevronDown, ChevronUp, Zap, Info } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const PANEL_WATTAGES = [
  { value: "350", label: "350W" },
  { value: "400", label: "400W" },
  { value: "450", label: "450W (Most Common)" },
  { value: "500", label: "500W" },
  { value: "550", label: "550W" },
  { value: "600", label: "600W" },
];

type Segment = "homeowner" | "business";

interface SystemInputPanelProps {
  segment: Segment;
  onSegmentChange: (segment: Segment) => void;
  systemSize: string;
  onSystemSizeChange: (value: string) => void;
  province: string;
  onProvinceChange: (value: string) => void;
  commissionDate: Date | undefined;
  onCommissionDateChange: (date: Date | undefined) => void;
  errors: Record<string, string>;
  onCalculate: () => void;
  isCalculating: boolean;
}

export const SystemInputPanel = ({
  segment,
  onSegmentChange,
  systemSize,
  onSystemSizeChange,
  province,
  onProvinceChange,
  commissionDate,
  onCommissionDateChange,
  errors,
  onCalculate,
  isCalculating,
}: SystemInputPanelProps) => {
  const [showPanelHelper, setShowPanelHelper] = useState(false);
  const [numberOfPanels, setNumberOfPanels] = useState("");
  const [panelWattage, setPanelWattage] = useState("450");

  const calculatedSizeKw =
    numberOfPanels && panelWattage
      ? (parseFloat(numberOfPanels) * parseFloat(panelWattage)) / 1000
      : 0;

  const applyPanelCalculation = () => {
    if (calculatedSizeKw > 0) {
      onSystemSizeChange(`${calculatedSizeKw.toFixed(3)}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      id="crunch-the-numbers"
      className="meta-card p-6 md:p-8 relative scroll-mt-28"
    >
      <div className="absolute -top-5 left-1/2 transform -translate-x-1/2 bg-crunch-yellow/90 text-crunch-black font-medium px-4 py-2 rounded-full shadow-md whitespace-nowrap">
        <span className="flex items-center justify-center text-sm">
          <Calculator className="mr-2 h-4 w-4" />
          Crunch the Numbers
        </span>
      </div>

      <h2 className="text-xl md:text-2xl font-bold text-center mb-2 text-crunch-black mt-4">
        Tell Us About Your Solar System
      </h2>
      <p className="text-center text-sm text-crunch-black/60 mb-6 md:mb-8">
        Free • No signup required • Instant results
      </p>

      <div className="space-y-6">
        {/* Segment toggle */}
        <div className="flex justify-center">
          <div className="inline-flex bg-muted rounded-xl p-1">
            <button
              type="button"
              onClick={() => onSegmentChange("homeowner")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                segment === "homeowner"
                  ? "bg-white text-crunch-black shadow-sm"
                  : "text-crunch-black/60 hover:text-crunch-black"
              )}
            >
              <Home className="h-4 w-4" />
              Homeowner
            </button>
            <button
              type="button"
              onClick={() => onSegmentChange("business")}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                segment === "business"
                  ? "bg-white text-crunch-black shadow-sm"
                  : "text-crunch-black/60 hover:text-crunch-black"
              )}
            >
              <Building2 className="h-4 w-4" />
              Business
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* System size */}
          <div className="space-y-2">
            <Label htmlFor="systemSize" className="text-crunch-black/70">
              System Size
            </Label>
            <Input
              id="systemSize"
              type="text"
              placeholder="e.g. 5 kWp or 1.5 MWp"
              value={systemSize}
              onChange={(e) => onSystemSizeChange(e.target.value)}
              className={cn("retro-input text-base", errors.systemSize && "border-destructive")}
            />
            {errors.systemSize && (
              <p className="text-sm text-destructive">{errors.systemSize}</p>
            )}

            <button
              type="button"
              onClick={() => setShowPanelHelper((v) => !v)}
              className="flex items-center text-xs text-crunch-black/50 hover:text-crunch-black transition-colors"
            >
              {showPanelHelper ? (
                <ChevronUp className="h-3 w-3 mr-1" />
              ) : (
                <ChevronDown className="h-3 w-3 mr-1" />
              )}
              Calculate from panel count
            </button>

            <AnimatePresence>
              {showPanelHelper && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-crunch-yellow/5 rounded-lg p-4 space-y-3 border border-crunch-yellow/20">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="panelCount" className="text-xs text-crunch-black/70">
                          Number of panels
                        </Label>
                        <Input
                          id="panelCount"
                          type="number"
                          min="1"
                          placeholder="e.g. 20"
                          value={numberOfPanels}
                          onChange={(e) => setNumberOfPanels(e.target.value)}
                          className="retro-input text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="panelWattage" className="text-xs text-crunch-black/70">
                          Wattage each
                        </Label>
                        <Select value={panelWattage} onValueChange={setPanelWattage}>
                          <SelectTrigger id="panelWattage" className="retro-input text-sm mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PANEL_WATTAGES.map((w) => (
                              <SelectItem key={w.value} value={w.value}>
                                {w.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    {calculatedSizeKw > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-crunch-black/70">
                          {numberOfPanels} × {panelWattage}W ={" "}
                          <strong>{calculatedSizeKw.toFixed(3)} kWp</strong>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={applyPanelCalculation}
                          className="h-8 text-xs border-crunch-black/20"
                        >
                          Use this size
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Province */}
          <div className="space-y-2">
            <Label htmlFor="province" className="text-crunch-black/70">
              Province
            </Label>
            <Select value={province} onValueChange={onProvinceChange}>
              <SelectTrigger
                id="province"
                className={cn("retro-input text-base", errors.province && "border-destructive")}
              >
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
        </div>

        {/* Commissioning date */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-crunch-black/70">Commissioning Date</Label>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-crunch-black/40 cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="bg-white border-2 border-crunch-black max-w-xs">
                  <p className="text-sm">
                    Systems commissioned before 15 September 2022 are not eligible for the Crunch Carbon programme under our Verra-registered project rules.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal retro-input h-auto px-4 py-3",
                  !commissionDate && "text-muted-foreground",
                  errors.commissionDate && "border-destructive"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                <span className="truncate">
                  {commissionDate ? format(commissionDate, "dd MMM yyyy") : "Select the date your system was installed"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={commissionDate}
                onSelect={onCommissionDateChange}
                disabled={(date) => date < new Date("2022-09-15") || date > new Date("2030-12-31")}
                initialFocus
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {errors.commissionDate && (
            <p className="text-sm text-destructive">{errors.commissionDate}</p>
          )}
        </div>

        <Button
          onClick={onCalculate}
          disabled={isCalculating}
          className="w-full bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black font-medium text-base md:text-lg py-4 md:py-6 rounded-xl group transition-all hover:-translate-y-1 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none min-h-[44px]"
        >
          <span className="flex items-center">
            {isCalculating ? (
              <>
                <Zap className="mr-2 h-5 w-5 animate-pulse" />
                Crunching numbers…
              </>
            ) : (
              <>
                Calculate My Earnings
                <Calculator className="ml-2 h-5 w-5 group-hover:rotate-12 transition-transform" />
              </>
            )}
          </span>
        </Button>

        <p className="text-center text-xs text-crunch-black/50">
          We'll show your Rand earnings instantly. Add your details afterwards to go straight to signing.
        </p>
      </div>
    </motion.div>
  );
};
