
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";

const About = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>About Crunch Carbon | Verra VCS Certified Solar Income</title>
        <meta name="description" content="Crunch Carbon is Verra VCS certified. We help South African homeowners and businesses earn money from solar panels through verified carbon credits. Meet our team and learn how we turn clean energy into cash." />
        <link rel="canonical" href="https://crunchcarbon.com/about" />
        <meta property="og:title" content="About Crunch Carbon | Verra VCS Certified Solar Income" />
        <meta property="og:description" content="Crunch Carbon is Verra VCS certified. We help South African homeowners and businesses earn money from solar panels through verified carbon credits." />
        <meta property="og:url" content="https://crunchcarbon.com/about" />
        <meta property="og:type" content="website" />
      </Helmet>
      <Header />
      
      <main className="flex-1">
        <AboutHero />
        <MissionSection />
        <ValuesSection />
        <TeamSection />
        <CTASection />
      </main>
      
      <Footer />
    </div>
  );
};

const AboutHero = () => {
  return (
    <section className="bg-gradient-to-br from-white to-crunch-yellow/5 py-20 md:py-28 overflow-hidden">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-4xl mx-auto"
        >
          <span className="inline-block px-4 py-2 bg-white/70 backdrop-blur-md rounded-full shadow-md border border-white/40 shadow-black/30 mb-6">
            <span className="text-sm font-medium text-crunch-black/70">Our Journey So Far</span>
          </span>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-crunch-black leading-tight tracking-tight mb-6">
            About <span className="text-crunch-yellow drop-shadow-sm">Crunch Carbon</span>
          </h1>
          
          <p className="text-xl text-crunch-black/80 mb-10">
            We empower individuals and organisations to optimise their renewable programmes to mitigate climate change and make a tangible difference while increasing profits.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

const MissionSection = () => {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="order-2 md:order-1"
          >
            <div className="meta-card p-8 rounded-3xl">
              <h2 className="text-3xl font-bold mb-6 text-crunch-black">Our Mission</h2>
              <p className="text-lg mb-6 text-crunch-black/70">
                We are recognised in the field of carbon emissions management, and adhere to industry principles and standards. We, furthermore, have a team of experts and specialist associates that brings together a diverse range of experience and skills, united by a passion for sustainability and a commitment to excellence.
              </p>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="order-1 md:order-2"
          >
            <div className="relative">
              <div className="absolute -z-10 -right-4 -bottom-4 w-full h-full rounded-3xl bg-gradient-to-br from-crunch-yellow/20 to-crunch-yellow/5"></div>
              <div className="meta-card p-1 rounded-3xl overflow-hidden">
                <img 
                  src="/lovable-uploads/cb0836fd-ceac-48eb-9df7-ecec92541456.png" 
                  alt="Renewable Energy" 
                  className="w-full h-auto rounded-2xl object-cover transition-all hover:scale-105 duration-500"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const ValuesSection = () => {
  return (
    <section className="py-20 bg-gradient-to-br from-crunch-yellow/5 to-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-crunch-black">Our Values</h2>
          <p className="text-xl text-crunch-black/70 max-w-3xl mx-auto">
            With a focus on transparency, integrity, and forward-thinking solutions, we are positioned at the forefront of driving positive environmental change.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ValueCard 
            title="Transparency" 
            description="We believe in complete openness about our processes, methodologies, and results. Our clients always know exactly what they're getting."
            delay={0.1}
          />
          
          <ValueCard 
            title="Integrity" 
            description="We uphold the highest ethical standards in all our operations, ensuring that our work contributes positively to both our clients and the planet."
            delay={0.2}
          />
          
          <ValueCard 
            title="Innovation" 
            description="We constantly seek forward-thinking solutions to complex environmental challenges, pushing the boundaries of what's possible in carbon management."
            delay={0.3}
          />
        </div>
      </div>
    </section>
  );
};

interface ValueCardProps {
  title: string;
  description: string;
  delay: number;
}

const ValueCard = ({ title, description, delay }: ValueCardProps) => {
  return (
    <motion.div 
      className="group"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5 }}
    >
      <div className="bg-white/80 backdrop-blur-md p-8 rounded-2xl shadow-md border border-crunch-black/5 h-full transition-all group-hover:shadow-lg">
        <h3 className="text-xl font-bold mb-4 text-crunch-black">
          {title}
        </h3>
        <p className="text-crunch-black/70">
          {description}
        </p>
      </div>
    </motion.div>
  );
};

const TeamSection = () => {
  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-crunch-black">Meet The Team</h2>
          <p className="text-xl text-crunch-black/70 max-w-3xl mx-auto">
            Our team brings together diverse experience and skills, united by a passion for sustainability and excellence.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <TeamMember 
            name="Shaun Slabber" 
            role="Chief Executive Officer"
            bio="Shaun Slabber, CEO and Co-founder of Crunch Carbon, is a seasoned entrepreneur with a strong track record in renewable energy and business development. He co-founded multiple ventures, with experience across renewables, construction and technology."
            delay={0.1}
          />
          
          <TeamMember 
            name="Johanita Burger" 
            role="Chief Operating Officer"
            bio="Johanita Burger, COO and Co-founder of Crunch Carbon, is a powerhouse in operational leadership that drives business transformation. She brings over a decade of expertise in scaling operations, strategic execution, and building high-performance teams."
            delay={0.2}
          />
          
          <TeamMember 
            name="Dr. Marco Lotz" 
            role="Chief Sustainability Officer"
            bio="Co-founder Dr. Marco Lotz is an expert in sustainability with a PhD focused on greenhouse gas reduction. Formerly Nedbank's Carbon Specialist, he has over a decade of hands-on experience leading carbon projects across industries."
            delay={0.3}
          />
          
          <TeamMember 
            name="Jandre van der Westhuizen" 
            role="Chief Technology Officer"
            bio="Jandré van der Westhuizen, CTO & Chaos Whisperer is the brilliant mind behind our innovative technology strategies and the driving force of our mission to 'disrupt for good.' With a knack for turning chaos into sustainable order."
            delay={0.4}
          />
          
          <TeamMember 
            name="Kelly Dobrowsky" 
            role="Chief Marketing Officer"
            bio="Kelly Dobrowsky, CMO and resident digital marketing fundi! With an Honours degree in Business Management and a knack for digital wizardry, Kelly brings creativity, energy, and a touch of sparkle to everything she does."
            delay={0.5}
          />
        </div>
      </div>
    </section>
  );
};

interface TeamMemberProps {
  name: string;
  role: string;
  bio: string;
  delay: number;
}

const TeamMember = ({ name, role, bio, delay }: TeamMemberProps) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
    >
      <div className="bg-white p-6 rounded-2xl shadow-md border border-crunch-black/10 h-full transition-all hover:shadow-lg group">
        <div className="mb-4 h-48 rounded-xl bg-gradient-to-br from-crunch-yellow/20 to-crunch-yellow/5 flex items-center justify-center overflow-hidden">
          <div className="text-4xl font-bold text-crunch-black/20">
            {name.split(' ').map(part => part[0]).join('')}
          </div>
        </div>
        <h3 className="text-xl font-bold mb-1 text-crunch-black group-hover:text-crunch-yellow transition-colors">
          {name}
        </h3>
        <p className="text-sm text-crunch-black/60 mb-4">{role}</p>
        <p className="text-crunch-black/70 text-sm">
          {bio}
        </p>
      </div>
    </motion.div>
  );
};

const CTASection = () => {
  const navigate = useNavigate();
  
  return (
    <section className="py-20 bg-gradient-to-br from-crunch-yellow/20 to-crunch-yellow/5">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-crunch-black">
            Ready to Make a Change?
          </h2>
          <p className="text-xl text-crunch-black/80 mb-10 max-w-2xl mx-auto">
            Whether you're looking to reduce your carbon footprint, navigate carbon markets, or achieve carbon neutrality, Crunch Carbon can assist and enable you each step of the way.
          </p>
          
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-block"
          >
            <Button 
              onClick={() => navigate("/register")}
              className="bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black px-8 py-6 text-lg rounded-xl group"
              size="lg"
            >
              Start Your Journey <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

export default About;
