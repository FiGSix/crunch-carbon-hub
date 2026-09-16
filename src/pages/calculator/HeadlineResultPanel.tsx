import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Zap, Leaf, Flame, TreePine, Info, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeadlineResultPanelProps {
  estimate: {
    systemSizeKwp: number;
    province: string;
    commissionDate: Date;
    annualEnergyKwh: number;
    carbonCreditsPerYear: number;
    clientSharePercentage: number;
    currentYearAnnualRevenue: number;
  };
  onEdit: () => void;
}

const useCountUp = (target: number, duration = 1500) => {
  const prefersReducedMotion = useReducedMotion();
  const [value, setValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setValue(target);
      return;
    }

    setValue(0);
    startTimeRef.current = null;

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      // easeOutQuart
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, prefersReducedMotion]);

  return value;
};

export const HeadlineResultPanel = ({ estimate, onEdit }: HeadlineResultPanelProps) => {
  const prefersReducedMotion = useReducedMotion();
  const {
    systemSizeKwp,
    province,
    commissionDate,
    annualEnergyKwh,
    carbonCreditsPerYear,
    clientSharePercentage,
    currentYearAnnualRevenue,
  } = estimate;

  const animatedRevenue = useCountUp(currentYearAnnualRevenue);
  const animatedEnergy = useCountUp(Math.round(annualEnergyKwh));
  const animatedCredits = useCountUp(Math.round(carbonCreditsPerYear));
  const animatedCoal = useCountUp(Math.round(annualEnergyKwh * 0.85));
  const animatedTrees = useCountUp(Math.round(carbonCreditsPerYear * 50));

  const stats = [
    {
      icon: Zap,
      value: animatedEnergy.toLocaleString(),
      unit: "kWh",
      label: "Annual generation",
    },
    {
      icon: Leaf,
      value: animatedCredits.toLocaleString(),
      unit: "tCO₂e",
      label: "Carbon credits per year",
    },
    {
      icon: Flame,
      value: animatedCoal.toLocaleString(),
      unit: "kg",
      label: "Coal avoided per year",
    },
    {
      icon: TreePine,
      value: animatedTrees.toLocaleString(),
      unit: "trees",
      label: "Equivalent trees planted",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="meta-card p-6 md:p-8 overflow-hidden"
      aria-live="polite"
    >
      <div className="relative flex justify-center mb-4" aria-hidden="true">
        {!prefersReducedMotion && [
          { x: -112, y: 14, rotate: -18, delay: 0.05 },
          { x: -76, y: -14, rotate: 16, delay: 0.12 },
          { x: -34, y: 8, rotate: -10, delay: 0.2 },
          { x: 34, y: -8, rotate: 12, delay: 0.08 },
          { x: 78, y: 12, rotate: -16, delay: 0.16 },
          { x: 112, y: -12, rotate: 20, delay: 0.24 },
        ].map((particle, index) => (
          <motion.span
            key={index}
            className="absolute top-1/2 h-2 w-2 rounded-sm bg-crunch-yellow"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4, rotate: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              x: particle.x,
              y: particle.y,
              scale: [0.4, 1, 0.8],
              rotate: particle.rotate,
            }}
            transition={{ duration: 1.15, delay: particle.delay, ease: "easeOut" }}
          />
        ))}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
          className="inline-flex items-center gap-2 rounded-full bg-crunch-yellow/15 px-4 py-2 text-sm font-semibold text-crunch-black"
        >
          <Sparkles className="h-4 w-4 text-crunch-yellow" />
          Your solar is already creating value
        </motion.div>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm font-medium text-crunch-black/60 mb-2">
          Your {systemSizeKwp.toLocaleString()} kWp system in {province}
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-crunch-black mb-2">
          Estimated annual income
        </h2>
        <p className="text-5xl md:text-6xl font-extrabold text-crunch-yellow tracking-tight drop-shadow-sm">
          R {animatedRevenue.toLocaleString()}
        </p>
        <p className="text-sm text-crunch-black/50 mt-2 max-w-lg mx-auto">
          Based on {province} solar yield and a {clientSharePercentage}% client share tier.
          First-year revenue is pro-rated from {commissionDate.toLocaleDateString("en-ZA")}.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + index * 0.1 }}
            className="bg-white/60 border border-crunch-black/5 rounded-xl p-4 text-center hover:shadow-sm transition-shadow"
          >
            <div className="flex justify-center mb-2">
              <div className="p-2 bg-crunch-yellow/10 rounded-lg">
                <stat.icon className="h-5 w-5 text-crunch-yellow" />
              </div>
            </div>
            <p className="text-xl md:text-2xl font-bold text-crunch-black">
              {stat.value}
            </p>
            <p className="text-xs text-crunch-black/60">{stat.unit}</p>
            <p className="text-xs text-crunch-black/50 mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-2 justify-center text-xs text-crunch-black/50">
        <Info className="h-4 w-4 text-crunch-yellow shrink-0 mt-0.5" />
        <span>
          This is an estimate only. Actual revenue depends on verified system performance,
          market carbon prices, and final cession agreement terms.
        </span>
      </div>

      <div className="mt-5 flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="text-crunch-black/60 hover:text-crunch-black"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit solar system details
        </Button>
      </div>
    </motion.div>
  );
};
