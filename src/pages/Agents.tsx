import { useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ArrowRight, Briefcase, CheckCircle2, DollarSign, Handshake, Rocket, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";

const Agents = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Capture referral code from URL
  useEffect(() => {
    const referralCode = searchParams.get('ref');
    if (referralCode) {
      // Store in localStorage for later use during agent registration
      localStorage.setItem('agent_referral_code', referralCode);
      console.log('Agent referral code captured:', referralCode);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Partner With Crunch Carbon | Agent Program</title>
        <meta name="description" content="Join the Crunch Carbon agent program. Earn commissions by helping clients monetise their solar systems with verified carbon credits." />
        <link rel="canonical" href="https://crunchcarbon.com/agents" />
        <meta property="og:title" content="Partner With Crunch Carbon | Agent Program" />
        <meta property="og:description" content="Join the Crunch Carbon agent program. Earn commissions by helping clients monetise their solar systems with verified carbon credits." />
        <meta property="og:url" content="https://crunchcarbon.com/agents" />
        <meta property="og:type" content="website" />
      </Helmet>
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-white to-crunch-yellow/5 py-16 md:py-24">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8"
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="inline-block px-4 py-2 bg-white/60 backdrop-blur-md rounded-full shadow-md border border-white/40 shadow-black/20"
                >
                  <span className="text-sm font-medium text-crunch-black/70">Industry Partner Program</span>
                </motion.div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-crunch-black leading-tight tracking-tight">
                  <span className="text-crunch-black">Partner With </span> 
                  <span className="text-crunch-yellow drop-shadow-sm">Crunch Carbon</span>
                  <span className="block text-xl md:text-2xl font-medium text-crunch-black/70 mt-3">
                    Earn Commissions From Verified Solar Carbon Credits
                  </span>
                </h1>
                
                <p className="text-xl font-bold text-crunch-black max-w-xl">
                  Turn Every Solar System You Touch Into a Revenue Opportunity
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={() => navigate("/register")}
                      className="bg-crunch-yellow text-crunch-black hover:bg-crunch-yellow/90 text-lg py-6 px-8 w-full sm:w-auto rounded-2xl shadow-sm hover:shadow-lg group transition-all duration-300"
                      size="lg"
                    >
                      <span>Become an Agent</span>
                      <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="glass"
                      onClick={() => navigate("/calculator")} 
                      className="text-crunch-black text-lg py-6 px-8 w-full sm:w-auto rounded-2xl transition-all duration-300"
                      size="lg"
                    >
                      Calculate Commission Potential
                    </Button>
                  </motion.div>
                </div>
                
                <div className="flex items-center text-crunch-black/70 pt-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                  <span className="text-sm">Partner setup in under 15 minutes. Start earning commissions immediately.</span>
                </div>
              </motion.div>
              
              <motion.div
                className="hidden lg:block relative"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <div className="relative">
                  <div className="absolute -z-10 -right-4 -bottom-4 w-full h-full rounded-3xl bg-gradient-to-br from-crunch-yellow/30 to-crunch-yellow/10"></div>
                  <div className="meta-card rounded-3xl p-6">
                    <div className="bg-gradient-to-br from-white to-crunch-yellow/10 p-8 rounded-2xl border border-white/40 shadow-lg">
                      <div className="flex items-start mb-6">
                        <Handshake className="w-12 h-12 text-crunch-yellow mr-4" />
                        <h2 className="text-2xl font-bold text-crunch-black">Why Industry Partners Choose Crunch Carbon</h2>
                      </div>
                      <p className="text-crunch-black/80 mb-6">
                        As an EPC, O&M provider, solar installer, ESG consultant, or electrician, you're already helping clients move toward a cleaner energy future. But what if you could go one step further — and help them earn money for going green?
                      </p>
                      <p className="text-crunch-black font-medium">
                        With Crunch Carbon, you can.
                      </p>
                    </div>
                  </div>
                  
                  {/* Floating elements */}
                  <motion.div
                    className="absolute -top-10 -left-10 meta-card p-3 rounded-2xl flex items-center gap-2"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  >
                    <DollarSign className="text-green-500 h-6 w-6" />
                    <span className="font-medium text-crunch-black">Earn Commissions</span>
                  </motion.div>
                  <motion.div
                    className="absolute -bottom-5 -left-20 meta-card p-3 rounded-2xl flex items-center gap-2"
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 5, ease: "easeInOut", delay: 1 }}
                  >
                    <Rocket className="text-crunch-yellow h-6 w-6" />
                    <span className="font-medium text-crunch-black">Grow Your Business</span>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Who Can Partner Section */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-crunch-black mb-4">
                Who Can Partner With Us?
              </h2>
              <p className="text-xl text-crunch-black/70 max-w-3xl mx-auto">
                If your work involves commercial, industrial, or agricultural solar systems, then you're perfectly positioned to help your clients unlock even more value.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {partnerTypes.map((partner, index) => (
                <motion.div
                  key={partner.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                >
                  <Card className="h-full hover-card" interactive>
                    <CardContent className="p-6">
                      <div className="bg-crunch-yellow/10 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                        <Briefcase className="w-8 h-8 text-crunch-yellow" />
                      </div>
                      <h3 className="text-xl font-bold text-crunch-black mb-2">{partner.title}</h3>
                      <p className="text-crunch-black/70">{partner.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Become an Agent Section */}
        <section className="py-16 md:py-20 bg-crunch-black/5">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-14"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-crunch-black mb-4">
                Why Become an Agent?
              </h2>
              <p className="text-xl text-crunch-black/70 max-w-3xl mx-auto">
                Join our partner network and create new revenue streams while helping your clients monetize their green energy.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="bg-white rounded-2xl p-6 meta-card"
                >
                  <div className="flex items-start mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="text-xl font-bold text-crunch-black mb-2">{benefit.title}</h3>
                      <p className="text-crunch-black/70">{benefit.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Getting Started Section */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4 max-w-6xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="relative">
                  <div className="absolute -z-10 -left-4 -bottom-4 w-full h-full rounded-3xl bg-gradient-to-br from-crunch-yellow/30 to-crunch-yellow/10"></div>
                  <div className="meta-card rounded-3xl overflow-hidden">
                    <div className="bg-gradient-to-br from-white to-crunch-yellow/5 p-8 rounded-2xl border border-white/40 shadow-md">
                      <h2 className="text-3xl font-bold text-crunch-black mb-6 flex items-center">
                        <Rocket className="w-8 h-8 text-crunch-yellow mr-3" />
                        Getting Started is Easy
                      </h2>
                      <p className="text-crunch-black/80 mb-6">
                        We'll equip you with all the tools and support you need to introduce Crunch Carbon to your network — from explainer docs and co-branded presentations to training and onboarding support.
                      </p>
                      <p className="text-crunch-black font-medium mb-6">
                        You stay focused on what you do best, while we handle the carbon credit side.
                      </p>
                      <div className="bg-white/50 backdrop-blur-sm rounded-xl p-4 border border-white/40">
                        <h3 className="text-xl font-bold text-crunch-black mb-2 flex items-center">
                          <Users className="w-5 h-5 text-crunch-yellow mr-2" />
                          Let's Grow Together
                        </h3>
                        <p className="text-crunch-black/80">
                          Our Agent Program is built on mutual success. You help your clients unlock more value from their solar systems — and get rewarded for it.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="space-y-8"
              >
                <h2 className="text-3xl md:text-4xl font-bold text-crunch-black">
                  Want to offer more. Earn more. And do more for the planet?
                </h2>
                <p className="text-xl text-crunch-black/80">
                  Partner with Crunch Carbon today and start generating additional revenue while helping your clients maximise their renewable energy investments.
                </p>
                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={step} className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-crunch-yellow flex items-center justify-center text-crunch-black font-medium mr-3 flex-shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-crunch-black/80">{step}</p>
                    </div>
                  ))}
                </div>
                <div className="pt-4">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      onClick={() => navigate("/register")}
                      className="bg-crunch-yellow text-crunch-black hover:bg-crunch-yellow/90 text-lg py-6 px-8 w-full sm:w-auto rounded-2xl shadow-sm hover:shadow-lg group transition-all duration-300"
                      size="lg"
                    >
                      <span>Become an Agent Today</span>
                      <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <motion.div 
              className="meta-card rounded-3xl p-8 md:p-12 relative overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-crunch-yellow/20 rounded-full -mr-32 -mt-32 z-0"></div>
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-crunch-yellow/10 rounded-full -ml-48 -mb-48 z-0"></div>
              
              <div className="relative z-10 max-w-3xl mx-auto text-center">
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-crunch-black">
                  Ready to Partner With Crunch Carbon?
                </h2>
                <p className="text-xl text-crunch-black/80 mb-8">
                  Join our network of industry professionals who are helping clients earn more from their renewable energy systems.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      onClick={() => navigate("/register")}
                      className="bg-crunch-black hover:bg-crunch-black/90 text-white text-lg py-6 px-8 w-full sm:w-auto rounded-2xl shadow-sm hover:shadow-lg group transition-all duration-300"
                      size="lg"
                    >
                      <span>Apply to Become an Agent</span>
                      <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button 
                      variant="glass" 
                      onClick={() => navigate("/contact")}
                      className="text-crunch-black text-lg py-6 px-8 w-full sm:w-auto rounded-2xl transition-all duration-300"
                      size="lg"
                    >
                      Contact Our Partner Team
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

// Partner types data
const partnerTypes = [
  {
    title: "EPCs & Solar Installers",
    description: "Add carbon monetization to your installation package and create ongoing revenue from your existing clients."
  },
  {
    title: "O&M Providers",
    description: "Expand your maintenance offering with carbon credits that generate passive income for your clients."
  },
  {
    title: "Electricians & Contractors",
    description: "Introduce carbon monetization as a value-added service when working with commercial solar clients."
  },
  {
    title: "ESG & Sustainability Consultants",
    description: "Offer concrete financial benefits to clients implementing renewable energy solutions."
  },
  {
    title: "Energy Auditors",
    description: "Add carbon credit monetization to your energy optimization recommendations."
  },
  {
    title: "Green Building Specialists",
    description: "Enhance your green building proposals with ongoing carbon credit revenue streams."
  },
];

// Benefits data
const benefits = [
  {
    title: "Add Value to Your Offering",
    description: "Carbon credits are the natural next step for clients who've invested in solar. Help them earn more from the systems you build or manage."
  },
  {
    title: "Create a Passive Revenue Stream",
    description: "For every successful sign-up, you'll earn a share of the proceeds. That's ongoing income from systems you've already worked on."
  },
  {
    title: "Strengthen Client Relationships",
    description: "You become a trusted advisor by introducing them to a high-value, verified revenue opportunity they likely didn't know existed."
  },
  {
    title: "Stand Out in a Competitive Market",
    description: "Offering carbon credit monetization sets you apart from competitors and positions your business as future-ready and ESG-aligned."
  },
  {
    title: "Partner With a Trusted Brand",
    description: "Crunch Carbon is fully registered with Verra's VCS and affiliated with the CDSA — so you know you're connecting your clients with a credible, verified platform."
  },
];

// Steps data
const steps = [
  "Complete our simple agent application",
  "Receive your partner welcome kit and training",
  "Start introducing Crunch Carbon to your clients",
  "Earn commissions on successful sign-ups",
];

export default Agents;
