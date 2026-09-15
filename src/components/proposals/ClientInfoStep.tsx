import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { ClientInformation, AdditionalClient } from "./types";
import { ClientFormFields } from "./client-info/ClientFormFields";
import { ClientStepFooter } from "./client-info/ClientStepFooter";
import { ClientCreationFeedback } from "./client-info/ClientCreationFeedback";
import { AdditionalClientForm } from "./client-info/AdditionalClientForm";
import { useAuth } from "@/contexts/auth";
import { isSelfAsClient } from "@/lib/validation/selfAsClient";

interface ClientInfoStepProps {
  clientInfo: ClientInformation;
  updateClientInfo: (e: React.ChangeEvent<HTMLInputElement>) => void;
  nextStep: () => void;
  prevStep: () => void;
  setClientInfo?: (clientInfo: ClientInformation) => void;
  selectedClientId?: string;
  setSelectedClientId?: (id: string | null) => void;
  additionalClients?: AdditionalClient[];
  setAdditionalClients?: (clients: AdditionalClient[]) => void;
}

export function ClientInfoStep({ 
  clientInfo, 
  updateClientInfo, 
  nextStep, 
  prevStep,
  setClientInfo,
  selectedClientId,
  setSelectedClientId,
  additionalClients = [],
  setAdditionalClients
}: ClientInfoStepProps) {
  const { profile, user } = useAuth();
  const ownEmail = profile?.email || user?.email;
  const hasSelfAsClient =
    isSelfAsClient(clientInfo.email, ownEmail, profile?.role) ||
    additionalClients.some(c => isSelfAsClient(c.email, ownEmail, profile?.role));

  const isFormValid = Boolean(
    clientInfo.name && clientInfo.email &&
    additionalClients.every(c => c.name && c.email) &&
    !hasSelfAsClient
  );
  const isNewClient = !selectedClientId && clientInfo.name && clientInfo.email && !clientInfo.existingClient;

  const handleAddClient = () => {
    setAdditionalClients?.([...additionalClients, { name: "", email: "" }]);
  };

  const handleUpdateAdditionalClient = (index: number, client: AdditionalClient) => {
    const updated = [...additionalClients];
    updated[index] = client;
    setAdditionalClients?.(updated);
  };

  const handleRemoveAdditionalClient = (index: number) => {
    setAdditionalClients?.(additionalClients.filter((_, i) => i !== index));
  };

  return (
    <Card className="retro-card">
      <CardHeader>
        <CardTitle>Client Information</CardTitle>
        <CardDescription>
          Search for an existing client or enter new client details. You can add multiple clients to this proposal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <span className="text-sm font-medium text-muted-foreground mb-2 block">Primary Client</span>
            <ClientFormFields 
              clientInfo={clientInfo}
              updateClientInfo={updateClientInfo}
              setClientInfo={setClientInfo}
            />
          </div>
          
          <ClientCreationFeedback
            isCreating={false}
            isNewClient={isNewClient}
            clientName={clientInfo.name}
          />

          {additionalClients.map((client, index) => (
            <AdditionalClientForm
              key={index}
              index={index}
              client={client}
              onChange={handleUpdateAdditionalClient}
              onRemove={handleRemoveAdditionalClient}
            />
          ))}

          {setAdditionalClients && (
            <Button
              type="button"
              variant="outline"
              onClick={handleAddClient}
              className="w-full border-dashed"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add Another Client
            </Button>
          )}
        </div>
      </CardContent>
      <CardFooter>
        <ClientStepFooter
          nextStep={nextStep}
          prevStep={prevStep}
          isValid={isFormValid}
        />
      </CardFooter>
    </Card>
  );
}
