import abb from "@/assets/equipment/abb.png.asset.json";
import afore from "@/assets/equipment/afore.png.asset.json";
import alphaess from "@/assets/equipment/alphaess.avif.asset.json";
import ario from "@/assets/equipment/ario.svg.asset.json";
import atess from "@/assets/equipment/atess.png.asset.json";
import bydSolar from "@/assets/equipment/byd-solar.jpg.asset.json";
import canadianSolar from "@/assets/equipment/canadian-solar.png.asset.json";
import deye from "@/assets/equipment/deye.svg.asset.json";
import dogoEnergy from "@/assets/equipment/dogo-energy.png.asset.json";
import dyness from "@/assets/equipment/dyness.svg.asset.json";
import enphase from "@/assets/equipment/enphase.png.asset.json";
import freedomWon from "@/assets/equipment/freedom-won.png.asset.json";
import fronius from "@/assets/equipment/fronius.png.asset.json";
import givenergy from "@/assets/equipment/givenergy.webp.asset.json";
import goodwe from "@/assets/equipment/goodwe.svg.asset.json";
import greenrich from "@/assets/equipment/greenrich.png.asset.json";
import growatt from "@/assets/equipment/growatt.png.asset.json";
import hiMo from "@/assets/equipment/hi-mo.svg.asset.json";
import huawei from "@/assets/equipment/huawei_logo.png.asset.json";
import hubble from "@/assets/equipment/hubble_energy.png.asset.json";
import ig3n from "@/assets/equipment/i-g3n.jpeg.asset.json";
import luxpower from "@/assets/equipment/luxpower.png.asset.json";
import megarevo from "@/assets/equipment/megarevo.jpeg.asset.json";
import schneider from "@/assets/equipment/schneider.svg.asset.json";
import sigenergy from "@/assets/equipment/sigenergy.png.asset.json";
import sineng from "@/assets/equipment/sineng.png.asset.json";
import sivula from "@/assets/equipment/sivula-logo.svg.asset.json";
import sinexel from "@/assets/equipment/sinexel.png.asset.json";
import sma from "@/assets/equipment/SMA.png.asset.json";
import solarEdge from "@/assets/equipment/solar_edge.png.asset.json";
import solis from "@/assets/equipment/solis.webp.asset.json";
import sunSynk from "@/assets/equipment/sunsynk.png.asset.json";
import tesla from "@/assets/equipment/tesla-energy.webp.asset.json";
import sungrow from "@/assets/equipment/sungrow.svg.asset.json";
import victron from "@/assets/equipment/victron_logo_rgb.svg.asset.json";
import weg from "@/assets/equipment/weg.png.asset.json";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const equipmentBrands = [
  { name: "ABB", src: abb.url },
  { name: "Afore", src: afore.url },
  { name: "AlphaESS", src: alphaess.url },
  { name: "Ario", src: ario.url },
  { name: "ATESS", src: atess.url },
  { name: "BYD Solar", src: bydSolar.url },
  { name: "Canadian Solar", src: canadianSolar.url },
  { name: "Deye", src: deye.url },
  { name: "Dogo Energy", src: dogoEnergy.url },
  { name: "Dyness", src: dyness.url },
  { name: "Enphase", src: enphase.url },
  { name: "Freedom Won", src: freedomWon.url },
  { name: "Fronius", src: fronius.url },
  { name: "GivEnergy", src: givenergy.url },
  { name: "GoodWe", src: goodwe.url },
  { name: "Greenrich", src: greenrich.url },
  { name: "Growatt", src: growatt.url },
  { name: "Hi-MO", src: hiMo.url },
  { name: "Huawei", src: huawei.url },
  { name: "Hubble Energy", src: hubble.url },
  { name: "i-G3N", src: ig3n.url },
  { name: "Luxpower", src: luxpower.url },
  { name: "Megarevo", src: megarevo.url },
  { name: "Schneider Electric", src: schneider.url },
  { name: "SigEnergy", src: sigenergy.url },
  { name: "Sineng", src: sineng.url },
  { name: "Sinexcel", src: sinexel.url },
  { name: "Sivula", src: sivula.url },
  { name: "SMA", src: sma.url },
  { name: "SolarEdge", src: solarEdge.url },
  { name: "Solis", src: solis.url },
  { name: "Sun Synk", src: sunSynk.url },
  { name: "Tesla Energy", src: tesla.url },
  { name: "Sungrow", src: sungrow.url },
  { name: "Victron Energy", src: victron.url },
  { name: "WEG", src: weg.url },
];

export const SocialProofSection = () => {
  const reduced = useReducedMotion();
  const midpoint = Math.ceil(equipmentBrands.length / 2);
  const firstRow = equipmentBrands.slice(0, midpoint);
  const secondRow = equipmentBrands.slice(midpoint);

  const renderBrand = (brand: (typeof equipmentBrands)[number], key: string) => (
    <div key={key} className="flex h-20 w-44 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-card px-5">
      <img
        src={brand.src}
        alt={`${brand.name} logo`}
        loading="lazy"
        className="max-h-11 max-w-full object-contain opacity-60 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
      />
    </div>
  );

  return (
    <section className="border-y border-border/50 bg-background py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4a900]">
            Compatible equipment
          </p>
          <h2 className="mt-3 text-3xl font-bold lowercase tracking-tight text-foreground md:text-4xl">
            works with the solar equipment you already have.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Crunch Carbon integrates with leading inverter, battery, and panel
            brands to verify your generation data automatically — no extra
            hardware required.
          </p>
        </div>

        <div className="mt-12 space-y-4 overflow-hidden">
          <div className="group overflow-x-auto md:overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-4 px-4 md:animate-partner-rail md:group-hover:[animation-play-state:paused]" style={reduced ? { animation: "none" } : undefined}>
              {[...firstRow, ...firstRow].map((brand, index) => renderBrand(brand, `first-${index}`))}
            </div>
          </div>
          <div className="group overflow-x-auto md:overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-4 px-4 md:animate-partner-rail-reverse md:group-hover:[animation-play-state:paused]" style={reduced ? { animation: "none" } : undefined}>
              {[...secondRow, ...secondRow].map((brand, index) => renderBrand(brand, `second-${index}`))}
            </div>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted-foreground">
          Don't see your brand? We add new integrations regularly — your
          installer can confirm compatibility when you register.
        </p>
      </div>
    </section>
  );
};
