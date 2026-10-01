
import { useState, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "lucide-react";
import { MapAddressPicker } from "@/components/common/MapAddressPicker";
import { ProjectInformation, GenerationInputMode, AnnualKwhByYear } from "@/types/proposals";
import { getMinimumDateString } from "@/utils/dateValidation";
import { ProjectPhasesInput } from "./ProjectPhasesInput";
import { AnnualKwhGrid } from "./AnnualKwhGrid";
import { useToast } from "@/hooks/use-toast";

interface ProjectInfoFormProps {
  projectInfo: ProjectInformation;
  updateProjectInfo: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleAddressChange: (address: string) => void;
  onPhaseToggle?: (isMultiPhase: boolean) => void;
  onPhasesChange?: (phases: any[]) => void;
  setProjectInfo?: (info: ProjectInformation) => void;
}

export function ProjectInfoForm({
  projectInfo,
  updateProjectInfo,
  handleAddressChange,
  onPhaseToggle,
  onPhasesChange,
  setProjectInfo
}: ProjectInfoFormProps) {
  const { toast } = useToast();

  const handleMapLocationSelect = (lat: number, lng: number, address: string) => {
    if (setProjectInfo) {
      setProjectInfo({
        ...projectInfo,
        address,
        gpsLat: lat,
        gpsLng: lng,
        addressSource: 'pin_drop'
      });
    } else {
      const event = {
        target: { name: 'address', value: address }
      } as React.ChangeEvent<HTMLInputElement>;
      updateProjectInfo(event);
      
      const gpsEvent = {
        target: { name: 'gpsData', value: JSON.stringify({ lat, lng, addressSource: 'pin_drop' }) }
      } as React.ChangeEvent<HTMLInputElement>;
      updateProjectInfo(gpsEvent);
    }
    
    toast({
      title: "Location Selected",
      description: "Your location has been saved successfully.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="name">Project Name</Label>
          <Input 
            id="name" 
            name="name" 
            value={projectInfo.name}
            onChange={updateProjectInfo}
            className="retro-input"
            required
          />
        </div>
        
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="address">Project Address</Label>
          <p className="text-xs text-muted-foreground mb-2">
            Search for an address or drop a pin on the map to set the project location.
          </p>
          <MapAddressPicker
            onLocationSelect={handleMapLocationSelect}
            initialLat={projectInfo.gpsLat}
            initialLng={projectInfo.gpsLng}
          />
          {projectInfo.address && projectInfo.gpsLat && projectInfo.gpsLng && (
            <div className="mt-2 p-2 bg-muted rounded text-sm">
              <p className="font-medium">Selected: {projectInfo.address}</p>
              <p className="text-xs text-muted-foreground">
                GPS: {projectInfo.gpsLat.toFixed(6)}, {projectInfo.gpsLng.toFixed(6)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4 p-4 border rounded-lg bg-card">
        <Label className="text-base font-semibold">Project Type</Label>
        <RadioGroup
          value={projectInfo.isMultiPhase ? "multi" : "single"}
          onValueChange={(value) => onPhaseToggle?.(value === "multi")}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="single" id="single" />
            <Label htmlFor="single" className="font-normal cursor-pointer">
              Single-Phase Project
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="multi" id="multi" />
            <Label htmlFor="multi" className="font-normal cursor-pointer">
              Multi-Phase Project (multiple commissioning dates)
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3 p-4 border rounded-lg bg-card">
        <Label className="text-base font-semibold">Generation Input Method</Label>
        <p className="text-xs text-muted-foreground">
          Choose how the system's energy generation is captured. kWp uses our standard yield factor;
          kWh lets you enter measured/estimated production directly per year.
        </p>
        <RadioGroup
          value={projectInfo.generationInputMode === "kwh" ? "kwh" : "kwp"}
          onValueChange={(value) => {
            const mode = (value as GenerationInputMode) || "kwp";
            if (setProjectInfo) {
              setProjectInfo({
                ...projectInfo,
                generationInputMode: mode,
                // Reset opposite mode's fields so stale data doesn't leak into calcs.
                ...(mode === "kwp"
                  ? { annualKwhByYear: undefined, phases: projectInfo.phases?.map(p => ({ ...p, annualKwhByYear: undefined })) }
                  : {}),
              });
            }
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="kwp" id="gen-kwp" />
            <Label htmlFor="gen-kwp" className="font-normal cursor-pointer">
              System Size (kWp) — default
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="kwh" id="gen-kwh" />
            <Label htmlFor="gen-kwh" className="font-normal cursor-pointer">
              Estimated kWh per year (2025–2030)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {projectInfo.isMultiPhase ? (
        <ProjectPhasesInput
          phases={projectInfo.phases || [{ phaseNumber: 1, sizeKWp: 0, commissionDate: "" }]}
          onChange={onPhasesChange || (() => {})}
          generationInputMode={projectInfo.generationInputMode === "kwh" ? "kwh" : "kwp"}
        />
      ) : projectInfo.generationInputMode === "kwh" ? (
        <div className="space-y-6">
          <AnnualKwhGrid
            value={projectInfo.annualKwhByYear}
            onChange={(next: AnnualKwhByYear) => {
              if (setProjectInfo) {
                setProjectInfo({ ...projectInfo, annualKwhByYear: next });
              }
            }}
          />
          <div className="space-y-2 md:max-w-sm">
            <Label htmlFor="commissionDate">Commission Date</Label>
            <div className="relative">
              <Input
                id="commissionDate"
                name="commissionDate"
                type="date"
                value={projectInfo.commissionDate}
                onChange={updateProjectInfo}
                className="retro-input"
                required
                min={getMinimumDateString()}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-carbon-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-carbon-gray-500">Must be on or after 1 July 2026</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="size">System Size (kWp)</Label>
            <Input 
              id="size" 
              name="size" 
              type="number"
              step="0.01"
              min="0"
              max="15000"
              value={projectInfo.size}
              onChange={updateProjectInfo}
              className="retro-input"
              required
            />
            <p className="text-xs text-carbon-gray-500">Must be less than 15,000 kWp</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="commissionDate">Commission Date</Label>
            <div className="relative">
              <Input 
                id="commissionDate" 
                name="commissionDate" 
                type="date"
                value={projectInfo.commissionDate}
                onChange={updateProjectInfo}
                className="retro-input"
                required
                min={getMinimumDateString()}
              />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-carbon-gray-400 pointer-events-none" />
            </div>
            <p className="text-xs text-carbon-gray-500">Must be on or after 1 July 2026</p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="additionalNotes">Additional Notes (Optional)</Label>
        <Textarea 
          id="additionalNotes" 
          name="additionalNotes" 
          value={projectInfo.additionalNotes}
          onChange={updateProjectInfo}
          className="retro-input"
          rows={3}
        />
      </div>
    </div>
  );
}
