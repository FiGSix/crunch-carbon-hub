import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertCircle, Info, MapPin } from "lucide-react";
import { OnboardingFileUpload } from "@/components/onboarding/OnboardingFileUpload";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { OnboardingFields, OnboardingDocument, ProjectOnboarding, PhaseDetail } from "@/types/onboarding";
import { useAuth } from "@/contexts/auth";
import { getAllAdminUserIds } from "@/services/adminService";
import { createNotification } from "@/services/notificationService";
import { logger } from "@/lib/logger";
import { InverterDetailsRow, type InverterDetail } from "@/components/onboarding/InverterDetailsRow";
import { PanelArrayDetailsRow, type PanelArrayDetail } from "@/components/onboarding/PanelArrayDetailsRow";
import { useOnboardingValidation } from "@/hooks/useOnboardingValidation";
import { useMapboxGeocoding } from "@/hooks/useMapboxGeocoding";

import { FormError } from "@/components/ui/form-error";
import { ValidationSummary } from "@/components/onboarding/ValidationSummary";
import { cn } from "@/lib/utils";
import { calculateAnnualEnergy, calculateCarbonCredits } from "@/services/calculations/carbon/calculations";
import { DataAccessTab } from "./DataAccessTab";

interface SolarInstaller {
  id: string;
  company_name: string;
  email: string | null;
}

interface OnboardingTabProps {
  projectId: string;
  fields: OnboardingFields | null;
  project?: ProjectOnboarding | null;
  proposal?: any;
  onRefresh: () => void;
}

export function OnboardingTab({ projectId, fields, project, proposal, onRefresh }: OnboardingTabProps) {
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<OnboardingFields>>(fields || {});
  const [documents, setDocuments] = useState<OnboardingDocument[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [installers, setInstallers] = useState<SolarInstaller[]>([]);
  const [loadingInstallers, setLoadingInstallers] = useState(false);
  const [inverterDetails, setInverterDetails] = useState<InverterDetail[]>([]);
  const [panelArrayDetails, setPanelArrayDetails] = useState<PanelArrayDetail[]>([]);
  const [panelArrayCount, setPanelArrayCount] = useState<number>(1);
  const [showValidationSummary, setShowValidationSummary] = useState(false);
  
  const {
    errors,
    touched,
    validateFieldOnBlur,
    validateInverters,
    validatePanelArrays,
    getAllErrors,
    hasErrors,
    setFieldTouched,
    clearFieldError,
  } = useOnboardingValidation();
  const { searchAddress } = useMapboxGeocoding();
  const [geocoding, setGeocoding] = useState(false);


  // Ref to expose DataAccessTab save/submit actions to page-level footer buttons
  const dataAccessActionsRef = useRef<{
    saveDraft: () => Promise<boolean>;
    submitForAudit: () => Promise<boolean>;
  } | null>(null);

  useEffect(() => {
    fetchDocuments();
    fetchInstallers();
  }, [projectId]);

  // Sync formData with fields prop when fields changes (e.g., after save/refresh)
  useEffect(() => {
    if (fields) {
      setFormData(fields);
    }
  }, [fields]);

  // Pre-fill system name from the proposal title when it is missing
  useEffect(() => {
    const proposalName = proposal?.title || proposal?.project_name;
    if (proposalName && !formData.system_name) {
      setFormData(prev => (prev.system_name ? prev : { ...prev, system_name: proposalName }));
    }
  }, [proposal, formData.system_name]);


  // Auto-calculate total_capex from component costs
  useEffect(() => {
    const inverterCost = formData.inverter_cost || 0;
    const batteryCost = formData.battery_cost || 0;
    const panelCost = formData.panel_cost || 0;
    const calculatedTotal = inverterCost + batteryCost + panelCost;
    
    if (calculatedTotal > 0) {
      setFormData(prev => ({ ...prev, total_capex: calculatedTotal }));
    }
  }, [formData.inverter_cost, formData.battery_cost, formData.panel_cost]);


  // Initialize and manage inverter details based on quantity
  useEffect(() => {
    const quantity = formData.inverter_quantity || 1;
    
    // Parse existing data - check for new JSON array format first
    let existingDetails: InverterDetail[] = [];
    
    if (formData.inverter_serial) {
      try {
        const parsed = JSON.parse(formData.inverter_serial as string);
        
        // Check if it's the new format (array of objects with brand/model/etc.)
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'brand' in parsed[0]) {
          existingDetails = parsed as InverterDetail[];
        } else if (Array.isArray(parsed)) {
          // Old format: array of serial strings - migrate to new format
          existingDetails = parsed.map((serial: string) => ({
            brand: formData.inverter_brand || '',
            model: formData.inverter_model || '',
            capacity_kw: formData.inverter_capacity_kw || null,
            serial: serial || ''
          }));
        }
      } catch {
        // If not JSON, treat as single serial - migrate to new format
        existingDetails = [{
          brand: formData.inverter_brand || '',
          model: formData.inverter_model || '',
          capacity_kw: formData.inverter_capacity_kw || null,
          serial: formData.inverter_serial as string || ''
        }];
      }
    }
    
    // If no existing details but we have legacy single-value fields, use them
    if (existingDetails.length === 0 && (formData.inverter_brand || formData.inverter_model)) {
      existingDetails = [{
        brand: formData.inverter_brand || '',
        model: formData.inverter_model || '',
        capacity_kw: formData.inverter_capacity_kw || null,
        serial: ''
      }];
    }
    
    // Adjust array size to match quantity
    const newDetails: InverterDetail[] = Array(quantity).fill(null).map((_, i) => 
      existingDetails[i] || { brand: '', model: '', capacity_kw: null, serial: '' }
    );
    
    setInverterDetails(newDetails);
  }, [formData.inverter_quantity]);

  // Initialize and manage panel array details based on panelArrayCount
  useEffect(() => {
    const count = panelArrayCount;
    
    // Parse existing data - check for new JSON array format first
    let existingDetails: PanelArrayDetail[] = [];
    
    if (formData.panel_brand) {
      try {
        const parsed = JSON.parse(formData.panel_brand as string);
        
        // Check if it's the new format (array of objects with brand/size_wp/etc.)
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'brand' in parsed[0]) {
          existingDetails = parsed as PanelArrayDetail[];
          // Update panelArrayCount to match existing data if this is initial load
          if (parsed.length !== panelArrayCount && panelArrayDetails.length === 0) {
            setPanelArrayCount(parsed.length);
            return; // Let the effect run again with correct count
          }
        }
      } catch {
        // If not JSON, treat as legacy single brand value - migrate to new format
        existingDetails = [{
          brand: formData.panel_brand as string || '',
          size_wp: formData.panel_size_wp || null,
          quantity: formData.panel_quantity || null,
          total_kwp: formData.panel_total_kwp || null
        }];
      }
    }
    
    // If no existing details but we have legacy single-value fields, use them
    if (existingDetails.length === 0 && (formData.panel_size_wp || formData.panel_quantity)) {
      existingDetails = [{
        brand: '',
        size_wp: formData.panel_size_wp || null,
        quantity: formData.panel_quantity || null,
        total_kwp: formData.panel_total_kwp || null
      }];
    }
    
    // Adjust array size to match count
    const newDetails: PanelArrayDetail[] = Array(count).fill(null).map((_, i) => 
      existingDetails[i] || { brand: '', size_wp: null, quantity: null, total_kwp: null }
    );
    
    setPanelArrayDetails(newDetails);
  }, [panelArrayCount]);

  const fetchDocuments = async () => {
    setLoadingDocs(true);
    try {
      const { data, error } = await supabase
        .from('onboarding_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments((data || []) as OnboardingDocument[]);
    } catch (error) {
      logger.error('Error fetching documents', { error, projectId });
    } finally {
      setLoadingDocs(false);
    }
  };

  const fetchInstallers = async () => {
    setLoadingInstallers(true);
    try {
      const { data, error } = await supabase
        .from('solar_installers')
        .select('id, company_name, email')
        .order('company_name');

      if (error) throw error;
      setInstallers((data || []) as SolarInstaller[]);
    } catch (error) {
      logger.error('Error fetching installers', { error });
    } finally {
      setLoadingInstallers(false);
    }
  };

  const handleInstallerSelect = async (installerId: string) => {
    if (installerId === 'new') {
      // Clear installer data to allow manual entry
      setFormData(prev => ({
        ...prev,
        installer_id: undefined,
        installer_company_name: '',
        installer_email: ''
      }));
      return;
    }

    const installer = installers.find(i => i.id === installerId);
    if (installer) {
      setFormData(prev => ({
        ...prev,
        installer_id: installerId,
        installer_company_name: installer.company_name,
        installer_email: installer.email || ''
      }));
    }
  };

  const handleCreateNewInstaller = async (companyName: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('solar_installers')
        .insert({
          company_name: companyName,
          email: email || null,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      // Refresh installers list
      await fetchInstallers();

      // Update form data with new installer
      if (data) {
        setFormData(prev => ({
          ...prev,
          installer_id: data.id,
          installer_company_name: data.company_name,
          installer_email: data.email || ''
        }));

        toast({
          title: "Success",
          description: "New installer added successfully",
        });
      }
    } catch (error) {
      logger.error('Error creating installer', { error });
      toast({
        title: "Error",
        description: "Failed to add new installer",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: keyof OnboardingFields, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFieldBlur = (field: keyof OnboardingFields, overrideValue?: unknown) => {
    const value = overrideValue !== undefined ? overrideValue : formData[field];
    validateFieldOnBlur(field, value, { ...formData, [field]: value });
  };

  const handleLocateFromAddress = async () => {
    const address = formData.system_address?.trim();
    if (!address) return;
    setGeocoding(true);
    try {
      const result = await searchAddress(address);
      if (result) {
        setFormData(prev => ({ ...prev, system_gps_lat: result.lat, system_gps_lng: result.lng }));
        clearFieldError('system_gps_lat');
        clearFieldError('system_gps_lng');
        toast({ title: 'Coordinates found', description: `${result.lat.toFixed(6)}, ${result.lng.toFixed(6)}` });
      } else {
        toast({ title: 'No match found', description: 'Could not locate this address. Enter coordinates manually.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Lookup failed', description: 'Could not locate this address. Enter coordinates manually.', variant: 'destructive' });
    } finally {
      setGeocoding(false);
    }
  };


  const handleInverterDetailChange = useCallback((index: number, field: keyof InverterDetail, value: string | number | null) => {
    setInverterDetails(prev => {
      const newDetails = [...prev];
      newDetails[index] = { ...newDetails[index], [field]: value };
      
      // Update formData with serialized inverter details
      const serializedDetails = JSON.stringify(newDetails);
      setFormData(prevForm => ({ ...prevForm, inverter_serial: serializedDetails }));
      
      return newDetails;
    });
  }, []);

  const handleInverterDetailBlur = useCallback((index: number, field: keyof InverterDetail) => {
    // Validate all inverters on blur
    validateInverters(inverterDetails);
  }, [inverterDetails, validateInverters]);

  const handlePanelArrayDetailBlur = useCallback((index: number, field: keyof PanelArrayDetail) => {
    // Validate all panel arrays on blur
    validatePanelArrays(panelArrayDetails);
  }, [panelArrayDetails, validatePanelArrays]);

  const handlePanelArrayDetailChange = useCallback((index: number, field: keyof PanelArrayDetail, value: string | number | null) => {
    setPanelArrayDetails(prev => {
      const newDetails = [...prev];
      newDetails[index] = { ...newDetails[index], [field]: value };
      
      // Auto-calculate total_kwp for this array
      if (field === 'size_wp' || field === 'quantity') {
        const size = field === 'size_wp' ? (value as number) : newDetails[index].size_wp;
        const qty = field === 'quantity' ? (value as number) : newDetails[index].quantity;
        if (size && qty) {
          newDetails[index].total_kwp = parseFloat(((size * qty) / 1000).toFixed(2));
        } else {
          newDetails[index].total_kwp = null;
        }
      }
      
      // Serialize and store in panel_brand
      const serializedDetails = JSON.stringify(newDetails);
      
      // Calculate aggregate totals
      const totalQuantity = newDetails.reduce((sum, arr) => sum + (arr.quantity || 0), 0);
      const totalKwp = newDetails.reduce((sum, arr) => sum + (arr.total_kwp || 0), 0);
      
      setFormData(prevForm => ({ 
        ...prevForm, 
        panel_brand: serializedDetails,
        panel_quantity: totalQuantity,
        panel_total_kwp: parseFloat(totalKwp.toFixed(2))
      }));
      
      return newDetails;
    });
  }, []);

  const handleSaveDraft = async () => {
    try {
      setIsSaving(true);

      // Prepare data for upsert, excluding auto-managed fields
      const { id, created_at, updated_at, validated_at, validated_by, ...upsertData } = formData;
      
      const { error } = await supabase
        .from('onboarding_fields')
        .upsert({
          project_id: projectId,
          ...upsertData as any,
        }, {
          onConflict: 'project_id'
        });

      if (error) throw error;

      // Cascade sync system_name, panel_total_kwp, and phases to proposals table
      const hasPhases = formData.phases_json && Array.isArray(formData.phases_json) && formData.phases_json.length > 0;
      const shouldSync = formData.system_name || (formData.panel_total_kwp && formData.panel_total_kwp > 0) || hasPhases;
      if (shouldSync) {
        const { data: projectData } = await supabase
          .from('project_onboarding')
          .select('proposal_id')
          .eq('id', projectId)
          .single();

        if (projectData?.proposal_id) {
          // Always fetch proposal content when syncing (needed for phases and system_name)
          const { data: proposalData } = await supabase
            .from('proposals')
            .select('project_info, content')
            .eq('id', projectData.proposal_id)
            .single();

          const updatePayload: Record<string, any> = {};
          const currentProjectInfo = (proposalData?.project_info as Record<string, unknown>) || {};

          if (formData.system_name) {
            updatePayload.title = formData.system_name;
            updatePayload.project_info = { ...currentProjectInfo, name: formData.system_name };
          }

          if (formData.panel_total_kwp && formData.panel_total_kwp > 0) {
            const newSizeKwp = formData.panel_total_kwp;
            updatePayload.system_size_kwp = newSizeKwp;
            updatePayload.annual_energy = calculateAnnualEnergy(newSizeKwp);
            updatePayload.carbon_credits = calculateCarbonCredits(newSizeKwp);
          }

          // Sync phases back to proposal content
          if (hasPhases && proposalData?.content) {
            const content = proposalData.content as Record<string, any>;
            const updatedContent = {
              ...content,
              projectInfo: {
                ...(content.projectInfo || {}),
                phases: formData.phases_json,
              },
            };
            updatePayload.content = updatedContent;
          }

          if (Object.keys(updatePayload).length > 0) {
            await supabase
              .from('proposals')
              .update(updatePayload)
              .eq('id', projectData.proposal_id);
          }
        }
      }

      // Also persist Data Access Configuration (embedded card, no longer has own buttons)
      try {
        await dataAccessActionsRef.current?.saveDraft();
      } catch (daErr) {
        logger.warn('Data Access save-draft failed', { error: daErr, projectId });
      }

      toast({
        title: "Success",
        description: "Draft saved successfully",
      });

      onRefresh();
    } catch (error) {
      logger.error('Error saving draft', { error, projectId });
      toast({
        title: "Error",
        description: "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidateAndComplete = async () => {
    try {
      setIsSaving(true);
      
      if (!user) {
        toast({
          title: "Error",
          description: "User not authenticated",
          variant: "destructive",
        });
        return;
      }

      // Client-side validation first
      const allErrors = getAllErrors(formData, inverterDetails, panelArrayDetails);
      if (Object.keys(allErrors).length > 0) {
        setShowValidationSummary(true);
        // Mark every errored field as touched so inline red borders/messages appear
        Object.keys(allErrors).forEach(fieldName => setFieldTouched(fieldName));
        toast({
          title: "Validation Failed",
          description: "Please fix the highlighted errors before submitting",
          variant: "destructive",
        });
        return;
      }

      logger.info("Starting validation and completion process", { projectId });

      // Prepare data for upsert, excluding auto-managed fields
      const { id, created_at, updated_at, validated_at, validated_by, ...upsertData } = formData;
      
      // First, save all current data
      const { error: fieldsError } = await supabase
        .from('onboarding_fields')
        .upsert({
          project_id: projectId,
          ...upsertData as any,
        }, {
          onConflict: 'project_id'
        });

      if (fieldsError) {
        logger.error("Error saving fields", { error: fieldsError, projectId });
        throw fieldsError;
      }

      logger.info("Fields saved successfully, validating", { projectId });

      // Cascade sync system_name, panel_total_kwp, and phases to proposals table
      const hasPhases2 = formData.phases_json && Array.isArray(formData.phases_json) && formData.phases_json.length > 0;
      const shouldSyncProposal = formData.system_name || (formData.panel_total_kwp && formData.panel_total_kwp > 0) || hasPhases2;
      if (shouldSyncProposal) {
        const { data: projectOnboardingData } = await supabase
          .from('project_onboarding')
          .select('proposal_id')
          .eq('id', projectId)
          .single();

        if (projectOnboardingData?.proposal_id) {
          const { data: proposalData } = await supabase
            .from('proposals')
            .select('project_info, content')
            .eq('id', projectOnboardingData.proposal_id)
            .single();

          const proposalUpdatePayload: Record<string, any> = {};
          const currentProjectInfo = (proposalData?.project_info as Record<string, unknown>) || {};

          if (formData.system_name) {
            proposalUpdatePayload.title = formData.system_name;
            proposalUpdatePayload.project_info = { ...currentProjectInfo, name: formData.system_name };
          }

          if (formData.panel_total_kwp && formData.panel_total_kwp > 0) {
            const newSizeKwp = formData.panel_total_kwp;
            proposalUpdatePayload.system_size_kwp = newSizeKwp;
            proposalUpdatePayload.annual_energy = calculateAnnualEnergy(newSizeKwp);
            proposalUpdatePayload.carbon_credits = calculateCarbonCredits(newSizeKwp);
          }

          if (hasPhases2 && proposalData?.content) {
            const content = proposalData.content as Record<string, any>;
            proposalUpdatePayload.content = {
              ...content,
              projectInfo: {
                ...(content.projectInfo || {}),
                phases: formData.phases_json,
              },
            };
          }

          if (Object.keys(proposalUpdatePayload).length > 0) {
            await supabase
              .from('proposals')
              .update(proposalUpdatePayload)
              .eq('id', projectOnboardingData.proposal_id);
          }
        }
      }

      // Persist Data Access config and mark it verified (replaces removed in-card "Submit for Audit" button)
      try {
        const daOk = await dataAccessActionsRef.current?.submitForAudit();
        if (daOk === false) {
          // DataAccessTab has already shown a validation toast; abort completion
          return;
        }
      } catch (daErr) {
        logger.warn('Data Access submit-for-audit failed', { error: daErr, projectId });
      }


      const { data: isValid, error: validationError } = await supabase
        .rpc('validate_onboarding_completion', { 
          project_id_param: projectId 
        });

      if (validationError) {
        logger.error("Validation error", { error: validationError, projectId });
        throw validationError;
      }

      logger.info("Validation result", { isValid, projectId });

      if (!isValid) {
        toast({
          title: "Validation Failed",
          description: "Please ensure all required fields and documents are complete before submitting.",
          variant: "destructive",
        });
        return;
      }

      // Role-based completion logic
      if (userRole === 'admin') {
        // ADMIN PATH: Full validation and completion
        const { error: updateError } = await supabase
          .from('project_onboarding')
          .update({
            onboarding_complete: true,
            onboarding_completed_at: new Date().toISOString(),
            admin_validated: true,
            admin_validated_at: new Date().toISOString(),
            admin_validated_by: user.id,
          })
          .eq('id', projectId);

        if (updateError) {
          logger.error("Error updating onboarding status", { error: updateError, projectId });
          throw updateError;
        }

        toast({
          title: "Success",
          description: "Onboarding validated and marked complete!",
        });
      } else {
        // CLIENT/AGENT PATH: Submit for admin review
        const { error: submitError } = await supabase
          .from('project_onboarding')
          .update({
            submitted_for_review: true,
            submitted_for_review_at: new Date().toISOString(),
            submitted_by: user.id,
          })
          .eq('id', projectId);

        if (submitError) {
          logger.error("Error submitting for review", { error: submitError, projectId });
          throw submitError;
        }

        // Notify all admins
        try {
          const adminIds = await getAllAdminUserIds();
          const notificationPromises = adminIds.map(adminId =>
            createNotification({
              userId: adminId,
              title: "Project Ready for Review",
              message: `A project onboarding has been submitted for review by ${user.email}`,
              type: "info",
              relatedId: projectId,
              relatedType: "project_onboarding",
            })
          );

          await Promise.allSettled(notificationPromises);
          logger.info("Admin notifications sent successfully", { projectId });
        } catch (notifError) {
          logger.warn("Error sending notifications", { error: notifError, projectId });
          // Don't fail the submission if notifications fail
        }

        toast({
          title: "Submitted for Review",
          description: "Project marked as complete and admins have been notified for review.",
        });
      }

      onRefresh();
    } catch (error: any) {
      logger.error('Error in handleValidateAndComplete', { error, projectId });

      const isDuplicate = error?.code === '23505' ||
        (typeof error?.message === 'string' && error.message.includes('onboarding_fields_project_id_key'));

      toast({
        title: isDuplicate ? "Already saved, please retry" : "Error",
        description: isDuplicate
          ? "Your onboarding details were already saved. Please press Submit again."
          : "Failed to process request. Please try again.",
        variant: isDuplicate ? "default" : "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getSectionCompletionInfo = (sectionKey: string): { complete: boolean; remaining: number; total: number } => {
    switch (sectionKey) {
      case 'system': {
        const isMultiPhase = formData.phases_json && Array.isArray(formData.phases_json) && formData.phases_json.length > 0;
        // Shared required fields (installer company/email are intentionally optional)
        const sharedRequired: Array<keyof OnboardingFields> = [
          'system_name',
          'system_address',
          'ownership_type',
          'connection_type',
          'alternative_power_source',
          'meter_type',
          'system_gps_lat',
          'system_gps_lng',
        ];
        const isFilled = (key: keyof OnboardingFields) => {
          const v = formData[key];
          if (typeof v === 'number') return !isNaN(v);
          return v !== null && v !== undefined && String(v).trim() !== '';
        };
        let filled = sharedRequired.filter(isFilled).length;
        let total = sharedRequired.length;

        // Dedicated meter requires a calibration certificate
        if (formData.meter_type === 'Discrete') {
          total += 1;
          if (documents.some(d => d.category === 'calibration_cert')) filled += 1;
        }

        if (isMultiPhase) {
          const phases = formData.phases_json as PhaseDetail[];
          total += phases.length;
          filled += phases.filter(p => p.commissionDate && p.commissionDate.trim() !== '').length;
        } else {
          total += 1;
          if (isFilled('commissioning_date')) filled += 1;
        }

        return { complete: filled === total, remaining: total - filled, total };
      }

      case 'inverter': {
        const fields = ['brand', 'model', 'capacity_kw', 'serial'] as const;
        const rowTotal = inverterDetails.length * fields.length;
        let filledCount = 0;
        inverterDetails.forEach(inv => {
          if (inv.brand) filledCount++;
          if (inv.model) filledCount++;
          if (inv.capacity_kw !== null) filledCount++;
          if (inv.serial?.trim()) filledCount++;
        });
        // Include the top-level "Number of Inverters" field in the check.
        const qty = formData.inverter_quantity;
        const qtyFilled = typeof qty === 'number' && qty >= 1;
        const total = rowTotal + 1;
        const filled = filledCount + (qtyFilled ? 1 : 0);
        if (inverterDetails.length === 0) {
          return { complete: false, remaining: 4 + (qtyFilled ? 0 : 1), total: 4 + 1 };
        }
        return { complete: filled === total, remaining: total - filled, total };
      }
      case 'battery': {
        if (formData.has_battery === null || formData.has_battery === undefined) {
          return { complete: false, remaining: 1, total: 1 };
        }
        if (formData.has_battery === false) return { complete: true, remaining: 0, total: 1 };
        const requiredFields = ['battery_brand', 'battery_capacity_kwh', 'battery_cost'];
        const filled = requiredFields.filter(f => formData[f as keyof OnboardingFields]);
        return { complete: filled.length === requiredFields.length, remaining: requiredFields.length - filled.length, total: requiredFields.length };
      }
      case 'panel': {
        const fields = ['brand', 'size_wp', 'quantity', 'total_kwp'] as const;
        const total = panelArrayDetails.length * fields.length;
        let filledCount = 0;
        panelArrayDetails.forEach(arr => {
          if (arr.brand) filledCount++;
          if (arr.size_wp !== null) filledCount++;
          if (arr.quantity !== null) filledCount++;
          if (arr.total_kwp !== null) filledCount++;
        });
        if (panelArrayDetails.length === 0) return { complete: false, remaining: 4, total: 4 };
        return { complete: filledCount === total, remaining: total - filledCount, total };
      }
      case 'financial': {
        const has = !!formData.total_capex;
        return { complete: has, remaining: has ? 0 : 1, total: 1 };
      }
      case 'documents': {
        const hasCoc = documents.some(d => d.category === 'coc');
        const hasInvoice = documents.some(d => d.category === 'invoice');
        const total = 2;
        const filled = (hasCoc ? 1 : 0) + (hasInvoice ? 1 : 0);
        return { complete: filled === total, remaining: total - filled, total };
      }
      case 'om': {
        if (formData.has_maintenance_agreement === null || formData.has_maintenance_agreement === undefined) {
          return { complete: false, remaining: 1, total: 1 };
        }
        if (formData.has_maintenance_agreement === false) return { complete: true, remaining: 0, total: 1 };
        const requiredFields = ['maintenance_agreement_term_years', 'maintenance_cost_annual'];
        const hasDoc = documents.some(d => d.category === 'om_agreement');
        const filledFields = requiredFields.filter(f => formData[f as keyof OnboardingFields]).length;
        const filled = filledFields + (hasDoc ? 1 : 0);
        const total = requiredFields.length + 1;
        return { complete: filled === total, remaining: total - filled, total };
      }
      case 'dataAccess': {
        const verified = !!project?.data_access_verified;
        return { complete: verified, remaining: verified ? 0 : 1, total: 1 };
      }
      default:
        return { complete: false, remaining: 0, total: 0 };
    }
  };

  const sectionKeys = ['system', 'inverter', 'battery', 'panel', 'financial', 'documents', 'om', 'dataAccess'] as const;
  const sectionInfos = Object.fromEntries(sectionKeys.map(k => [k, getSectionCompletionInfo(k)]));
  const completedSections = sectionKeys.filter(k => sectionInfos[k].complete).length;

  const SectionBadge = ({ info }: { info: { complete: boolean; remaining: number } }) => (
    <div className="flex items-center gap-2">
      {!info.complete && (
        <span className="text-xs text-amber-600 font-medium">
          {info.remaining} field{info.remaining !== 1 ? 's' : ''} remaining
        </span>
      )}
      {info.complete ? (
        <CheckCircle2 className="h-5 w-5 text-green-600" />
      ) : (
        <AlertCircle className="h-5 w-5 text-amber-500" />
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span className="font-medium">{completedSections} of {sectionKeys.length} sections complete</span>
          <span>{Math.round((completedSections / sectionKeys.length) * 100)}%</span>
        </div>
        <Progress value={(completedSections / sectionKeys.length) * 100} className="h-2" />
      </div>

      {/* System Details */}
      <Card className={cn("border-l-4", sectionInfos.system.complete ? "border-l-green-500" : "border-l-amber-500")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Details</CardTitle>
              <CardDescription>Basic information about the solar installation</CardDescription>
            </div>
            <SectionBadge info={sectionInfos.system} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="system_name">
                System Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="system_name"
                value={formData.system_name || ''}
                onChange={(e) => handleInputChange('system_name', e.target.value)}
                onBlur={() => handleFieldBlur('system_name')}
                placeholder="e.g., Main Building Solar Array"
                className={cn(touched.system_name && errors.system_name && "border-destructive")}
              />
              <FormError message={touched.system_name ? errors.system_name : undefined} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownership_type">
                Ownership Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.ownership_type || ''}
                onValueChange={(value) => {
                  handleInputChange('ownership_type', value);
                  handleFieldBlur('ownership_type', value);
                }}
              >
                <SelectTrigger
                  id="ownership_type"
                  className={cn(touched.ownership_type && errors.ownership_type && "border-destructive")}
                >
                  <SelectValue placeholder="Select ownership type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Authorised Representative">Authorised Representative</SelectItem>
                  <SelectItem value="Owner">Owner</SelectItem>
                  <SelectItem value="Financed">Financed</SelectItem>
                </SelectContent>
              </Select>
              <FormError message={touched.ownership_type ? errors.ownership_type : undefined} />
            </div>


            <div className="space-y-2">
              <Label htmlFor="system_address">
                System Address <span className="text-destructive">*</span>
              </Label>
              <Input
                id="system_address"
                value={formData.system_address || ''}
                onChange={(e) => handleInputChange('system_address', e.target.value)}
                onBlur={() => handleFieldBlur('system_address')}
                placeholder="123 Main Street"
                className={cn(touched.system_address && errors.system_address && "border-destructive")}
              />
              <FormError message={touched.system_address ? errors.system_address : undefined} />
            </div>

            {/* Multi-Phase Commission Dates - Editable */}
            {formData.phases_json && Array.isArray(formData.phases_json) && formData.phases_json.length > 0 && (
              <div className="col-span-full space-y-2">
                <div className="flex items-center gap-2">
                  <Label>Commission Dates (Multi-Phase Project) <span className="text-destructive">*</span></Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>Edit the commission date for each phase. Changes will sync back to the proposal.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="p-4 bg-muted rounded-lg space-y-3">
                  {(formData.phases_json as PhaseDetail[]).map((phase, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-3 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {phase.phaseName || `Phase ${phase.phaseNumber}`}
                        </Label>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Commission Date</Label>
                        <Input
                          type="date"
                          value={phase.commissionDate || ''}
                          onChange={(e) => {
                            const newPhases = [...(formData.phases_json as PhaseDetail[])];
                            newPhases[idx] = { ...newPhases[idx], commissionDate: e.target.value };
                            setFormData(prev => ({ ...prev, phases_json: newPhases }));
                          }}
                          className={cn(!phase.commissionDate && "border-destructive")}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 border-t mt-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">Earliest Commission Date:</span>
                    <span className="font-semibold">
                      {(() => {
                        const dates = (formData.phases_json as PhaseDetail[])
                          .filter(p => p.commissionDate)
                          .map(p => new Date(p.commissionDate).getTime());
                        return dates.length > 0 
                          ? new Date(Math.min(...dates)).toLocaleDateString() 
                          : 'Not set';
                      })()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Single Commission Date Field - only show for single-phase projects */}
            {(!(formData.phases_json && Array.isArray(formData.phases_json) && formData.phases_json.length > 0)) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="commissioning_date">
                    Commissioning or Installation Date <span className="text-destructive">*</span>
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>The Commissioning or installation date is not necessarily the day the system was physically installed, but rather the day the system first produced solar electricity.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="commissioning_date"
                  type="date"
                  value={formData.commissioning_date || ''}
                  onChange={(e) => handleInputChange('commissioning_date', e.target.value)}
                  onBlur={() => handleFieldBlur('commissioning_date')}
                  max={new Date().toISOString().split('T')[0]}
                  min="2022-09-15"
                  className={cn(touched.commissioning_date && errors.commissioning_date && "border-destructive")}
                />
                <FormError message={touched.commissioning_date ? errors.commissioning_date : undefined} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="installer_select">EPC or Solar Installer Company Name</Label>
              <Select
                value={formData.installer_id || 'new'}
                onValueChange={handleInstallerSelect}
              >
                <SelectTrigger id="installer_select">
                  <SelectValue placeholder="Select installer or add new" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ Add New Installer</SelectItem>
                  {installers.map((installer) => (
                    <SelectItem key={installer.id} value={installer.id}>
                      {installer.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(!formData.installer_id || formData.installer_id === 'new') && (
                <Input
                  id="installer_company_name"
                  value={formData.installer_company_name || ''}
                  onChange={(e) => handleInputChange('installer_company_name', e.target.value)}
                  placeholder="Enter company name"
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="installer_email">EPC or Solar Installer Email Address</Label>
              <Input
                id="installer_email"
                type="email"
                value={formData.installer_email || ''}
                onChange={(e) => handleInputChange('installer_email', e.target.value)}
                onBlur={() => handleFieldBlur('installer_email')}
                placeholder="installer@example.com"
                className={cn(touched.installer_email && errors.installer_email && "border-destructive")}
              />
              <FormError message={touched.installer_email ? errors.installer_email : undefined} />
              {(!formData.installer_id || formData.installer_id === 'new') && formData.installer_company_name && formData.installer_email && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCreateNewInstaller(formData.installer_company_name!, formData.installer_email!)}
                  className="mt-2"
                >
                  Save as New Installer
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="system_gps_lat">
                  GPS Latitude <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={geocoding || !formData.system_address}
                  onClick={handleLocateFromAddress}
                >
                  {geocoding ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MapPin className="h-3 w-3 mr-1" />}
                  Locate from address
                </Button>
              </div>
              <Input
                id="system_gps_lat"
                type="number"
                step="0.000001"
                value={formData.system_gps_lat ?? ''}
                onChange={(e) => handleInputChange('system_gps_lat', e.target.value === '' ? null : parseFloat(e.target.value))}
                onBlur={() => handleFieldBlur('system_gps_lat')}
                placeholder="-26.2041"
                className={cn(touched.system_gps_lat && errors.system_gps_lat && "border-destructive")}
              />
              <FormError message={touched.system_gps_lat ? errors.system_gps_lat : undefined} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="system_gps_lng">
                GPS Longitude <span className="text-destructive">*</span>
              </Label>
              <Input
                id="system_gps_lng"
                type="number"
                step="0.000001"
                value={formData.system_gps_lng ?? ''}
                onChange={(e) => handleInputChange('system_gps_lng', e.target.value === '' ? null : parseFloat(e.target.value))}
                onBlur={() => handleFieldBlur('system_gps_lng')}
                placeholder="28.0473"
                className={cn(touched.system_gps_lng && errors.system_gps_lng && "border-destructive")}
              />
              <FormError message={touched.system_gps_lng ? errors.system_gps_lng : undefined} />
            </div>


            <div className="space-y-2">
              <Label htmlFor="connection_type">
                Connection Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.connection_type || ''}
                onValueChange={(value) => {
                  handleInputChange('connection_type', value);
                  handleFieldBlur('connection_type', value);
                }}
              >
                <SelectTrigger
                  id="connection_type"
                  className={cn(touched.connection_type && errors.connection_type && "border-destructive")}
                >
                  <SelectValue placeholder="Select connection type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Residential">Residential</SelectItem>
                  <SelectItem value="Commercial">Commercial</SelectItem>
                  <SelectItem value="Agricultural">Agricultural</SelectItem>
                  <SelectItem value="Industrial">Industrial</SelectItem>
                </SelectContent>
              </Select>
              <FormError message={touched.connection_type ? errors.connection_type : undefined} />
            </div>


            <div className="space-y-2">
              <Label htmlFor="alternative_power_source">
                Alternative Power Source <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.alternative_power_source || ''}
                onValueChange={(value) => {
                  handleInputChange('alternative_power_source', value);
                  handleFieldBlur('alternative_power_source', value);
                }}
              >
                <SelectTrigger
                  id="alternative_power_source"
                  className={cn(touched.alternative_power_source && errors.alternative_power_source && "border-destructive")}
                >
                  <SelectValue placeholder="Select power source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Eskom">Eskom</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                  <SelectItem value="None">None / Not applicable</SelectItem>
                </SelectContent>
              </Select>
              <FormError message={touched.alternative_power_source ? errors.alternative_power_source : undefined} />
            </div>


            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="meter_type">
                  Meter Type <span className="text-destructive">*</span>
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>If we are using your inverter only select SSEG. Only choose Dedicated if you have a dedicated energy meter to measuring how much power your solar system produces. The SSEG usually refers to the inverter itself, so select SSEG, which also means your inverter shall be listed on the national or provincial government's official SSEG list.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Select
                value={formData.meter_type || ''}
                onValueChange={(value) => {
                  handleInputChange('meter_type', value);
                  handleFieldBlur('meter_type', value);
                }}
              >
                <SelectTrigger
                  id="meter_type"
                  className={cn(touched.meter_type && errors.meter_type && "border-destructive")}
                >
                  <SelectValue placeholder="Select meter type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SSEG">SSEG</SelectItem>
                  <SelectItem value="Discrete">Dedicated Meter</SelectItem>
                </SelectContent>
              </Select>
              <FormError message={touched.meter_type ? errors.meter_type : undefined} />
            </div>

          </div>

          {formData.meter_type === "Discrete" && (
            <OnboardingFileUpload
              projectId={projectId}
              category="calibration_cert"
              documents={documents}
              onUploadComplete={fetchDocuments}
              label="Meter Calibration Certificate for Meter (Filename, .pdf / .jpg)"
            />
          )}
        </CardContent>
      </Card>

      {/* Inverter Details */}
      <Card className={cn("border-l-4", sectionInfos.inverter.complete ? "border-l-green-500" : "border-l-amber-500")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Inverter Details</CardTitle>
              <CardDescription>Information about the inverter installation</CardDescription>
            </div>
            <SectionBadge info={sectionInfos.inverter} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Number of Inverters */}
          <div className="max-w-xs">
            <div className="space-y-2">
              <Label htmlFor="inverter_quantity">
                Number of Inverters <span className="text-destructive">*</span>
              </Label>
              <Input
                id="inverter_quantity"
                type="number"
                min="1"
                max="100"
                value={
                  typeof formData.inverter_quantity === 'number' && formData.inverter_quantity >= 1
                    ? formData.inverter_quantity
                    : ''
                }
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') {
                    // Leave empty so validation can flag it — do not silently coerce to 1
                    handleInputChange('inverter_quantity', undefined as any);
                    return;
                  }
                  const val = parseInt(raw);
                  if (!isNaN(val) && val >= 1 && val <= 100) {
                    handleInputChange('inverter_quantity', val);
                  }
                }}
                onBlur={() => handleFieldBlur('inverter_quantity')}
                placeholder="Number of Inverters"
                className={cn(
                  (touched.inverter_quantity || showValidationSummary) &&
                    errors.inverter_quantity &&
                    "border-destructive"
                )}
              />
              <FormError
                message={
                  (touched.inverter_quantity || showValidationSummary)
                    ? errors.inverter_quantity
                    : undefined
                }
              />

            </div>
          </div>

          {/* Dynamic Inverter Rows */}
          <div className="space-y-3">
            {inverterDetails.map((inverter, index) => (
              <InverterDetailsRow
                key={index}
                index={index}
                inverter={inverter}
                onChange={handleInverterDetailChange}
                onBlur={handleInverterDetailBlur}
                showLabels={index === 0}
                errors={errors}
              />
            ))}
          </div>

          {/* Remaining fields in grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="inverter_cost">Total Cost Installed incl. VAT & Labour for Inverter(s) (Rands)</Label>
              <Input
                id="inverter_cost"
                type="number"
                step="0.01"
                value={formData.inverter_cost || ''}
                onChange={(e) => handleInputChange('inverter_cost', parseFloat(e.target.value))}
                placeholder="50000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_collector_present">Data Collector or Dongle</Label>
              <Select
                value={formData.data_collector_present || ''}
                onValueChange={(value) => handleInputChange('data_collector_present', value)}
              >
                <SelectTrigger id="data_collector_present">
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.data_collector_present === "yes" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="data_collector_serial">Data Collector or Dongle Serial Number</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p>If we need to collect production data directly from the inverter we need to know the dongle serial number. This is normally somewhere on the dongle itself, but might also be on your invoice.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Input
                  id="data_collector_serial"
                  type="text"
                  value={formData.data_collector_serial || ''}
                  onChange={(e) => handleInputChange('data_collector_serial', e.target.value)}
                  placeholder="Enter serial number"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Battery Details */}
      <Card className={cn("border-l-4", sectionInfos.battery.complete ? "border-l-green-500" : "border-l-amber-500")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Battery Details</CardTitle>
              <CardDescription>Information about battery storage if installed</CardDescription>
            </div>
            <SectionBadge info={sectionInfos.battery} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="has_battery">Do you have a battery?</Label>
            <Select
              value={formData.has_battery === null || formData.has_battery === undefined ? '' : String(formData.has_battery)}
              onValueChange={(value) => handleInputChange('has_battery', value === 'true')}
            >
              <SelectTrigger id="has_battery">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.has_battery === true && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="battery_brand">
                  Battery Brand
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Select
                  value={formData.battery_brand || ''}
                  onValueChange={(value) => handleInputChange('battery_brand', value)}
                >
                  <SelectTrigger id="battery_brand">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="Alpha-ESS">Alpha-ESS</SelectItem>
                    <SelectItem value="Dyness">Dyness</SelectItem>
                    <SelectItem value="Fox ESS">Fox ESS</SelectItem>
                    <SelectItem value="Freedom Won">Freedom Won</SelectItem>
                    <SelectItem value="Greenrich">Greenrich</SelectItem>
                    <SelectItem value="Hubble Energy">Hubble Energy</SelectItem>
                    <SelectItem value="i-G3N">i-G3N</SelectItem>
                    <SelectItem value="Pylontech">Pylontech</SelectItem>
                    <SelectItem value="Revov">Revov</SelectItem>
                    <SelectItem value="Solar MD">Solar MD</SelectItem>
                    <SelectItem value="SigEnergy">SigEnergy</SelectItem>
                    <SelectItem value="Sunsynk">Sunsynk</SelectItem>
                    <SelectItem value="Volta">Volta</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="battery_capacity_kwh">
                  Total Battery Capacity (kWh)
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="battery_capacity_kwh"
                  type="number"
                  step="0.01"
                  value={formData.battery_capacity_kwh || ''}
                  onChange={(e) => handleInputChange('battery_capacity_kwh', parseFloat(e.target.value))}
                  placeholder="13.5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="battery_cost">
                  Total Cost Installed incl. VAT & Labour for Batteries (Rands)
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Input
                  id="battery_cost"
                  type="number"
                  step="0.01"
                  value={formData.battery_cost || ''}
                  onChange={(e) => handleInputChange('battery_cost', parseFloat(e.target.value))}
                  placeholder="80000"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel Details */}
      <Card className={cn("border-l-4", sectionInfos.panel.complete ? "border-l-green-500" : "border-l-amber-500")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Panel Details</CardTitle>
              <CardDescription>Information about the solar panels</CardDescription>
            </div>
            <SectionBadge info={sectionInfos.panel} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Number of Arrays selector */}
          <div className="space-y-2">
            <Label htmlFor="panel_array_count">Number of Panel Arrays</Label>
            <Input
              id="panel_array_count"
              type="number"
              min="1"
              max="10"
              value={panelArrayCount}
              onChange={(e) => {
                const value = Math.min(10, Math.max(1, parseInt(e.target.value) || 1));
                setPanelArrayCount(value);
              }}
              className="w-32"
            />
          </div>

          {/* Dynamic panel array rows */}
          <div className="space-y-3">
            {panelArrayDetails.map((panel, index) => (
              <PanelArrayDetailsRow
                key={index}
                index={index}
                panel={panel}
                onChange={handlePanelArrayDetailChange}
                onBlur={handlePanelArrayDetailBlur}
                showLabels={index === 0}
                errors={errors}
              />
            ))}
          </div>

          {/* Aggregate totals display */}
          {panelArrayDetails.length > 0 && (
            <div className="pt-4 border-t">
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="bg-muted/50 px-3 py-2 rounded-md">
                  <span className="text-muted-foreground">Total Panels:</span>{" "}
                  <span className="font-medium">{formData.panel_quantity || 0}</span>
                </div>
                <div className="bg-muted/50 px-3 py-2 rounded-md">
                  <span className="text-muted-foreground">Total System:</span>{" "}
                  <span className="font-medium">{formData.panel_total_kwp || 0} kWp</span>
                </div>
              </div>
            </div>
          )}

          {/* Panel cost input */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <Label htmlFor="panel_cost">Total Cost Installed incl. VAT & Labour for Solar Panels (Rands)</Label>
              <Input
                id="panel_cost"
                type="number"
                step="0.01"
                value={formData.panel_cost || ''}
                onChange={(e) => handleInputChange('panel_cost', parseFloat(e.target.value))}
                placeholder="150000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial */}
      <Card className={cn("border-l-4", sectionInfos.financial.complete ? "border-l-green-500" : "border-l-amber-500")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Financial Details</CardTitle>
              <CardDescription>Cost breakdown and CAPEX information</CardDescription>
            </div>
            <SectionBadge info={sectionInfos.financial} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="total_capex">Total Cost Installed incl. VAT & Labour (Rands)</Label>
              <Input
                id="total_capex"
                type="number"
                step="0.01"
                value={formData.total_capex || ''}
                readOnly
                className="bg-muted cursor-not-allowed"
                placeholder="Auto-calculated from component costs"
              />
              <p className="text-xs text-muted-foreground">
                Auto-calculated from Inverter + Battery + Panel costs
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Documentation */}
      <Card className={cn("border-l-4", sectionInfos.documents.complete ? "border-l-green-500" : "border-l-amber-500")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle>Project Documentation</CardTitle>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <p>To ensure your system is fully compliant with all legal and audit requirements, we need two key documents: a Certificate of Compliance (COC) and your system invoice(s). The COC must clearly show the system address, be signed and dated — if you don't have one, we can connect you with a trusted electrical contractor. Please upload the COC as a PDF or clear photo, along with your invoice or proof of payment showing the total system cost.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <CardDescription>Upload required project documents</CardDescription>
            </div>
            <SectionBadge info={sectionInfos.documents} />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <OnboardingFileUpload
            projectId={projectId}
            category="coc"
            documents={documents}
            onUploadComplete={fetchDocuments}
            label="Certificate of Compliance (CoC)"
          />

          <OnboardingFileUpload
            projectId={projectId}
            category="invoice"
            documents={documents}
            onUploadComplete={fetchDocuments}
            label="Final Invoice (Total Installed Cost)"
          />

          <OnboardingFileUpload
            projectId={projectId}
            category="invoice"
            documents={documents}
            onUploadComplete={fetchDocuments}
            label="Other Project Costs (Any additional invoices or costs spent on project)"
          />

          <OnboardingFileUpload
            projectId={projectId}
            category="invoice"
            documents={documents}
            onUploadComplete={fetchDocuments}
            label="Other Project Costs (Any additional invoices or costs spent on project)"
          />

          <OnboardingFileUpload
            projectId={projectId}
            category="invoice"
            documents={documents}
            onUploadComplete={fetchDocuments}
            label="Proof of Insurance (If you are spending on insurance)"
          />
        </CardContent>
      </Card>

      {/* O&M Agreement */}
      <Card className={cn("border-l-4", sectionInfos.om.complete ? "border-l-green-500" : "border-l-amber-500")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Operations & Maintenance</CardTitle>
              <CardDescription>Maintenance agreement details</CardDescription>
            </div>
            <SectionBadge info={sectionInfos.om} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="has_maintenance_agreement">Do you have a maintenance agreement?</Label>
            <Select
              value={formData.has_maintenance_agreement === null || formData.has_maintenance_agreement === undefined ? '' : String(formData.has_maintenance_agreement)}
              onValueChange={(value) => handleInputChange('has_maintenance_agreement', value === 'true')}
            >
              <SelectTrigger id="has_maintenance_agreement">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="true">Yes</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.has_maintenance_agreement === true && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maintenance_agreement_term_years">
                    Agreement Term (Years)
                    {formData.has_maintenance_agreement && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id="maintenance_agreement_term_years"
                    type="number"
                    value={formData.maintenance_agreement_term_years || ''}
                    onChange={(e) => handleInputChange('maintenance_agreement_term_years', parseInt(e.target.value))}
                    placeholder="5"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maintenance_cost_annual">
                    Annual Cost (R)
                    {formData.has_maintenance_agreement && <span className="text-destructive ml-1">*</span>}
                  </Label>
                  <Input
                    id="maintenance_cost_annual"
                    type="number"
                    step="0.01"
                    value={formData.maintenance_cost_annual || ''}
                    onChange={(e) => handleInputChange('maintenance_cost_annual', parseFloat(e.target.value))}
                    placeholder="25000"
                  />
                </div>
              </div>

              <div>
                <Label>
                  O&M Agreement
                  {formData.has_maintenance_agreement && <span className="text-destructive ml-1">*</span>}
                </Label>
                <OnboardingFileUpload
                  projectId={projectId}
                  category="om_agreement"
                  documents={documents}
                  onUploadComplete={fetchDocuments}
                  label="O&M Agreement"
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Data Access */}
      <Card className={cn("border-l-4", sectionInfos.dataAccess.complete ? "border-l-green-500" : "border-l-amber-500")}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Data Access</CardTitle>
              <CardDescription>
                Required for Audit Ready — configure inverter/meter data access and run a successful connection test.
              </CardDescription>
            </div>
            <SectionBadge info={sectionInfos.dataAccess} />
          </div>
        </CardHeader>
        <CardContent>
          <DataAccessTab
            projectId={projectId}
            onRefresh={onRefresh}
            registerActions={(actions) => { dataAccessActionsRef.current = actions; }}
          />

        </CardContent>
      </Card>

      {/* Validation Summary - shown when trying to submit with errors */}
      {showValidationSummary && hasErrors && (
        <ValidationSummary 
          errors={getAllErrors(formData, inverterDetails, panelArrayDetails)} 
          title="Please fix the following issues before submitting"
        />
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSaveDraft}
          variant="outline"
          disabled={isSaving}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Draft
        </Button>
        
        {userRole === 'admin' ? (
          <Button
            onClick={handleValidateAndComplete}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Validate & Mark Complete
          </Button>
        ) : project?.submitted_for_review ? (
          <Button disabled variant="secondary">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Submitted - Awaiting Admin Review
          </Button>
        ) : (
          <Button
            onClick={handleValidateAndComplete}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mark Complete - Ready for Review
          </Button>
        )}
      </div>
    </div>
  );
}
