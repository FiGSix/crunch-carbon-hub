import { motion } from "framer-motion";
import { CarbonCreditTable } from "@/components/proposals/summary/carbon/CarbonCreditTable";
import { TrendingUp, Info } from "lucide-react";
import { format } from "date-fns";

interface FullForecastPanelProps {
  estimate: {
    systemSizeKwp: number;
    province: string;
    commissionDate: Date;
    annualEnergyKwh: number;
    carbonCreditsPerYear: number;
    clientSharePercentage: number;
    revenueByYear: Record<string, number>;
  };
}

export const FullForecastPanel = ({ estimate }: FullForecastPanelProps) => {
  const years = Object.keys(estimate.revenueByYear).sort();
  const commissionYear = estimate.commissionDate.getFullYear();

  // Pre-calculate yearly energy and credits with first-year pro-ration, mirroring
  // the revenue table logic so the forecast matches the headline.
  const preCalculatedYearlyMWh: Record<string, number> = {};
  const preCalculatedYearlyCredits: Record<string, number> = {};

  years.forEach((year) => {
    const yearNumber = parseInt(year, 10);
    let mwh = estimate.annualEnergyKwh / 1000;
    let credits = estimate.carbonCreditsPerYear;

    if (yearNumber === commissionYear) {
      const yearStart = new Date(yearNumber, 0, 1);
      const yearEnd = new Date(yearNumber, 11, 31);
      const remainingDays =
        Math.max(
          0,
          Math.floor((yearEnd.getTime() - estimate.commissionDate.getTime()) / (1000 * 60 * 60 * 24))
        ) + 1;
      const totalDaysInYear =
        Math.floor((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const factor = remainingDays / totalDaysInYear;
      mwh *= factor;
      credits *= factor;
    }

    preCalculatedYearlyMWh[year] = mwh;
    preCalculatedYearlyCredits[year] = credits;
  });

  const totalMWhGenerated = Object.values(preCalculatedYearlyMWh).reduce((a, b) => a + b, 0);
  const totalCarbonCredits = Object.values(preCalculatedYearlyCredits).reduce((a, b) => a + b, 0);
  const totalClientSpecificRevenue = Object.values(estimate.revenueByYear).reduce(
    (a, b) => a + b,
    0
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="meta-card p-6 md:p-8"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-crunch-yellow/10 rounded-lg">
          <TrendingUp className="h-5 w-5 text-crunch-yellow" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold text-crunch-black">
          Full Revenue Forecast
        </h2>
      </div>

      <p className="text-sm text-crunch-black/60 mb-6">
        {estimate.systemSizeKwp.toLocaleString()} kWp • {estimate.province} • Commissioned{" "}
        {format(estimate.commissionDate, "dd MMM yyyy")} • {estimate.clientSharePercentage}% client share
      </p>

      <div className="overflow-hidden rounded-xl border border-crunch-black/10">
        <CarbonCreditTable
          revenue={estimate.revenueByYear}
          systemSizeKWp={estimate.systemSizeKwp}
          commissionDate={format(estimate.commissionDate, "yyyy-MM-dd")}
          portfolioSize={0}
          totalMWhGenerated={totalMWhGenerated}
          totalCarbonCredits={totalCarbonCredits}
          totalClientSpecificRevenue={totalClientSpecificRevenue}
          preCalculatedYearlyMWh={preCalculatedYearlyMWh}
          preCalculatedYearlyCredits={preCalculatedYearlyCredits}
          preCalculatedYearlyRevenue={estimate.revenueByYear}
          clientShareOverride={estimate.clientSharePercentage}
        />
      </div>

      <div className="mt-4 flex items-start gap-2 text-xs text-crunch-black/50">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Revenue is shown in South African Rand and is based on current carbon price assumptions to 2030.
          Prices, grid factors, and your actual generation may change. Forecasts are estimates, not guarantees.
        </p>
      </div>
    </motion.div>
  );
};
