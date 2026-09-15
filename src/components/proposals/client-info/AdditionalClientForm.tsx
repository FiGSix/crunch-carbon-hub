import { useState, ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X, Crown } from "lucide-react";
import { AdditionalClient } from "@/types/proposals";
import { searchClients } from "@/services/proposals/unifiedProposalService";
import { useAuth } from "@/contexts/auth";
import { isSelfAsClient, SELF_AS_CLIENT_MESSAGE } from "@/lib/validation/selfAsClient";

interface AdditionalClientFormProps {
  index: number;
  client: AdditionalClient;
  errors?: Record<string, string>;
  onChange: (index: number, client: AdditionalClient) => void;
  onRemove: (index: number) => void;
  onMakePrimary?: (index: number) => void;
}

export function AdditionalClientForm({ index, client, errors, onChange, onRemove, onMakePrimary }: AdditionalClientFormProps) {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { profile, user } = useAuth();
  const isSelf = isSelfAsClient(client.email, profile?.email || user?.email, profile?.role);

  const handleFieldChange = (field: keyof AdditionalClient, value: string) => {
    onChange(index, { ...client, [field]: value, clientId: field === 'name' ? undefined : client.clientId });
  };

  const handleNameChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    handleFieldChange('name', value);

    if (value.length > 2) {
      try {
        const results = await searchClients(value);
        setSearchResults(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }
  };

  const selectClient = (result: any) => {
    onChange(index, {
      name: result.name,
      email: result.email,
      phone: "",
      companyName: result.company || "",
      clientId: result.id,
    });
    setShowSuggestions(false);
  };

  return (
    <div className="relative border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Additional Client {index + 1}</span>
        <div className="flex items-center gap-1">
          {onMakePrimary && (
            <Button type="button" variant="outline" size="sm" onClick={() => onMakePrimary(index)} className="h-7 text-xs">
              <Crown className="h-3 w-3 mr-1" />
              Make Primary
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)} className="h-7 w-7">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="relative">
        <Label>Name *</Label>
        <Input
          value={client.name}
          onChange={handleNameChange}
          placeholder="Search or enter client name"
          required
          className={errors?.[`addClient_${index}_name`] ? 'border-destructive' : ''}
        />
        {errors?.[`addClient_${index}_name`] && (
          <p className="text-xs text-destructive mt-1">{errors[`addClient_${index}_name`]}</p>
        )}
        {showSuggestions && (
          <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-48 overflow-auto">
            {searchResults.map((r) => (
              <div key={r.id} className="px-4 py-2 hover:bg-muted cursor-pointer" onClick={() => selectClient(r)}>
                <div className="font-medium text-sm">{r.name}</div>
                <div className="text-xs text-muted-foreground">{r.email}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label>Email *</Label>
        <Input
          type="email"
          value={client.email}
          onChange={(e) => handleFieldChange('email', e.target.value)}
          placeholder="client@example.com"
          required
          aria-invalid={isSelf}
          className={errors?.[`addClient_${index}_email`] || isSelf ? 'border-destructive' : ''}
        />
        {errors?.[`addClient_${index}_email`] && (
          <p className="text-xs text-destructive mt-1">{errors[`addClient_${index}_email`]}</p>
        )}
        {isSelf && !errors?.[`addClient_${index}_email`] && (
          <p className="text-xs text-destructive mt-1">{SELF_AS_CLIENT_MESSAGE}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Phone</Label>
          <Input
            type="tel"
            value={client.phone || ""}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            placeholder="+27 123 456 7890"
          />
        </div>
        <div>
          <Label>Company</Label>
          <Input
            value={client.companyName || ""}
            onChange={(e) => handleFieldChange('companyName', e.target.value)}
            placeholder="Company (optional)"
          />
        </div>
      </div>
    </div>
  );
}
