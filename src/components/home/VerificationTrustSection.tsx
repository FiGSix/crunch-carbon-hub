import { useReducedMotion } from "@/hooks/useReducedMotion";
import afripower from "@/assets/partners/afripower.png.asset.json";
import autox from "@/assets/partners/autox.png.asset.json";
import azoteq from "@/assets/partners/azoteq.png.asset.json";
import broadSky from "@/assets/partners/broad-sky.png.asset.json";
import deoSolar from "@/assets/partners/deo-solar.svg.asset.json";
import greenwaySolar from "@/assets/partners/greenway-solar.svg.asset.json";
import gridvolt from "@/assets/partners/gridvolt.png.asset.json";
import icSolar from "@/assets/partners/ic-solar.png.asset.json";
import infoled from "@/assets/partners/infoled.png.asset.json";
import jcEnergy from "@/assets/partners/jc-energy.png.asset.json";
import keillerPower from "@/assets/partners/keiller-power-solutions.jpg.asset.json";
import loveSun from "@/assets/partners/LoveSun.png.asset.json";
import misolar from "@/assets/partners/misolar.png.asset.json";
import newPlanetEnergy from "@/assets/partners/new-planet-energy.png.asset.json";
import nuvoEnergy from "@/assets/partners/nuvo-energy.png.asset.json";
import oryxRenewables from "@/assets/partners/oryx-renewables.png.asset.json";
import pvSolutions from "@/assets/partners/pv-solutions.png.asset.json";
import renenEnergy from "@/assets/partners/renen-energy.png.asset.json";
import samekhGroup from "@/assets/partners/samekh-group.jpg.asset.json";
import sgSolar from "@/assets/partners/sg-solar.avif.asset.json";
import socoEnergy from "@/assets/partners/soco-energy.svg.asset.json";
import solargy from "@/assets/partners/solargy-south-africa.jpg.asset.json";
import technoserv from "@/assets/partners/technoserv.jpg.asset.json";
import unionPowerEnergy from "@/assets/partners/union-power-energy.png.asset.json";
import deeLogo from "@/assets/accreditation/DEE_logo.png.asset.json";
import eazyEpc from "@/assets/accreditation/eazyEPC.png.asset.json";
import sanediLogo from "@/assets/accreditation/SANEDILogo.jpg.asset.json";

/**
 * Trust block shown directly under the homepage hero:
 * proof bar -> headline strip -> installation partner rail.
 * Brand colours are fixed by the brand guide (#231F20 / #FFCC03).
 */

const BRAND_INK = "#231F20";
const BRAND_YELLOW = "#FFCC03";

const proofStats = [
  { value: "200+", label: "Projects verified" },
  { value: "100+ MWp", label: "Installed capacity" },
  { value: "120,000+ tCO₂e", label: "Emission reductions verified" },
  { value: "2022–2024", label: "First verification period" },
];

/**
 * 12 installation-partner slots. Drop a logo file into /public/partner-logos/
 * and set `src` + `name`; empty slots render as a neutral placeholder.
 */
export interface PartnerLogoSlot {
  name?: string;
  src?: string;
}

const partnerLogos: PartnerLogoSlot[] = [
  { name: "Nuvo Energy", src: nuvoEnergy.url },
  { name: "GridVolt Solar & Electrical", src: gridvolt.url },
  { name: "AfriPower Solar & Beyond", src: afripower.url },
  { name: "Deo Solar", src: deoSolar.url },
  { name: "Infoled", src: infoled.url },
  { name: "PV Solutions", src: pvSolutions.url },
  { name: "miSolar Trading", src: misolar.url },
  { name: "Renen Energy", src: renenEnergy.url },
  { name: "SG Solar", src: sgSolar.url },
  { name: "AutoX", src: autox.url },
  { name: "Azoteq", src: azoteq.url },
  { name: "Greenway Solar", src: greenwaySolar.url },
];

/**
 * Second partner rail: nine newly uploaded logos plus three empty placeholders.
 */
const partnerLogosRow2: PartnerLogoSlot[] = [
  { name: "New Planet Energy", src: newPlanetEnergy.url },
  { name: "JC Energy Solutions", src: jcEnergy.url },
  { name: "Keiller Power Solutions", src: keillerPower.url },
  { name: "Broad Sky", src: broadSky.url },
  { name: "LoveSun", src: loveSun.url },
  { name: "Samekh Group", src: samekhGroup.url },
  { name: "Soco Energy", src: socoEnergy.url },
  { name: "Offrian Solutions", src: technoserv.url },
  { name: "Union Power Energy", src: unionPowerEnergy.url },
  { name: "IC Solar", src: icSolar.url },
  { name: "Solargy South Africa", src: solargy.url },
  { name: "Oryx Renewables", src: oryxRenewables.url },
];

function PartnerSlot({ slot, index }: { slot: PartnerLogoSlot; index: number }) {
  return (
    <div className="flex h-16 w-40 flex-shrink-0 items-center justify-center rounded-xl border border-border/60 bg-white px-4">
      {slot.src ? (
        <img
          src={slot.src}
          alt={slot.name ?? "Installation partner logo"}
          loading="lazy"
          className="max-h-10 max-w-full object-contain opacity-60 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
        />
      ) : (
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground/50">
          Logo {index + 1}
        </span>
      )}
    </div>
  );
}

export function VerificationTrustSection() {
  const reduced = useReducedMotion();
  const rail = [...partnerLogos, ...partnerLogos];

  return (
    <section aria-label="Verification and partners">
      {/* 1. Proof bar */}
      <div style={{ backgroundColor: BRAND_INK }} className="py-12 md:py-14">
        <div className="container mx-auto max-w-6xl px-4">
          <p
            className="mb-8 text-xs font-semibold uppercase tracking-[0.2em]"
            style={{ color: BRAND_YELLOW }}
          >
            Verified
          </p>

          <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {proofStats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd className="text-2xl font-bold leading-tight text-white md:text-3xl">
                  {stat.value}
                </dd>
                <p className="mt-2 text-sm text-white/60">{stat.label}</p>
              </div>
            ))}
          </dl>

          <p className="mt-10 text-sm text-white/50">
            Independently verified under the Verified Carbon Standard. Verra project VCS 4799.{" "}
            <a
              href="https://registry.verra.org/app/projectDetail/VCS/4799"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-4 hover:underline"
              style={{ color: BRAND_YELLOW }}
            >
              View on the Verra registry →
            </a>
          </p>
        </div>
      </div>

      {/* 2. Headline strip */}
      <div className="bg-white py-16 md:py-20">
        <div className="container mx-auto max-w-3xl px-4 text-center">
          <h2
            className="text-3xl font-bold lowercase leading-tight tracking-tight md:text-5xl"
            style={{ color: BRAND_INK }}
          >
            our first carbon credits have been issued.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            Crunch Carbon is the first platform to take South African solar owners all the way
            through Verra to issued carbon credits.
          </p>
        </div>
      </div>

      {/* 3. Industry and accreditation */}
      <div className="bg-white pb-16 md:pb-20">
        <div className="container mx-auto max-w-5xl px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-crunch-yellow">
            Backed by the industry
          </p>
          <h2 className="mt-3 text-3xl font-bold lowercase text-crunch-black md:text-4xl">
            we don&apos;t operate in isolation.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-muted-foreground md:text-lg">
            Carbon markets run on credibility. We work alongside the bodies and partners shaping
            South Africa&apos;s renewable energy sector — because a credit is only worth what the people
            behind it are worth.
          </p>

          <div className="mt-10 grid gap-6 text-left md:grid-cols-2">
            <article className="rounded-lg border border-border bg-card p-7">
              <div className="flex h-20 items-center justify-center border-b border-border pb-5 text-3xl font-bold text-crunch-black">
                AREP
              </div>
              <h3 className="mt-6 text-xl font-bold text-crunch-black">AREP</h3>
              <p className="mt-2 text-muted-foreground">
                Association of Renewable Energy Practitioners. Industry partner.
              </p>
            </article>

            <article className="rounded-lg border border-border bg-card p-7">
              <div className="flex h-20 items-center justify-center border-b border-border pb-5">
                <img src={eazyEpc.url} alt="eazyEPC" className="max-h-14 max-w-[240px] object-contain" />
              </div>
              <h3 className="mt-6 text-xl font-bold text-crunch-black">eazyEPC</h3>
              <p className="mt-2 text-muted-foreground">
                Industry partner. eazyEPC is Proudly Approved by the Department of Electricity &amp;
                Energy, in partnership with SANEDI.
              </p>
              <div className="mt-5 flex items-center gap-5 border-t border-border pt-5">
                <img src={deeLogo.url} alt="Department of Electricity and Energy" className="h-9 w-auto max-w-[48%] object-contain" />
                <img src={sanediLogo.url} alt="SANEDI" className="h-10 w-auto max-w-[48%] object-contain" />
              </div>
            </article>
          </div>
        </div>
      </div>

      {/* 4. Partner rail */}
      <div className="bg-white pb-16 md:pb-20">
        <div className="container mx-auto max-w-6xl px-4">
          <p
            className="mb-10 text-sm font-semibold uppercase tracking-[0.2em]"
            style={{ color: BRAND_YELLOW }}
          >
            PARTNERS
          </p>
          <h2 className="-mt-7 mb-10 text-3xl font-bold lowercase text-crunch-black md:text-4xl">
            backed by South Africa&apos;s solar installers.
          </h2>
        </div>

        <div className="space-y-4">
          {/* Row 1: scrolls left */}
          <div className="group relative overflow-x-auto md:overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="flex w-max gap-4 px-4 md:animate-partner-rail md:group-hover:[animation-play-state:paused]"
              style={reduced ? { animation: "none" } : undefined}
            >
              {rail.map((slot, i) => (
                <PartnerSlot key={i} slot={slot} index={i % partnerLogos.length} />
              ))}
            </div>
          </div>

          {/* Row 2: scrolls right (opposite direction) */}
          <div className="group relative overflow-x-auto md:overflow-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div
              className="flex w-max gap-4 px-4 md:animate-partner-rail-reverse md:group-hover:[animation-play-state:paused]"
              style={reduced ? { animation: "none" } : undefined}
            >
              {[...partnerLogosRow2, ...partnerLogosRow2].map((slot, i) => (
                <PartnerSlot key={i} slot={slot} index={i % partnerLogosRow2.length} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
