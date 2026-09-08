import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
export const CTASection = () => {
  const navigate = useNavigate();
  return <section className="py-20">
      <div className="container mx-auto px-4">
        <motion.div className="meta-card rounded-3xl p-8 md:p-12 relative overflow-hidden" initial={{
        opacity: 0,
        y: 20
      }} whileInView={{
        opacity: 1,
        y: 0
      }} viewport={{
        once: true
      }} transition={{
        duration: 0.5
      }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-crunch-yellow/20 rounded-full -mr-32 -mt-32 z-0"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-crunch-yellow/10 rounded-full -ml-48 -mb-48 z-0"></div>
          
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-crunch-black">
              Start Earning From Your Solar System Today
            </h2>
            <p className="text-xl text-crunch-black/80 mb-8">Join 600+ South African solar owners on the platform — with 230+ projects already through verification.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <motion.div whileHover={{
              scale: 1.02
            }} whileTap={{
              scale: 0.98
            }}>
                <Button onClick={() => navigate("/register")} className="bg-crunch-black hover:bg-crunch-black/90 text-white text-lg py-6 px-8 w-full sm:w-auto rounded-2xl shadow-sm hover:shadow-lg group transition-all duration-300" size="lg">
                  <span>Start Earning Now</span>
                  <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </motion.div>
              <motion.div whileHover={{
              scale: 1.02
            }} whileTap={{
              scale: 0.98
            }}>
                <Button variant="glass" onClick={() => navigate("/calculator")} className="text-crunch-black text-lg py-6 px-8 w-full sm:w-auto rounded-2xl transition-all duration-300" size="lg">
                  Calculate Your Earnings
                </Button>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>;
};