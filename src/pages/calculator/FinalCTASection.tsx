import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

interface FinalCTASectionProps {
  navigate: (path: string) => void;
}

export const FinalCTASection = ({ navigate }: FinalCTASectionProps) => {
  const handleClick = () => {
    const referralCode = localStorage.getItem("referralCode");
    const path = referralCode ? `/register?ref=${referralCode}` : "/register";
    navigate(path);
  };

  return (
    <section className="py-16 bg-gradient-to-br from-crunch-yellow/20 to-crunch-yellow/5">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-crunch-black">
            Ready to Turn Sunshine Into Income?
          </h2>
          <p className="text-lg text-crunch-black/80 mb-8 max-w-2xl mx-auto">
            Start with the calculator above, or register now to manage your proposal, sign your agreement, and track your earnings.
          </p>

          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-block"
          >
            <Button
              onClick={handleClick}
              className="bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black px-8 py-6 text-lg rounded-xl group min-h-[44px]"
              size="lg"
            >
              Get Started Now
              <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};
