
import { useState, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClientInformation } from "../types";
import { searchClients } from "@/services/proposals/unifiedProposalService";
import { devLogger } from '@/lib/performance/ConsoleReplacementUtility';
import { useAuth } from "@/contexts/auth";
import { isSelfAsClient, SELF_AS_CLIENT_MESSAGE } from "@/lib/validation/selfAsClient";

interface ClientFormFieldsProps {
  clientInfo: ClientInformation;
  updateClientInfo: (e: ChangeEvent<HTMLInputElement>) => void;
  setClientInfo?: (clientInfo: ClientInformation) => void;
}

export function ClientFormFields({ 
  clientInfo, 
  updateClientInfo, 
  setClientInfo 
}: ClientFormFieldsProps) {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { profile, user } = useAuth();
  const isSelf = isSelfAsClient(clientInfo.email, profile?.email || user?.email, profile?.role);

  const handleNameChange = async (e: ChangeEvent<HTMLInputElement>) => {
    updateClientInfo(e);
    
    const value = e.target.value;
    if (value.length > 2 && setClientInfo) {
      try {
        const results = await searchClients(value);
        setSearchResults(results);
        setShowSuggestions(results.length > 0);
      } catch (error) {
        devLogger.proposals.error('Client search error', error);
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const selectClient = (client: any) => {
    if (setClientInfo) {
      setClientInfo({
        name: client.name,
        email: client.email,
        phone: "",
        companyName: client.company || "",
        registrationNumber: "",
        existingClient: true,
      });
    }
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-4">
      <div className="relative space-y-1.5">
        <Label htmlFor="name">Client Name *</Label>
        <Input
          id="name"
          name="name"
          type="text"
          value={clientInfo.name}
          onChange={handleNameChange}
          placeholder="Search or enter client name"
          autoComplete="off"
          required
        />

        {showSuggestions && (
          <div className="absolute z-20 w-full mt-1 bg-popover text-popover-foreground border border-border rounded-md shadow-lg max-h-56 overflow-auto">
            {searchResults.map((client) => (
              <button
                type="button"
                key={client.id}
                className="w-full text-left px-4 py-3 min-h-11 hover:bg-accent active:bg-accent cursor-pointer border-b border-border last:border-b-0"
                onClick={() => selectClient(client)}
              >
                <div className="font-medium break-words">{client.name}</div>
                <div className="text-sm text-muted-foreground break-all">{client.email}</div>
                {client.company && (
                  <div className="text-xs text-muted-foreground break-words">{client.company}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>


      <div>
        <Label htmlFor="email">Email Address *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={clientInfo.email}
          onChange={updateClientInfo}
          placeholder="client@example.com"
          required
          aria-invalid={isSelf}
          className={isSelf ? "border-destructive focus-visible:ring-destructive" : undefined}
        />
        {isSelf && (
          <p className="text-xs text-destructive mt-1">{SELF_AS_CLIENT_MESSAGE}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={clientInfo.phone}
          onChange={updateClientInfo}
          placeholder="+27 123 456 7890"
        />
      </div>

      <div>
        <Label htmlFor="companyName">Company Name</Label>
        <Input
          id="companyName"
          name="companyName"
          type="text"
          value={clientInfo.companyName}
          onChange={updateClientInfo}
          placeholder="Company Name (optional)"
        />
      </div>

      <div>
        <Label htmlFor="registrationNumber">Company Registration Number</Label>
        <Input
          id="registrationNumber"
          name="registrationNumber"
          type="text"
          value={clientInfo.registrationNumber || ""}
          onChange={updateClientInfo}
          placeholder="Registration Number (optional)"
        />
      </div>
    </div>
  );
}
