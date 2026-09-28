
import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Helmet } from "react-helmet-async";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { 
  Card,
  CardContent
} from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion } from "framer-motion";
import { Check, MapPin, Phone, Mail, Building } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  phoneNumber: z.string().optional(),
  email: z.string().email({ message: "Please enter a valid email address" }),
  company: z.string().optional(),
  subject: z.string().min(3, { message: "Subject must be at least 3 characters" }),
  question: z.string().min(10, { message: "Question must be at least 10 characters" })
});

const Contact = () => {
  const [submitted, setSubmitted] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      email: "",
      company: "",
      subject: "",
      question: ""
    }
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          name: values.name,
          email: values.email,
          subject: values.subject,
          question: values.question,
          phone: values.phoneNumber,
          company: values.company,
        }
      });

      if (error) {
        console.error('Error submitting contact form:', error);
        toast.error("Failed to send your message", {
          description: "Please try again or email us directly at info@crunchcarbon.com"
        });
        return;
      }

      console.log('Contact form submitted successfully:', data);
      setSubmitted(true);
      form.reset();
      toast.success("Your message has been sent!", {
        description: "We'll get back to you as soon as possible."
      });
    } catch (error) {
      console.error('Error submitting contact form:', error);
      toast.error("Failed to send your message", {
        description: "Please try again or email us directly at info@crunchcarbon.com"
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>Contact Crunch Carbon | Get In Touch</title>
        <meta name="description" content="Contact Crunch Carbon about carbon credits, solar monetisation, or partnership opportunities. We're here to help." />
        <link rel="canonical" href="https://crunchcarbon.com/contact" />
        <meta property="og:title" content="Contact Crunch Carbon | Get In Touch" />
        <meta property="og:description" content="Contact Crunch Carbon about carbon credits, solar monetisation, or partnership opportunities. We're here to help." />
        <meta property="og:url" content="https://crunchcarbon.com/contact" />
        <meta property="og:type" content="website" />
      </Helmet>
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-white to-crunch-yellow/5 py-20 md:py-28 overflow-hidden">
          <div className="container mx-auto px-4 max-w-6xl">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center max-w-4xl mx-auto"
            >
              <span className="inline-block px-4 py-2 bg-white/70 backdrop-blur-md rounded-full shadow-md border border-white/40 mb-6">
                <span className="text-sm font-medium text-crunch-black/70">Get In Touch</span>
              </span>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-crunch-black leading-tight tracking-tight mb-6">
                Contact <span className="text-crunch-yellow drop-shadow-sm">Crunch Carbon</span>
              </h1>
              
              <p className="text-xl text-crunch-black/80 mb-10">
                Contact us about anything related to our company or services.
                We'll do our best to get back to you as soon as possible.
              </p>
            </motion.div>
          </div>
        </section>
        
        {/* Contact Form Section */}
        <section className="py-20 bg-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-crunch-yellow/5 rounded-full -mr-48 -mt-48"></div>
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-crunch-yellow/10 rounded-full -ml-36 -mb-36"></div>
          
          <div className="container mx-auto px-4 max-w-6xl relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">
              {/* Contact Form */}
              <div className="lg:col-span-3">
                <Card className="overflow-hidden border-crunch-black/5 bg-white shadow-lg">
                  <CardContent className="p-8">
                    {submitted ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center py-12"
                      >
                        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
                          <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-2xl font-bold mb-4">Thank You!</h3>
                        <p className="text-crunch-black/70 mb-8">
                          Your message has been received. We'll get back to you shortly.
                        </p>
                        <Button 
                          onClick={() => setSubmitted(false)}
                          className="bg-crunch-yellow text-crunch-black"
                        >
                          Send Another Message
                        </Button>
                      </motion.div>
                    ) : (
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Name *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Your name" {...field} className="retro-input" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <div>
                              <Label htmlFor="phoneNumber">Phone Number</Label>
                              <div className="flex">
                                <div className="flex items-center bg-gray-50 border border-r-0 rounded-l-md border-input px-3">
                                  <span className="text-sm text-crunch-black/70">+27</span>
                                </div>
                                <Input 
                                  id="phoneNumber" 
                                  placeholder="Phone number (optional)" 
                                  className="retro-input rounded-l-none" 
                                  {...form.register("phoneNumber")}
                                />
                              </div>
                            </div>
                            
                            <FormField
                              control={form.control}
                              name="email"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Email *</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Your email address" {...field} className="retro-input" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="company"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Company</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Your company (optional)" {...field} className="retro-input" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={form.control}
                            name="subject"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Subject *</FormLabel>
                                <FormControl>
                                  <Input placeholder="What is this regarding?" {...field} className="retro-input" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name="question"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Question *</FormLabel>
                                <FormControl>
                                  <Textarea 
                                    placeholder="How can we help you?" 
                                    className="retro-input min-h-[120px]" 
                                    {...field} 
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="pt-4">
                            <Button 
                              type="submit" 
                              className="w-full md:w-auto bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black rounded-full px-8 py-6 h-auto font-medium"
                            >
                              Send Message
                            </Button>
                          </div>
                        </form>
                      </Form>
                    )}
                  </CardContent>
                </Card>
              </div>
              
              {/* Contact Info */}
              <div className="lg:col-span-2">
                <div className="bg-crunch-black/5 backdrop-blur-sm rounded-xl p-8 h-full">
                  <h2 className="text-2xl font-bold mb-6 text-crunch-black">Contact Information</h2>
                  
                  <div className="space-y-8">
                    <div className="flex items-start space-x-4">
                      <div className="bg-white p-3 rounded-full shadow-sm">
                        <Building className="w-5 h-5 text-crunch-yellow" />
                      </div>
                      <div>
                        <p className="font-medium text-crunch-black">Crunch Carbon (Pty) Ltd</p>
                        <p className="text-crunch-black/70 mt-1">Registered company</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-white p-3 rounded-full shadow-sm">
                        <MapPin className="w-5 h-5 text-crunch-yellow" />
                      </div>
                      <div>
                        <p className="font-medium text-crunch-black">4 Sandown Valley Crescent</p>
                        <p className="text-crunch-black/70 mt-1">Sandton, Johannesburg</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-white p-3 rounded-full shadow-sm">
                        <Mail className="w-5 h-5 text-crunch-yellow" />
                      </div>
                      <div>
                        <p className="font-medium text-crunch-black">info@crunchcarbon.com</p>
                        <p className="text-crunch-black/70 mt-1">Email us anytime</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-4">
                      <div className="bg-white p-3 rounded-full shadow-sm">
                        <Phone className="w-5 h-5 text-crunch-yellow" />
                      </div>
                      <div>
                        <p className="font-medium text-crunch-black">Business Hours</p>
                        <p className="text-crunch-black/70 mt-1">Monday-Friday: 8am to 5pm</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-12 pt-8 border-t border-crunch-black/10">
                    <p className="text-crunch-black font-medium mb-4">Connect with us</p>
                    <div className="flex items-center space-x-4">
                      <a 
                        href="https://www.linkedin.com/company/crunch-carbon/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-white p-2 rounded-full shadow-sm hover:bg-crunch-yellow/10 transition-colors"
                        aria-label="LinkedIn"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                          <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                          <rect width="4" height="12" x="2" y="9"></rect>
                          <circle cx="4" cy="4" r="2"></circle>
                        </svg>
                      </a>
                      <a 
                        href="https://www.instagram.com/crunch_carbon/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="bg-white p-2 rounded-full shadow-sm hover:bg-crunch-yellow/10 transition-colors"
                        aria-label="Instagram"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                          <rect width="20" height="20" x="2" y="2" rx="5" ry="5"></rect>
                          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                          <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"></line>
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
};

export default Contact;
