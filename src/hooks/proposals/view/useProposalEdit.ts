
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  ProposalData,
  ClientInformation,
  ProjectInformation,
  AdditionalClient,
  AnnualKwhByYear,
  GenerationInputMode,
  GENERATION_YEARS,
} from '@/types/proposals';
import { calculateAnnualEnergy, calculateCarbonCredits } from '@/services/calculations/carbon/calculations';
import { normalizeToKWp } from '@/services/calculations/carbon/validation';

import { EMISSION_FACTOR } from '@/lib/calculations/carbon/constants';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth';
import { isSelfAsClient, SELF_AS_CLIENT_MESSAGE } from '@/lib/validation/selfAsClient';

export interface PhaseFormData {
  phaseName: string;
  sizeKWp: string;
  commissionDate: string;
  annualKwhByYear?: AnnualKwhByYear;
}

export interface ProposalEditFormData {
  // Client info
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientCompanyName: string;
  primaryClientId: string | null;
  // Additional clients
  additionalClients: AdditionalClient[];
  // Project info
  projectName: string;
  projectAddress: string;
  systemSize: string;
  commissionDate: string;
  additionalNotes: string;
  // Multi-phase
  phases: PhaseFormData[];
  isMultiPhase: boolean;
  // Generation mode
  generationInputMode: GenerationInputMode;
  annualKwhByYear: AnnualKwhByYear;
}

function extractPhases(projectInfo: any): PhaseFormData[] {
  const phases = projectInfo?.phases;
  if (!Array.isArray(phases) || phases.length <= 1) return [];
  return phases.map((p: any, i: number) => ({
    phaseName: p.phaseName || p.name || `Phase ${i + 1}`,
    sizeKWp: p.sizeKWp != null ? String(p.sizeKWp) : '',
    commissionDate: p.commissionDate || '',
    annualKwhByYear: p.annualKwhByYear || {},
  }));
}

function extractFormData(proposal: ProposalData): ProposalEditFormData {
  const snapshotClientInfo = proposal.content?.clientInfo || {} as ClientInformation;
  const projectInfo = proposal.content?.projectInfo || {} as ProjectInformation;
  const phases = extractPhases(projectInfo);
  const isMultiPhase = phases.length > 1;
  const liveClient = proposal.client;

  let clientName = snapshotClientInfo.name
    || [(snapshotClientInfo as any).firstName, (snapshotClientInfo as any).lastName]
        .filter((n: any) => n && n !== 'null')
        .join(' ')
    || '';
  let clientEmail = snapshotClientInfo.email || '';
  let clientPhone = snapshotClientInfo.phone || '';
  let clientCompanyName = snapshotClientInfo.companyName || '';

  if (liveClient && proposal.client_reference_id) {
    const liveName = [liveClient.first_name, liveClient.last_name].filter(Boolean).join(' ').trim();
    if (liveName) clientName = liveName;
    if (liveClient.email) clientEmail = liveClient.email;
    if (liveClient.phone) clientPhone = liveClient.phone;
    if (liveClient.company_name) clientCompanyName = liveClient.company_name;
  }

  return {
    clientName,
    clientEmail,
    clientPhone,
    clientCompanyName,
    primaryClientId: proposal.client_reference_id || null,
    additionalClients: (proposal.content?.additionalClients || []).map(c => ({ ...c })),
    projectName: projectInfo.name || '',
    projectAddress: projectInfo.address || '',
    systemSize: String(
      projectInfo.size
      || (projectInfo as any).totalSystemSize
      || proposal.system_size_kwp
      || ''
    ),
    commissionDate: projectInfo.commissionDate || '',
    additionalNotes: projectInfo.additionalNotes || '',
    phases,
    isMultiPhase,
    generationInputMode: (projectInfo.generationInputMode as GenerationInputMode) || 'kwp',
    annualKwhByYear: projectInfo.annualKwhByYear || {},
  };
}

interface ValidationErrors {
  [key: string]: string;
}

function hasAnyKwh(grid: AnnualKwhByYear | undefined): boolean {
  if (!grid) return false;
  return Object.values(grid).some((v) => (v || 0) > 0);
}

function validate(
  data: ProposalEditFormData,
  currentUser?: { email?: string | null; role?: string | null }
): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.clientName.trim()) errors.clientName = 'Client name is required';
  if (!data.clientEmail.trim()) {
    errors.clientEmail = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.clientEmail)) {
    errors.clientEmail = 'Invalid email format';
  } else if (isSelfAsClient(data.clientEmail, currentUser?.email, currentUser?.role)) {
    errors.clientEmail = SELF_AS_CLIENT_MESSAGE;
  }
  if (!data.projectName.trim()) errors.projectName = 'Project name is required';

  data.additionalClients.forEach((client, i) => {
    if (!client.name.trim()) errors[`addClient_${i}_name`] = 'Name is required';
    if (!client.email.trim()) {
      errors[`addClient_${i}_email`] = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.email)) {
      errors[`addClient_${i}_email`] = 'Invalid email format';
    } else if (isSelfAsClient(client.email, currentUser?.email, currentUser?.role)) {
      errors[`addClient_${i}_email`] = SELF_AS_CLIENT_MESSAGE;
    }
  });

  const isKwh = data.generationInputMode === 'kwh';

  if (data.isMultiPhase) {
    data.phases.forEach((phase, i) => {
      if (isKwh) {
        if (!hasAnyKwh(phase.annualKwhByYear)) {
          errors[`phase_${i}_kwh`] = `${phase.phaseName} needs at least one year of kWh`;
        }
        if (!phase.commissionDate) {
          errors[`phase_${i}_date`] = `${phase.phaseName} commission date is required`;
        }
      } else {
        if (!phase.sizeKWp.trim()) {
          errors[`phase_${i}_size`] = `${phase.phaseName} size is required`;
        } else if (parseFloat(phase.sizeKWp) <= 0 || isNaN(parseFloat(phase.sizeKWp))) {
          errors[`phase_${i}_size`] = `${phase.phaseName} size must be a positive number`;
        }
      }
    });
  } else if (isKwh) {
    if (!hasAnyKwh(data.annualKwhByYear)) {
      errors.annualKwh = 'Enter at least one year of estimated kWh';
    }
    if (!data.commissionDate) {
      errors.commissionDate = 'Commission date is required';
    }
  } else {
    const sizeStr = String(data.systemSize || '');
    if (!sizeStr.trim()) {
      errors.systemSize = 'System size is required';
    } else if (parseFloat(sizeStr) <= 0 || isNaN(parseFloat(sizeStr))) {
      errors.systemSize = 'System size must be a positive number';
    }
  }
  return errors;
}

async function syncAdditionalClientsJunction(proposalId: string, additionalClients: AdditionalClient[]) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('proposal_clients')
      .delete()
      .eq('proposal_id', proposalId);

    if (additionalClients.length === 0) return;

    const rows = [];
    for (const client of additionalClients) {
      let clientId = client.clientId;

      if (!clientId) {
        const { data: existing } = await supabase
          .from('clients')
          .select('id')
          .eq('email', client.email.trim())
          .maybeSingle();

        if (existing) {
          clientId = existing.id;
        } else {
          const nameParts = client.name.trim().split(/\s+/);
          const lastName = nameParts.length > 1 ? nameParts.pop()! : '';
          const firstName = nameParts.join(' ');

          const { data: newClient } = await supabase
            .from('clients')
            .insert({
              first_name: firstName,
              last_name: lastName,
              email: client.email.trim(),
              phone: client.phone?.trim() || null,
              company_name: client.companyName?.trim() || null,
              created_by: user.id,
            })
            .select('id')
            .single();

          if (newClient) clientId = newClient.id;
        }
      }

      if (clientId) {
        rows.push({
          proposal_id: proposalId,
          client_id: clientId,
          added_by: user.id,
        });
      }
    }

    if (rows.length > 0) {
      const { error } = await supabase.from('proposal_clients').insert(rows);
      if (error) console.warn('Failed to sync proposal_clients:', error.message);
    }
  } catch (err) {
    console.warn('Exception syncing additional clients junction:', err);
  }
}

function sumGridKwh(grid: AnnualKwhByYear | undefined): number {
  if (!grid) return 0;
  return Object.values(grid).reduce((s: number, v) => s + (Number(v) || 0), 0);
}

export function useProposalEdit(proposal: ProposalData, onSuccess?: () => void) {
  const [formData, setFormData] = useState<ProposalEditFormData>(() => extractFormData(proposal));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saving, setSaving] = useState(false);
  const { profile, user } = useAuth();
  const currentUser = { email: profile?.email || user?.email, role: profile?.role };

  const resetForm = () => {
    setFormData(extractFormData(proposal));
    setErrors({});
  };

  const updateField = (field: keyof ProposalEditFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const updateMode = (mode: GenerationInputMode) => {
    setFormData(prev => ({ ...prev, generationInputMode: mode }));
    setErrors({});
  };

  const updateAnnualKwh = (next: AnnualKwhByYear) => {
    setFormData(prev => ({ ...prev, annualKwhByYear: next }));
    if (errors.annualKwh) {
      setErrors(prev => {
        const n = { ...prev };
        delete n.annualKwh;
        return n;
      });
    }
  };

  const updatePhase = (index: number, field: keyof PhaseFormData, value: any) => {
    setFormData(prev => {
      const newPhases = [...prev.phases];
      newPhases[index] = { ...newPhases[index], [field]: value };
      return { ...prev, phases: newPhases };
    });
    setErrors(prev => {
      const next = { ...prev };
      delete next[`phase_${index}_size`];
      delete next[`phase_${index}_kwh`];
      delete next[`phase_${index}_date`];
      return next;
    });
  };

  const updatePhaseAnnualKwh = (index: number, next: AnnualKwhByYear) => {
    updatePhase(index, 'annualKwhByYear', next);
  };

  const addAdditionalClient = () => {
    setFormData(prev => ({
      ...prev,
      additionalClients: [...prev.additionalClients, { name: '', email: '', phone: '', companyName: '' }],
    }));
  };

  const updateAdditionalClient = (index: number, client: AdditionalClient) => {
    setFormData(prev => {
      const updated = [...prev.additionalClients];
      updated[index] = client;
      return { ...prev, additionalClients: updated };
    });
    setErrors(prev => {
      const next = { ...prev };
      delete next[`addClient_${index}_name`];
      delete next[`addClient_${index}_email`];
      return next;
    });
  };

  const removeAdditionalClient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      additionalClients: prev.additionalClients.filter((_, i) => i !== index),
    }));
  };

  const makePrimary = async (index: number) => {
    const target = formData.additionalClients[index];
    if (!target) return;

    let liveTarget = target;
    if (target.clientId) {
      try {
        const { data: liveClient } = await supabase
          .from('clients')
          .select('first_name, last_name, email, phone, company_name')
          .eq('id', target.clientId)
          .single();

        if (liveClient) {
          const liveName = [liveClient.first_name, liveClient.last_name].filter(Boolean).join(' ').trim();
          liveTarget = {
            ...target,
            name: liveName || target.name,
            email: liveClient.email || target.email,
            phone: liveClient.phone || target.phone || '',
            companyName: liveClient.company_name || target.companyName || '',
          };
        }
      } catch (err) {
        console.warn('Failed to fetch live client data for makePrimary, using form data', err);
      }
    }

    setFormData(prev => {
      const demotedPrimary: AdditionalClient = {
        name: prev.clientName,
        email: prev.clientEmail,
        phone: prev.clientPhone,
        companyName: prev.clientCompanyName,
        clientId: prev.primaryClientId || undefined,
      };

      const newAdditional = prev.additionalClients.filter((_, i) => i !== index);
      newAdditional.push(demotedPrimary);

      return {
        ...prev,
        clientName: liveTarget.name,
        clientEmail: liveTarget.email,
        clientPhone: liveTarget.phone || '',
        clientCompanyName: liveTarget.companyName || '',
        primaryClientId: liveTarget.clientId || null,
        additionalClients: newAdditional,
      };
    });
  };

  const computedTotalSize = (): number => {
    if (!formData.isMultiPhase) return parseFloat(formData.systemSize) || 0;
    return formData.phases.reduce((sum, p) => sum + (parseFloat(p.sizeKWp) || 0), 0);
  };

  const save = async (): Promise<boolean> => {
    const validationErrors = validate(formData, currentUser);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please fix the highlighted fields before saving.');
      return false;
    }

    setSaving(true);
    try {
      const isKwh = formData.generationInputMode === 'kwh';
      const newSystemSize = computedTotalSize();
      const oldContent = proposal.content || {} as any;
      const oldProjectInfo = oldContent.projectInfo || {};

      // Build updated phases if multi-phase
      let updatedPhases = oldProjectInfo.phases;
      if (formData.isMultiPhase && Array.isArray(oldProjectInfo.phases)) {
        updatedPhases = oldProjectInfo.phases.map((p: any, i: number) => {
          const edited = formData.phases[i];
          if (!edited) return p;
          const base = {
            ...p,
            phaseName: edited.phaseName,
            commissionDate: edited.commissionDate,
          };
          if (isKwh) {
            return {
              ...base,
              annualKwhByYear: edited.annualKwhByYear || {},
              // preserve existing sizeKWp so user can switch back to kWp mode without data loss
            };
          }
          return {
            ...base,
            sizeKWp: parseFloat(edited.sizeKWp) || 0,
            annualKwhByYear: undefined,
          };
        });
      }

      const updatedProjectInfoContent: any = {
        ...oldProjectInfo,
        name: formData.projectName.trim(),
        address: formData.projectAddress.trim(),
        additionalNotes: formData.additionalNotes.trim(),
        generationInputMode: formData.generationInputMode,
        ...(updatedPhases ? { phases: updatedPhases } : {}),
      };

      if (isKwh) {
        if (formData.isMultiPhase) {
          updatedProjectInfoContent.annualKwhByYear = undefined;
          updatedProjectInfoContent.size = '';
        } else {
          updatedProjectInfoContent.annualKwhByYear = formData.annualKwhByYear;
          updatedProjectInfoContent.size = '';
          updatedProjectInfoContent.totalSystemSize = undefined;
          updatedProjectInfoContent.commissionDate = formData.commissionDate;
        }
      } else {
        updatedProjectInfoContent.annualKwhByYear = undefined;
        if (formData.isMultiPhase) {
          updatedProjectInfoContent.size = '';
          updatedProjectInfoContent.totalSystemSize = newSystemSize;
        } else {
          updatedProjectInfoContent.size = String(normalizeToKWp(String(formData.systemSize || '').trim()) || '');
          updatedProjectInfoContent.commissionDate = formData.commissionDate;
        }
      }

      const updatedContent = {
        ...oldContent,
        clientInfo: {
          ...oldContent.clientInfo,
          name: formData.clientName.trim(),
          firstName: formData.clientName.trim().split(/\s+/).slice(0, -1).join(' ') || formData.clientName.trim(),
          lastName: formData.clientName.trim().split(/\s+/).pop() || '',
          email: formData.clientEmail.trim(),
          phone: formData.clientPhone.trim(),
          companyName: formData.clientCompanyName.trim(),
        },
        additionalClients: formData.additionalClients.map(c => ({
          name: c.name.trim(),
          email: c.email.trim(),
          phone: c.phone?.trim() || '',
          companyName: c.companyName?.trim() || '',
          clientId: c.clientId,
        })),
        projectInfo: updatedProjectInfoContent,
      };

      const existingProjectInfo = (proposal as any).project_info;
      const updatedProjectInfo = {
        ...(typeof existingProjectInfo === 'object' && existingProjectInfo !== null ? existingProjectInfo : {}),
        name: formData.projectName.trim(),
        address: formData.projectAddress.trim(),
        size: isKwh ? '' : (formData.isMultiPhase ? String(newSystemSize) : String(normalizeToKWp(String(formData.systemSize || '').trim()) || '')),
        commission_date: isKwh && !formData.isMultiPhase ? (formData.commissionDate || null) : (formData.isMultiPhase ? null : formData.commissionDate),
        commissionDate: formData.isMultiPhase || (isKwh && !formData.commissionDate) ? '' : formData.commissionDate,
        generationInputMode: formData.generationInputMode,
      };

      // Compute summary metrics
      let annualEnergy: number;
      let carbonCredits: number;
      if (isKwh) {
        let totalKwh = 0;
        let yearCount = 0;
        if (formData.isMultiPhase) {
          for (const p of formData.phases) {
            const sum = sumGridKwh(p.annualKwhByYear);
            totalKwh += sum;
            const yrs = Object.values(p.annualKwhByYear || {}).filter((v) => (v || 0) > 0).length;
            if (yrs > yearCount) yearCount = yrs;
          }
        } else {
          totalKwh = sumGridKwh(formData.annualKwhByYear);
          yearCount = Object.values(formData.annualKwhByYear || {}).filter((v) => (v || 0) > 0).length;
        }
        const denom = yearCount > 0 ? yearCount : GENERATION_YEARS.length;
        annualEnergy = totalKwh / denom;
        carbonCredits = (annualEnergy / 1000) * EMISSION_FACTOR;
      } else {
        annualEnergy = calculateAnnualEnergy(newSystemSize);
        carbonCredits = calculateCarbonCredits(newSystemSize);
      }

      const primaryChanged = formData.primaryClientId !== proposal.client_reference_id;
      let resolvedPrimaryClientId = formData.primaryClientId;

      if (primaryChanged && !resolvedPrimaryClientId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error('You must be logged in to save changes.');
          setSaving(false);
          return false;
        }

        const nameParts = formData.clientName.trim().split(/\s+/);
        const ln = nameParts.length > 1 ? nameParts.pop()! : '';
        const fn = nameParts.join(' ');

        const { data: clientId, error: rpcError } = await supabase.rpc('find_or_create_client_by_email', {
          p_email: formData.clientEmail.trim(),
          p_first_name: fn,
          p_last_name: ln,
          p_phone: formData.clientPhone.trim() || null,
          p_company_name: formData.clientCompanyName.trim() || null,
          p_created_by: user.id,
        });

        if (rpcError) {
          console.error('Failed to resolve client:', rpcError);
          toast.error(`Could not resolve client: ${rpcError.message}`);
          setSaving(false);
          return false;
        }

        resolvedPrimaryClientId = clientId;
      }

      const updatePayload: Record<string, any> = {
        title: formData.projectName.trim(),
        content: updatedContent as any,
        project_info: updatedProjectInfo as any,
        annual_energy: annualEnergy,
        carbon_credits: carbonCredits,
        updated_at: new Date().toISOString(),
      };

      // Only overwrite system_size_kwp in kWp mode; preserve existing value in kWh mode
      if (!isKwh) {
        updatePayload.system_size_kwp = newSystemSize;
      }

      if (primaryChanged && resolvedPrimaryClientId) {
        updatePayload.client_reference_id = resolvedPrimaryClientId;
      }

      const { error } = await supabase
        .from('proposals')
        .update(updatePayload)
        .eq('id', proposal.id);

      if (error) {
        console.error('Error updating proposal:', error);
        toast.error('Failed to update proposal: ' + error.message);
        return false;
      }

      const clientIdToUpdate = resolvedPrimaryClientId || proposal.client_reference_id;
      if (clientIdToUpdate) {
        try {
          const nameParts = formData.clientName.trim().split(/\s+/);
          const lastName = nameParts.length > 1 ? nameParts.pop()! : '';
          const firstName = nameParts.join(' ');

          const { data: clientData, error: clientError } = await supabase
            .from('clients')
            .update({
              first_name: firstName,
              last_name: lastName,
              email: formData.clientEmail.trim(),
              phone: formData.clientPhone.trim(),
              company_name: formData.clientCompanyName.trim(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', clientIdToUpdate)
            .select('user_id')
            .single();

          if (clientError) {
            toast.warning('Client record update may not have saved — check My Clients for accuracy.');
            console.warn('Failed to update linked client record:', clientError.message);
          }

          if (clientData?.user_id) {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                first_name: firstName,
                last_name: lastName,
                phone: formData.clientPhone.trim(),
                company_name: formData.clientCompanyName.trim(),
              })
              .eq('id', clientData.user_id);

            if (profileError) {
              toast.warning('User profile sync failed — User Management may show outdated info.');
              console.warn('Failed to sync profile:', profileError.message);
            }
          }
        } catch (clientErr) {
          toast.warning('Client record sync encountered an error.');
          console.warn('Exception updating linked client record:', clientErr);
        }
      }

      await syncAdditionalClientsJunction(proposal.id, formData.additionalClients);

      // Fire-and-forget PDF regeneration so the cached PDF reflects the edit
      // on the next download (including agent share links). Don't block UX.
      supabase.functions
        .invoke('generate-proposal-pdf', { body: { proposalId: proposal.id, forceRegenerate: true } })
        .catch((e) => console.warn('Background PDF regeneration failed:', e));

      toast.success('Proposal updated successfully');
      onSuccess?.();
      return true;
    } catch (err) {
      console.error('Exception updating proposal:', err);
      toast.error('An unexpected error occurred');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    formData,
    errors,
    saving,
    updateField,
    updateMode,
    updateAnnualKwh,
    updatePhase,
    updatePhaseAnnualKwh,
    addAdditionalClient,
    updateAdditionalClient,
    removeAdditionalClient,
    makePrimary,
    computedTotalSize,
    save,
    resetForm,
  };
}
