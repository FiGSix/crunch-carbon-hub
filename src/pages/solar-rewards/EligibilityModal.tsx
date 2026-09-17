import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import { CheckCircle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import confetti from 'canvas-confetti';

interface EligibilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onQualified: () => void;
}

export function EligibilityModal({ open, onOpenChange, onQualified }: EligibilityModalProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [showCongrats, setShowCongrats] = useState(false);
  const [showDetailsForm, setShowDetailsForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    address: "",
    systemSize: "",
    commissioningDate: ""
  });

  const questions = [
    {
      question: "The project is located in South Africa?",
      correctAnswer: true
    },
    {
      question: "Are you registered for any other Greenhouse Gas Emissions program?",
      correctAnswer: false
    },
    {
      question: "Is the system smaller than 50 kWp?",
      correctAnswer: true
    },
    {
      question: "Was it commissioned or switched on for the first time on or after September 15, 2022?",
      correctAnswer: true
    },
    {
      question: "Are you the legal ownership of system or green attributes?",
      correctAnswer: true
    },
    {
      question: "Are you participating in any South African Government Funding Initiatives?",
      correctAnswer: false
    }
  ];

  const handleAnswer = (answer: boolean) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (step < questions.length - 1) {
      setStep(step + 1);
    } else {
      // Last question - check results and move past questions
      setStep(step + 1);
      const allCorrect = newAnswers.every((ans, idx) => ans === questions[idx].correctAnswer);
      if (allCorrect) {
        setShowCongrats(true);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("send-eligibility-proposal", {
        body: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          address: formData.address,
          systemSizeKwp: parseFloat(formData.systemSize),
          commissioningDate: formData.commissioningDate,
          eligibilityAnswers: answers
        }
      });
      
      if (error) throw error;

      if ((data as any)?.blocked) {
        toast({
          title: "Thanks!",
          description: "We've received your details and will be in touch."
        });
      } else {
        toast({
          title: "Success!",
          description: "Proposal sent! Check your email for details."
        });
      }
      handleClose();
    } catch (error) {
      console.error("Error sending proposal:", error);
      toast({
        title: "Error",
        description: "Failed to send proposal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(0);
    setAnswers([]);
    setShowCongrats(false);
    setShowDetailsForm(false);
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      address: "",
      systemSize: "",
      commissioningDate: ""
    });
    onOpenChange(false);
  };

  const isQualified = step === questions.length && 
    answers.every((ans, idx) => ans === questions[idx].correctAnswer);
  
  const failedStep = step === questions.length ? 
    answers.findIndex((ans, idx) => ans !== questions[idx].correctAnswer) : -1;

  // Confetti effect
  useEffect(() => {
    if (showCongrats) {
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#FFD700', '#FFA500', '#FF6B6B']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#FFD700', '#FFA500', '#FF6B6B']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [showCongrats]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Quick Eligibility Check</DialogTitle>
        </DialogHeader>
        
        {step < questions.length && !showCongrats ? (
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium">
                Question {step + 1} of {questions.length}
              </h3>
              <p className="text-xl font-semibold text-foreground">
                {questions[step].question}
              </p>
            </div>
            
            <div className="flex gap-4">
              <Button
                onClick={() => handleAnswer(true)}
                variant="outline"
                className="flex-1 h-14 text-lg"
              >
                Yes
              </Button>
              <Button
                onClick={() => handleAnswer(false)}
                variant="outline"
                className="flex-1 h-14 text-lg"
              >
                No
              </Button>
            </div>
            
            <div className="flex gap-1 justify-center">
              {questions.map((_, idx) => (
                <div 
                  key={idx}
                  className={`h-2 rounded-full transition-all ${
                    idx < step ? "w-8 bg-primary" : 
                    idx === step ? "w-12 bg-primary/50" : 
                    "w-8 bg-muted"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : showCongrats && !showDetailsForm ? (
          <div className="text-center py-8 space-y-6">
            <div className="mb-6">
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
              <h3 className="text-3xl font-bold text-foreground mb-2">
                🎉 Congratulations!
              </h3>
              <p className="text-lg text-muted-foreground mb-2">
                You qualify for carbon credits!
              </p>
              <p className="text-base text-muted-foreground max-w-md mx-auto">
                Your solar system meets all the requirements. Let's get you started on earning passive income from your clean energy.
              </p>
            </div>
            <Button 
              onClick={() => setShowDetailsForm(true)}
              size="lg"
              className="bg-crunch-yellow hover:bg-crunch-yellow/90 text-foreground font-semibold h-14 px-10"
            >
              Get My Proposal
            </Button>
          </div>
        ) : showDetailsForm ? (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <h3 className="text-2xl font-bold text-center mb-4">Tell us about your system</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                  required
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                  required
                  placeholder="Doe"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
                required
                placeholder="john@example.com"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Physical Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                required
                placeholder="123 Main St, Cape Town"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="systemSize">System Size (kWp) *</Label>
              <Input
                id="systemSize"
                type="number"
                step="0.01"
                min="0.1"
                max="50"
                value={formData.systemSize}
                onChange={(e) => setFormData({...formData, systemSize: e.target.value})}
                required
                placeholder="5.5"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="commissioningDate">Commissioning/Installation Date *</Label>
              <Input
                id="commissioningDate"
                type="date"
                min="2022-09-15"
                value={formData.commissioningDate}
                onChange={(e) => setFormData({...formData, commissioningDate: e.target.value})}
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-crunch-yellow hover:bg-crunch-yellow/90 text-foreground font-semibold h-12"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Send My Proposal"}
            </Button>
          </form>
        ) : isQualified ? (
          <div className="py-6 text-center space-y-6">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">
                Great News! You Qualify!
              </h3>
              <p className="text-muted-foreground">
                Your solar system is eligible for carbon credit earnings.
                Let's calculate your potential income.
              </p>
            </div>
            
            <Button 
              onClick={onQualified}
              className="w-full h-12 text-lg"
            >
              Calculate My Earnings →
            </Button>
          </div>
        ) : (
          <div className="py-6 text-center space-y-6">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-foreground">
                Not Eligible (Yet)
              </h3>
              <p className="text-muted-foreground">
                {failedStep === 0 && "Currently, we only work with solar systems in South Africa."}
                {failedStep === 1 && "You must NOT be registered for any other Greenhouse Gas Emissions program to qualify."}
                {failedStep === 2 && "Systems over 50 kWp require a different registration process. Contact us for enterprise solutions."}
                {failedStep === 3 && "Your system must have been commissioned on or after September 15, 2022."}
                {failedStep === 4 && "You must have legal ownership of the system or green attributes."}
                {failedStep === 5 && "Participation in South African Government Funding Initiatives affects eligibility."}
              </p>
            </div>
            
            <Button 
              onClick={handleClose}
              variant="outline"
              className="w-full"
            >
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
