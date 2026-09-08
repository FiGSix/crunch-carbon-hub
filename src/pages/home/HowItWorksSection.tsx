
import { motion } from "framer-motion";
import { FileText, Clock, CalendarCheck, Globe } from "lucide-react";

export const HowItWorksSection = () => {
  return <section className="py-20" id="how-it-works">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.div initial={{
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-crunch-black">Turn your energy — or your clients&apos; — into income.</h2>
            <p className="text-xl text-crunch-black/70 max-w-3xl mx-auto">Our platform automates everything, so you can sit back and watch your green energy create green Rands.</p>
          </motion.div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard 
            icon={<FileText className="h-8 w-8 text-crunch-black" />} 
            title="Tailored Carbon Proposals" 
            description="Custom carbon credit proposals designed specifically for your business needs and industry." 
            delay={0.1} 
          />
          
          <FeatureCard 
            icon={<Clock className="h-8 w-8 text-crunch-black" />} 
            title="Quick & Efficient" 
            description="Generate comprehensive proposals in minutes, not weeks, with our streamlined process." 
            delay={0.2} 
          />
          
          <FeatureCard 
            icon={<CalendarCheck className="h-8 w-8 text-crunch-black" />} 
            title="Annual Payouts" 
            description="Receive annual payments directly to your bank account. No hassle, no complicated paperwork, just income." 
            delay={0.3} 
          />
          
          <FeatureCard 
            icon={<Globe className="h-8 w-8 text-crunch-black" />} 
            title="Local Impact" 
            description="Join 600+ South African businesses and homeowners making a measurable environmental impact." 
            delay={0.4} 
          />
        </div>
      </div>
    </section>;
};

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}

const FeatureCard = ({
  icon,
  title,
  description,
  delay
}: FeatureCardProps) => {
  return <motion.div className="group" initial={{
    opacity: 0,
    y: 20
  }} whileInView={{
    opacity: 1,
    y: 0
  }} viewport={{
    once: true
  }} transition={{
    duration: 0.5,
    delay
  }} whileHover={{
    y: -5
  }}>
      <div className="bg-white p-8 rounded-lg shadow-md border border-crunch-black/10 h-full transition-all group-hover:shadow-lg">
        <motion.div 
          className="mb-6 inline-block rounded-full bg-crunch-yellow p-4"
          whileHover={{ 
            scale: 1.1,
            transition: { type: "spring", stiffness: 400, damping: 10 }
          }}
        >
          {icon}
        </motion.div>
        <h3 className="text-xl font-bold mb-4 text-crunch-black">
          {title}
        </h3>
        <p className="text-crunch-black/70">
          {description}
        </p>
      </div>
    </motion.div>;
};
