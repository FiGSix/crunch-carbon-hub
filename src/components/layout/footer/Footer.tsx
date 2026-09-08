
import { cn } from '@/lib/utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { SocialLinks } from './SocialLinks';
import { FooterNav } from './FooterNav';
import { LegalLinks } from './LegalLinks';

export function Footer({ className }: { className?: string }) {
  const navigate = useNavigate();
  
  return (
    <footer className={cn("bg-white border-t border-crunch-black/5 pt-16 pb-10", className)}>
      <div className="container-responsive">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-12">
          <div className="md:col-span-4">
            <div className="mb-4">
              <OptimizedImage 
                src="/lovable-uploads/c818a4d4-97db-4b88-bd74-801376152ebc.png"
                alt="CrunchCarbon Logo"
                className="h-12"
                width={141}
                height={48}
                priority={false}
                sizes="141px"
              />
            </div>
            <p className="text-crunch-black/70 mb-6 max-w-md">
              Turn your renewable energy into a powerful income stream with verified carbon credits. Simple, transparent, and effective.
            </p>
            <SocialLinks />
          </div>
          
          <FooterNav />
          
          <div className="md:col-span-4">
            <h3 className="font-bold text-lg mb-4 text-crunch-black">Get Started Today</h3>
            <p className="text-crunch-black/70 mb-4">
              Join 600+ South African solar owners turning generation into verified carbon revenue.
            </p>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button 
                onClick={() => navigate("/register")}
                className="bg-crunch-yellow hover:bg-crunch-yellow/90 text-crunch-black w-full md:w-auto group"
              >
                Sign Up Now <ArrowRight className="ml-1 group-hover:translate-x-1 transition-transform" />
              </Button>
            </motion.div>
          </div>
        </div>
        
        <div className="border-t border-crunch-black/10 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-crunch-black/60 mb-4 md:mb-0">
            © {new Date().getFullYear()} CrunchCarbon. All rights reserved.
          </p>
          <LegalLinks />
        </div>
      </div>
    </footer>
  );
}
