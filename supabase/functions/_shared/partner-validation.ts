import { isBeforeNewProjectCutoff, VERRA_CUTOFF_NOTICE } from "./commissionCutoff.ts";
/**
 * Partner API Validation
 * Zod-like validation for Partner API requests
 */

import { CreateProposalRequest, UpdateOnboardingRequest, DocumentPresignRequest, ConfigureDataAccessRequest, CreateWebhookRequest } from './partner-types.ts';

// =============================================================================
// Validation Result Type
// =============================================================================

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  received?: unknown;
}

// =============================================================================
// Helper Validators
// =============================================================================

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// =============================================================================
// Create Proposal Validation
// =============================================================================

export function validateCreateProposal(body: unknown): ValidationResult<CreateProposalRequest> {
  const errors: ValidationError[] = [];
  
  if (!body || typeof body !== 'object') {
    return { success: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }
  
  const data = body as Record<string, unknown>;
  
  // Validate client
  if (!data.client || typeof data.client !== 'object') {
    errors.push({ field: 'client', message: 'Client information is required' });
  } else {
    const client = data.client as Record<string, unknown>;
    
    if (!client.first_name || typeof client.first_name !== 'string' || !client.first_name.trim()) {
      errors.push({ field: 'client.first_name', message: 'First name is required', received: client.first_name });
    }
    
    if (!client.last_name || typeof client.last_name !== 'string' || !client.last_name.trim()) {
      errors.push({ field: 'client.last_name', message: 'Last name is required', received: client.last_name });
    }
    
    if (!client.email || typeof client.email !== 'string' || !isValidEmail(client.email)) {
      errors.push({ field: 'client.email', message: 'Valid email is required', received: client.email });
    }
  }
  
  // Validate project
  if (!data.project || typeof data.project !== 'object') {
    errors.push({ field: 'project', message: 'Project information is required' });
  } else {
    const project = data.project as Record<string, unknown>;
    
    if (!project.address || typeof project.address !== 'string' || !project.address.trim()) {
      errors.push({ field: 'project.address', message: 'Address is required', received: project.address });
    }
    
    if (project.country !== 'ZA') {
      errors.push({ field: 'project.country', message: 'Country must be "ZA" (South Africa only)', received: project.country });
    }
    
    const systemSize = project.system_size_kwp;
    if (typeof systemSize !== 'number' || systemSize < 0.1 || systemSize > 15000) {
      errors.push({ 
        field: 'project.system_size_kwp', 
        message: 'System size must be between 0.1 and 15000 kWp', 
        received: systemSize 
      });
    }
    
    const commissioningDate = project.commissioning_date;
    if (!commissioningDate || typeof commissioningDate !== 'string' || !isValidDate(commissioningDate)) {
      errors.push({ field: 'project.commissioning_date', message: 'Valid commissioning date is required (YYYY-MM-DD)', received: commissioningDate });
    } else {
      const date = new Date(commissioningDate);
      if (isBeforeNewProjectCutoff(commissioningDate)) {
        errors.push({ field: 'project.commissioning_date', message: VERRA_CUTOFF_NOTICE, received: commissioningDate });
      }
    }
    
    // Optional validations
    if (project.gps_lat !== undefined && (typeof project.gps_lat !== 'number' || project.gps_lat < -90 || project.gps_lat > 90)) {
      errors.push({ field: 'project.gps_lat', message: 'GPS latitude must be between -90 and 90', received: project.gps_lat });
    }
    
    if (project.gps_lng !== undefined && (typeof project.gps_lng !== 'number' || project.gps_lng < -180 || project.gps_lng > 180)) {
      errors.push({ field: 'project.gps_lng', message: 'GPS longitude must be between -180 and 180', received: project.gps_lng });
    }
    
    if (project.installer_email !== undefined && typeof project.installer_email === 'string' && !isValidEmail(project.installer_email)) {
      errors.push({ field: 'project.installer_email', message: 'Invalid installer email format', received: project.installer_email });
    }
  }
  
  // Validate consent
  if (!data.consent || typeof data.consent !== 'object') {
    errors.push({ field: 'consent', message: 'Consent information is required' });
  } else {
    const consent = data.consent as Record<string, unknown>;
    
    if (consent.obtained !== true) {
      errors.push({ field: 'consent.obtained', message: 'Consent must be obtained (true)', received: consent.obtained });
    }
    
    if (!consent.source || typeof consent.source !== 'string' || !consent.source.trim()) {
      errors.push({ field: 'consent.source', message: 'Consent source is required', received: consent.source });
    }
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  // Build validated request
  const clientData = data.client as Record<string, unknown>;
  const projectData = data.project as Record<string, unknown>;
  const consentData = data.consent as Record<string, unknown>;
  
  const validated: CreateProposalRequest = {
    partner_reference_id: data.partner_reference_id as string | undefined,
    client: {
      first_name: (clientData.first_name as string).trim(),
      last_name: (clientData.last_name as string).trim(),
      email: (clientData.email as string).toLowerCase().trim(),
      phone: clientData.phone as string | undefined,
      company_name: clientData.company_name as string | undefined,
    },
    project: {
      name: projectData.name as string | undefined,
      address: (projectData.address as string).trim(),
      country: 'ZA',
      gps_lat: projectData.gps_lat as number | undefined,
      gps_lng: projectData.gps_lng as number | undefined,
      system_size_kwp: projectData.system_size_kwp as number,
      commissioning_date: projectData.commissioning_date as string,
      installer_company: projectData.installer_company as string | undefined,
      installer_email: projectData.installer_email as string | undefined,
    },
    consent: {
      obtained: true,
      source: (consentData.source as string).trim(),
      timestamp: consentData.timestamp as string | undefined,
    },
    send_email: data.send_email !== false, // Default true
  };
  
  return { success: true, data: validated };
}

// =============================================================================
// Update Onboarding Validation
// =============================================================================

export function validateUpdateOnboarding(body: unknown): ValidationResult<UpdateOnboardingRequest> {
  const errors: ValidationError[] = [];
  
  if (!body || typeof body !== 'object') {
    return { success: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }
  
  const data = body as Record<string, unknown>;
  const validated: UpdateOnboardingRequest = {};
  
  // Validate system fields
  if (data.system && typeof data.system === 'object') {
    const system = data.system as Record<string, unknown>;
    validated.system = {};
    
    if (system.inverter_brand !== undefined) validated.system.inverter_brand = String(system.inverter_brand);
    if (system.inverter_model !== undefined) validated.system.inverter_model = String(system.inverter_model);
    if (system.inverter_serial !== undefined) validated.system.inverter_serial = String(system.inverter_serial);
    if (system.inverter_capacity_kw !== undefined) {
      const val = Number(system.inverter_capacity_kw);
      if (isNaN(val) || val < 0) {
        errors.push({ field: 'system.inverter_capacity_kw', message: 'Must be a positive number', received: system.inverter_capacity_kw });
      } else {
        validated.system.inverter_capacity_kw = val;
      }
    }
    if (system.inverter_quantity !== undefined) {
      const val = Number(system.inverter_quantity);
      if (isNaN(val) || val < 0 || !Number.isInteger(val)) {
        errors.push({ field: 'system.inverter_quantity', message: 'Must be a positive integer', received: system.inverter_quantity });
      } else {
        validated.system.inverter_quantity = val;
      }
    }
    if (system.panel_brand !== undefined) validated.system.panel_brand = String(system.panel_brand);
    if (system.panel_quantity !== undefined) {
      const val = Number(system.panel_quantity);
      if (isNaN(val) || val < 0 || !Number.isInteger(val)) {
        errors.push({ field: 'system.panel_quantity', message: 'Must be a positive integer', received: system.panel_quantity });
      } else {
        validated.system.panel_quantity = val;
      }
    }
    if (system.panel_size_wp !== undefined) {
      const val = Number(system.panel_size_wp);
      if (isNaN(val) || val < 0) {
        errors.push({ field: 'system.panel_size_wp', message: 'Must be a positive number', received: system.panel_size_wp });
      } else {
        validated.system.panel_size_wp = val;
      }
    }
    if (system.panel_total_kwp !== undefined) {
      const val = Number(system.panel_total_kwp);
      if (isNaN(val) || val < 0) {
        errors.push({ field: 'system.panel_total_kwp', message: 'Must be a positive number', received: system.panel_total_kwp });
      } else {
        validated.system.panel_total_kwp = val;
      }
    }
    if (system.has_battery !== undefined) validated.system.has_battery = Boolean(system.has_battery);
    if (system.battery_brand !== undefined) validated.system.battery_brand = String(system.battery_brand);
    if (system.battery_capacity_kwh !== undefined) {
      const val = Number(system.battery_capacity_kwh);
      if (isNaN(val) || val < 0) {
        errors.push({ field: 'system.battery_capacity_kwh', message: 'Must be a positive number', received: system.battery_capacity_kwh });
      } else {
        validated.system.battery_capacity_kwh = val;
      }
    }
  }
  
  // Validate installation fields
  if (data.installation && typeof data.installation === 'object') {
    const installation = data.installation as Record<string, unknown>;
    validated.installation = {};
    
    if (installation.total_capex !== undefined) {
      const val = Number(installation.total_capex);
      if (isNaN(val) || val < 0) {
        errors.push({ field: 'installation.total_capex', message: 'Must be a positive number', received: installation.total_capex });
      } else {
        validated.installation.total_capex = val;
      }
    }
    if (installation.ownership_type !== undefined) {
      const valid = ['owned', 'ppa', 'lease'];
      if (!valid.includes(installation.ownership_type as string)) {
        errors.push({ field: 'installation.ownership_type', message: 'Must be one of: owned, ppa, lease', received: installation.ownership_type });
      } else {
        validated.installation.ownership_type = installation.ownership_type as 'owned' | 'ppa' | 'lease';
      }
    }
    if (installation.has_maintenance_agreement !== undefined) {
      validated.installation.has_maintenance_agreement = Boolean(installation.has_maintenance_agreement);
    }
    if (installation.maintenance_cost_annual !== undefined) {
      const val = Number(installation.maintenance_cost_annual);
      if (isNaN(val) || val < 0) {
        errors.push({ field: 'installation.maintenance_cost_annual', message: 'Must be a positive number', received: installation.maintenance_cost_annual });
      } else {
        validated.installation.maintenance_cost_annual = val;
      }
    }
    if (installation.commissioning_date !== undefined) {
      const dateStr = String(installation.commissioning_date);
      if (!isValidDate(dateStr)) {
        errors.push({ field: 'installation.commissioning_date', message: 'Must be a valid date (YYYY-MM-DD)', received: installation.commissioning_date });
      } else {
        (validated.installation as Record<string, unknown>).commissioning_date = dateStr;
      }
    }
  }
  
  // Validate installer fields
  if (data.installer && typeof data.installer === 'object') {
    const installer = data.installer as Record<string, unknown>;
    validated.installer = {};
    
    if (installer.company_name !== undefined) validated.installer.company_name = String(installer.company_name);
    if (installer.email !== undefined) {
      const email = String(installer.email);
      if (!isValidEmail(email)) {
        errors.push({ field: 'installer.email', message: 'Invalid email format', received: installer.email });
      } else {
        validated.installer.email = email;
      }
    }
  }
  
  // Validate location fields
  if (data.location && typeof data.location === 'object') {
    const location = data.location as Record<string, unknown>;
    validated.location = {};
    
    if (location.address !== undefined) validated.location.address = String(location.address);
    if (location.gps_lat !== undefined) {
      const val = Number(location.gps_lat);
      if (isNaN(val) || val < -90 || val > 90) {
        errors.push({ field: 'location.gps_lat', message: 'Must be between -90 and 90', received: location.gps_lat });
      } else {
        validated.location.gps_lat = val;
      }
    }
    if (location.gps_lng !== undefined) {
      const val = Number(location.gps_lng);
      if (isNaN(val) || val < -180 || val > 180) {
        errors.push({ field: 'location.gps_lng', message: 'Must be between -180 and 180', received: location.gps_lng });
      } else {
        validated.location.gps_lng = val;
      }
    }
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  return { success: true, data: validated };
}

// =============================================================================
// Document Presign Validation
// =============================================================================

export function validateDocumentPresign(body: unknown): ValidationResult<DocumentPresignRequest> {
  const errors: ValidationError[] = [];
  
  if (!body || typeof body !== 'object') {
    return { success: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }
  
  const data = body as Record<string, unknown>;
  
  const validCategories = ['coc', 'invoice', 'installation_photo', 'panel_layout', 'other'];
  if (!data.category || !validCategories.includes(data.category as string)) {
    errors.push({ field: 'category', message: `Must be one of: ${validCategories.join(', ')}`, received: data.category });
  }
  
  if (!data.file_name || typeof data.file_name !== 'string' || !data.file_name.trim()) {
    errors.push({ field: 'file_name', message: 'File name is required', received: data.file_name });
  }
  
  if (!data.content_type || typeof data.content_type !== 'string') {
    errors.push({ field: 'content_type', message: 'Content type is required', received: data.content_type });
  }
  
  if (typeof data.file_size_bytes !== 'number' || data.file_size_bytes <= 0) {
    errors.push({ field: 'file_size_bytes', message: 'File size must be a positive number', received: data.file_size_bytes });
  }
  
  // 50MB max
  if (typeof data.file_size_bytes === 'number' && data.file_size_bytes > 50 * 1024 * 1024) {
    errors.push({ field: 'file_size_bytes', message: 'File size must not exceed 50MB', received: data.file_size_bytes });
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  const validated: DocumentPresignRequest = {
    category: data.category as DocumentPresignRequest['category'],
    file_name: (data.file_name as string).trim(),
    content_type: data.content_type as string,
    file_size_bytes: data.file_size_bytes as number,
    metadata: data.metadata as DocumentPresignRequest['metadata'],
  };
  
  return { success: true, data: validated };
}

// =============================================================================
// Data Access Configuration Validation
// =============================================================================

export function validateDataAccessConfig(body: unknown): ValidationResult<ConfigureDataAccessRequest> {
  const errors: ValidationError[] = [];
  
  if (!body || typeof body !== 'object') {
    return { success: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }
  
  const data = body as Record<string, unknown>;
  
  if (!data.provider || typeof data.provider !== 'string' || !data.provider.trim()) {
    errors.push({ field: 'provider', message: 'Provider is required', received: data.provider });
  }
  
  const validMethods = ['delegated_access', 'api_key'];
  if (!data.credential_method || !validMethods.includes(data.credential_method as string)) {
    errors.push({ field: 'credential_method', message: `Must be one of: ${validMethods.join(', ')}`, received: data.credential_method });
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  const validated: ConfigureDataAccessRequest = {
    provider: (data.provider as string).trim().toLowerCase(),
    credential_method: data.credential_method as 'delegated_access' | 'api_key',
    site_id: data.site_id as string | undefined,
    portal_url: data.portal_url as string | undefined,
    delegated_access: data.delegated_access as ConfigureDataAccessRequest['delegated_access'],
    api_key: data.api_key as string | undefined,
  };
  
  return { success: true, data: validated };
}

// =============================================================================
// Webhook Validation
// =============================================================================

export function validateCreateWebhook(body: unknown): ValidationResult<CreateWebhookRequest> {
  const errors: ValidationError[] = [];
  
  if (!body || typeof body !== 'object') {
    return { success: false, errors: [{ field: 'body', message: 'Request body is required' }] };
  }
  
  const data = body as Record<string, unknown>;
  
  if (!data.url || typeof data.url !== 'string' || !isValidUrl(data.url)) {
    errors.push({ field: 'url', message: 'Valid HTTPS URL is required', received: data.url });
  } else if (!data.url.startsWith('https://')) {
    errors.push({ field: 'url', message: 'URL must use HTTPS', received: data.url });
  }
  
  if (!Array.isArray(data.events) || data.events.length === 0) {
    errors.push({ field: 'events', message: 'At least one event is required', received: data.events });
  }
  
  if (errors.length > 0) {
    return { success: false, errors };
  }
  
  const validated: CreateWebhookRequest = {
    url: data.url as string,
    events: data.events as string[],
    secret: data.secret as string | undefined,
  };
  
  return { success: true, data: validated };
}

// =============================================================================
// UUID Validation
// =============================================================================

export function validateUUID(value: string, fieldName: string): ValidationResult<string> {
  if (!isValidUUID(value)) {
    return { success: false, errors: [{ field: fieldName, message: 'Invalid UUID format', received: value }] };
  }
  return { success: true, data: value };
}
