import { motion } from "framer-motion";

export const HeroSection = () => {
  return (
    <section className="bg-gradient-to-br from-white to-crunch-yellow/5 py-16 md:py-24 overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto"
        >
          <span className="inline-block px-4 py-2 bg-white/70 backdrop-blur-md rounded-full shadow-sm border border-crunch-black/10 mb-6">
            <span className="text-sm font-medium text-crunch-black/70">Interactive Estimator</span>
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-crunch-black leading-tight tracking-tight mb-6">
            Your solar.{" "}
            <span className="text-crunch-yellow drop-shadow-sm">A little more possibility.</span>
          </h1>

          <p className="text-lg md:text-xl text-crunch-black/80 mb-8">
            Discover how much your solar installation could earn in carbon credits —
            then turn that estimate into a signed proposal in minutes.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-crunch-black/60">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-crunch-yellow" />
              Free
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-crunch-yellow" />
              Takes 30 seconds
            </span>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-crunch-yellow" />
              No signup required
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
