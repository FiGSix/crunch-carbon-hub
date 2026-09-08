import dyness from "@/assets/equipment/dyness.svg.asset.json";
import enphase from "@/assets/equipment/enphase.png.asset.json";
import freedomWon from "@/assets/equipment/freedom-won.png.asset.json";
import fronius from "@/assets/equipment/fronius.png.asset.json";
import givenergy from "@/assets/equipment/givenergy.webp.asset.json";
import goodwe from "@/assets/equipment/goodwe.svg.asset.json";
import greenrich from "@/assets/equipment/greenrich.png.asset.json";
import growatt from "@/assets/equipment/growatt.png.asset.json";

const equipmentBrands = [
  { name: "Dyness", src: dyness.url },
  { name: "Enphase", src: enphase.url },
  { name: "Freedom Won", src: freedomWon.url },
  { name: "Fronius", src: fronius.url },
  { name: "GivEnergy", src: givenergy.url },
  { name: "GoodWe", src: goodwe.url },
  { name: "Greenrich", src: greenrich.url },
  { name: "Growatt", src: growatt.url },
];

export const SocialProofSection = () => {
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
            Crunch Carbon integrates with leading inverter and battery brands to
            verify your generation data automatically — no extra hardware
            required.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 items-center gap-x-10 gap-y-8 sm:grid-cols-3 md:grid-cols-4">
          {equipmentBrands.map((brand) => (
            <div key={brand.name} className="flex items-center justify-center">
              <img
                src={brand.src}
                alt={`${brand.name} logo`}
                loading="lazy"
                className="h-10 w-auto max-w-[140px] object-contain opacity-40 grayscale transition duration-300 hover:opacity-100 hover:grayscale-0"
              />
            </div>
          ))}
        </div>

        <p className="mx-auto mt-10 max-w-xl text-center text-sm text-muted-foreground">
          Don't see your brand? We add new integrations regularly — your
          installer can confirm compatibility when you register.
        </p>
      </div>
    </section>
  );
};
