import { motion } from "framer-motion";
import { Calculator, FileText, Signature, ClipboardCheck } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Calculator,
    title: "Discover the possibility",
    description:
      "Enter your system size, province, and commissioning date. We'll show your estimated carbon credit income instantly.",
  },
  {
    number: "02",
    icon: FileText,
    title: "Make your proposal",
    description:
      "Share your email to unlock the full 2025–2030 forecast and generate your personalised Crunch Carbon proposal.",
  },
  {
    number: "03",
    icon: Signature,
    title: "Sign your agreement",
    description:
      "Review and digitally sign your cession agreement. No printing, no scanning — just a secure drawn signature.",
  },
  {
    number: "04",
    icon: ClipboardCheck,
    title: "Onboard your system",
    description:
      "Submit site details, inverter data, documents, and read-only portal access. Once audit-ready, your credits start earning.",
  },
];

export const HowItWorksSection = () => {
  return (
    <section className="py-16 bg-gradient-to-br from-crunch-yellow/5 to-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold text-crunch-black mb-4">
            From estimate to income in four steps
          </h2>
          <p className="text-lg text-crunch-black/70 max-w-2xl mx-auto">
            We handle the carbon credit registration, verification, and buyer relationships — you collect the revenue.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="bg-white border border-crunch-black/5 rounded-xl p-6 hover:shadow-md transition-shadow relative"
            >
              <span className="absolute top-4 right-4 text-2xl font-bold text-crunch-yellow/30">
                {step.number}
              </span>
              <div className="p-3 bg-crunch-yellow/10 rounded-xl w-fit mb-4">
                <step.icon className="h-6 w-6 text-crunch-yellow" />
              </div>
              <h3 className="text-lg font-bold text-crunch-black mb-2">{step.title}</h3>
              <p className="text-sm text-crunch-black/60 leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
