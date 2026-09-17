import { useEffect, useRef, useState, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Zap, Leaf, Flame, TreePine, Info, Pencil, Sparkles, Sun, Circle, Star } from "lucide-react";
import confetti from "canvas-confetti";
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

type ParticleShape = "square" | "circle" | "star";

interface ParticleConfig {
  id: number;
  x: number;
  y: number;
  rotate: number;
  scale: number;
  delay: number;
  duration: number;
  color: string;
  shape: ParticleShape;
}

const Celebration = () => {
  const prefersReducedMotion = useReducedMotion();

  const particles = useMemo<ParticleConfig[]>(() => {
    const colors = [
      "text-crunch-yellow",
      "text-crunch-black",
      "text-white",
      "text-crunch-yellow",
      "text-crunch-black/70",
    ];
    const shapes: ParticleShape[] = ["square", "circle", "star"];
    return Array.from({ length: 24 }, (_, i) => {
      const angle = (i / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const distance = 90 + Math.random() * 110;
      return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance - 30 + Math.random() * 40,
        rotate: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.9,
        delay: Math.random() * 0.18,
        duration: 0.9 + Math.random() * 0.6,
        color: colors[i % colors.length],
        shape: shapes[i % shapes.length],
      };
    });
  }, []);

  const floatingIcons = useMemo(() => {
    return [
      { Icon: Sparkles, color: "text-crunch-yellow", x: -140, y: -40, delay: 0.1, scale: 1.1 },
      { Icon: Leaf, color: "text-crunch-yellow", x: 130, y: -60, delay: 0.25, scale: 0.9 },
      { Icon: Zap, color: "text-crunch-black/70", x: -100, y: 50, delay: 0.4, scale: 0.8 },
      { Icon: Sun, color: "text-crunch-yellow", x: 110, y: 40, delay: 0.55, scale: 1 },
    ];
  }, []);

  if (prefersReducedMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {/* Flash ring behind the badge */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-crunch-yellow/30"
        initial={{ width: 40, height: 40, opacity: 0 }}
        animate={{ width: 320, height: 320, opacity: [0, 0.6, 0] }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />

      {/* Confetti particles */}
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className={`absolute left-1/2 top-1/2 ${p.color}`}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.3, rotate: 0 }}
          animate={{
            opacity: [0, 1, 1, 0],
            x: [0, p.x * 0.55, p.x],
            y: [0, p.y * 0.45, p.y + 80],
            scale: [0.3, p.scale, p.scale * 0.6],
            rotate: [0, p.rotate * 0.5, p.rotate],
          }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
          style={{ width: 8, height: 8 }}
        >
          {p.shape === "circle" && <Circle className="h-full w-full" strokeWidth={0} fill="currentColor" />}
          {p.shape === "star" && <Star className="h-full w-full" strokeWidth={0} fill="currentColor" />}
          {p.shape === "square" && <div className="h-full w-full rounded-sm bg-current" />}
        </motion.div>
      ))}

      {/* Floating icon accents */}
      {floatingIcons.map(({ Icon, color, x, y, delay, scale }, i) => (
        <motion.div
          key={i}
          className={`absolute left-1/2 top-1/2 ${color}`}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
          animate={{
            opacity: [0, 1, 0],
            x: [0, x * 0.6, x],
            y: [0, y * 0.7, y - 60],
            scale: [0.5, scale, scale * 0.7],
          }}
          transition={{ duration: 1.6, delay, ease: "easeOut" }}
        >
          <Icon className="h-7 w-7" strokeWidth={2} />
        </motion.div>
      ))}
    </div>
  );
};

const useFullScreenCelebration = (enabled: boolean) => {
  useEffect(() => {
    if (!enabled) return;

    const rootStyles = getComputedStyle(document.documentElement);
    const tokenColor = (token: string) => `hsl(${rootStyles.getPropertyValue(token).trim()})`;
    const greenSwatch = document.createElement("span");
    greenSwatch.className = "bg-green-500";
    greenSwatch.style.position = "fixed";
    greenSwatch.style.opacity = "0";
    document.body.appendChild(greenSwatch);

    const colors = [
      tokenColor("--crunch-yellow"),
      tokenColor("--crunch-black"),
      tokenColor("--background"),
      getComputedStyle(greenSwatch).backgroundColor,
    ];
    greenSwatch.remove();

    let animationFrame = 0;
    const startTimer = window.setTimeout(() => {
      const end = Date.now() + 1900;

      const launch = () => {
        confetti({
          particleCount: 2,
          angle: 72,
          spread: 42,
          startVelocity: 42,
          gravity: 1.15,
          ticks: 180,
          origin: { x: 0, y: 0.78 },
          colors,
          disableForReducedMotion: true,
          zIndex: 60,
        });
        confetti({
          particleCount: 2,
          angle: 108,
          spread: 42,
          startVelocity: 42,
          gravity: 1.15,
          ticks: 180,
          origin: { x: 1, y: 0.78 },
          colors,
          disableForReducedMotion: true,
          zIndex: 60,
        });

        if (Date.now() < end) animationFrame = requestAnimationFrame(launch);
      };

      launch();
    }, 180);

    return () => {
      window.clearTimeout(startTimer);
      cancelAnimationFrame(animationFrame);
      confetti.reset();
    };
  }, [enabled]);
};

export const HeadlineResultPanel = ({ estimate, onEdit }: HeadlineResultPanelProps) => {
  const prefersReducedMotion = useReducedMotion();
  useFullScreenCelebration(!prefersReducedMotion);
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
      transition={{ duration: prefersReducedMotion ? 0 : 0.5, delay: 0.1 }}
      className="meta-card p-6 md:p-8 overflow-hidden relative"
      aria-live="polite"
    >
      <div className="relative flex justify-center mb-5" aria-hidden="true">
        <Celebration />

        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 220,
            damping: 12,
            delay: prefersReducedMotion ? 0 : 0.15,
          }}
          className="relative inline-flex items-center gap-2 rounded-full bg-crunch-yellow/15 px-4 py-2.5 text-sm md:text-base font-semibold text-crunch-black shadow-sm ring-1 ring-crunch-yellow/30"
        >
          <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-crunch-yellow" />
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
