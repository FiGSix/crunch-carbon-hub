
import { InvitationRequest } from "./types.ts";

export function validateInvitationRequest(requestData: any): InvitationRequest {
  // Validate required fields
  const requiredFields = ['proposalId', 'clientEmail', 'invitationToken'];
  const missingFields = requiredFields.filter(field => !requestData[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  const { 
    proposalId, 
    clientEmail, 
    clientName = 'Client', 
    invitationToken,
    projectName = 'Carbon Credit Project',
    clientId 
  }: InvitationRequest = requestData;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(clientEmail)) {
    throw new Error("Invalid email format");
  }

  // Optional CC recipients (additional clients). Invalid entries are dropped,
  // never fatal — the primary send must not fail because of a CC address.
  const rawCc = Array.isArray(requestData.ccEmails) ? requestData.ccEmails : [];
  const ccEmails = rawCc
    .filter((e: unknown): e is string => typeof e === 'string')
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => emailRegex.test(e) && e !== clientEmail.trim().toLowerCase())
    .slice(0, 10);
  const rawNames = Array.isArray(requestData.ccNames) ? requestData.ccNames : [];
  const ccNames = ccEmails.map((email) => {
    const idx = rawCc.findIndex(
      (e: unknown) => typeof e === 'string' && e.trim().toLowerCase() === email
    );
    const name = idx >= 0 ? rawNames[idx] : undefined;
    return typeof name === 'string' && name.trim() ? name.trim() : email;
  });

  return {
    proposalId,
    clientEmail,
    clientName,
    invitationToken,
    projectName,
    clientId,
    ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
    ccNames: ccNames.length > 0 ? ccNames : undefined
  };
}
