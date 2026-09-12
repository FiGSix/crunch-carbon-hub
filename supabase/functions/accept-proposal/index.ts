import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { authorizeCompanySigner, resolveStoredSignatoryName } from './signer-authorization.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProjectDetailsInput {
  systemAddress?: string;
  systemLat?: number | null;
  systemLng?: number | null;
  commissioningDate?: string;
  installerCompanyName?: string;
  installerEmail?: string;
}

interface AcceptProposalRequest {
  token?: string;
  proposalId?: string;
  typedName: string;
  /** Natural person signing; mandatory when the cedent is a company. */
  signatoryName?: string;
  isCompanyCedent?: boolean;
  signatureImage?: string;
  signatureType?: 'canvas' | 'typed_name';
  ipAddress?: string;
  userAgent?: string;
  projectDetails?: ProjectDetailsInput;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      token,
      proposalId,
      typedName,
      signatoryName,
      isCompanyCedent,
      signatureImage,
      signatureType = 'typed_name',
      ipAddress,
      userAgent,
      projectDetails,
    }: AcceptProposalRequest = await req.json();

    // Sanitize IP for Postgres `inet` columns — empty string is invalid (22P02).
    const sanitizeIp = (v: unknown): string | null => {
      if (typeof v !== 'string') return null;
      const t = v.trim();
      return t.length > 0 ? t : null;
    };
    const headerIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-real-ip') ||
      null;
    const safeIp = sanitizeIp(headerIp) ?? sanitizeIp(ipAddress);

    // Enhanced logging for debugging
    console.log('📥 Request payload:', {
      hasToken: !!token,
      hasProposalId: !!proposalId,
      typedName: typedName,
      typedNameLength: typedName?.length,
      signatureType: signatureType,
      hasSignatureImage: !!signatureImage,
      signatureImagePrefix: signatureImage?.substring(0, 30)
    });

    if (!token && !proposalId) {
      console.error('❌ Missing both token and proposalId');
      throw new Error("Either token or proposalId is required");
    }

    console.log(`Accepting proposal with ${token ? `token: ${token.substring(0, 8)}...` : `proposalId: ${proposalId}`}`);

    let proposal: any;

    // 1. Get proposal either by token or by ID (for authenticated users)
    if (token) {
      // Token-based access
      const { data: proposalData, error: proposalError } = await supabase
        .rpc('get_proposal_by_token_direct', { token_param: token });

      if (proposalError) {
        console.error("Error fetching proposal by token:", proposalError);
        throw new Error("Invalid or expired invitation token");
      }

      if (!proposalData || proposalData.length === 0) {
        throw new Error("Proposal not found or invitation has expired");
      }

      proposal = proposalData[0];
    } else if (proposalId) {
      // Authenticated user access - query directly with RLS
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error("Authentication required");
      }

      // Create client with user's auth token for RLS
      const userSupabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: proposalData, error: proposalError } = await userSupabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single();

      if (proposalError) {
        console.error("Error fetching proposal by ID:", proposalError);
        throw new Error("Proposal not found or you don't have access");
      }

      proposal = proposalData;
    }

    // 2. Master-agreement propagation (stamping the client + approving sibling proposals
    //    + cloning the agreement onto each sibling) is handled by the
    //    propagate_master_agreement() DB trigger on INSERT into proposal_agreements.


    // 3. Validate proposal status for new signatures
    console.log('🔍 Validating proposal status:', proposal.status);
    
    if (proposal.status === 'approved' || proposal.status === 'signed') {
      console.error('❌ Proposal already signed:', proposal.id);
      return new Response(
        JSON.stringify({ 
          error: "This proposal has already been signed",
          alreadySigned: true 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (proposal.status === 'rejected') {
      console.error('❌ Proposal already rejected:', proposal.id);
      return new Response(
        JSON.stringify({ error: "This proposal has been rejected and cannot be signed" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 3. Validate token expiration (only for token-based access)
    if (token && proposal.invitation_expires_at && new Date(proposal.invitation_expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Invitation link has expired" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 4. Validate typed name (conditional based on signature type)
    console.log('🔍 Validating signature:', { 
      signatureType,
      typedName, 
      typedNameLength: typedName?.length,
      hasSignatureImage: !!signatureImage
    });
    
    // Only require typed name if signature type is 'typed_name'
    if (signatureType === 'typed_name' && (!typedName || typedName.trim().length < 2)) {
      console.error('❌ Invalid typed name for typed signature:', { typedName, length: typedName?.length });
      return new Response(
        JSON.stringify({ 
          error: "Please provide a valid name (minimum 2 characters) when using typed signature",
          validation: 'typedName',
          received: typedName
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Resolve and validate the caller before recording any signer identity.
    // A bearer token is optional for unmanaged invitation recipients, but if it
    // is supplied it must be valid and its subject is the only trusted signer ID.
    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
    const bearerRole = (() => {
      if (!bearerToken) return null;
      try {
        const payload = bearerToken.split('.')[1];
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(normalized)).role as string | undefined;
      } catch {
        return null;
      }
    })();
    let authenticatedUserId: string | null = null;
    let authenticatedProfileName: string | null = null;

    // Supabase's browser client sends the public anon key as Authorization for
    // signed-out function calls. It identifies no person, so treat it as guest.
    if (bearerToken && bearerRole !== 'anon') {
      const { data: authData, error: authError } = await supabase.auth.getUser(bearerToken);
      if (authError || !authData.user) {
        return new Response(
          JSON.stringify({ error: 'Your session is invalid or has expired. Please sign in again.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      authenticatedUserId = authData.user.id;

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', authenticatedUserId)
        .maybeSingle();
      authenticatedProfileName = [profile?.first_name, profile?.last_name]
        .filter(Boolean)
        .join(' ')
        .trim() || null;
    }

    const ownerClientId = proposal.client_reference_id || null;
    let clientCompanyId: string | null = null;
    if (ownerClientId) {
      const { data: ownerClient } = await supabase
        .from('clients')
        .select('client_company_id')
        .eq('id', ownerClientId)
        .maybeSingle();
      clientCompanyId = ownerClient?.client_company_id ?? null;
    }

    let companyMemberships: Array<{ user_id: string; status: string; can_sign_agreements: boolean }> = [];
    if (clientCompanyId) {
      const { data: memberships } = await supabase
        .from('client_company_members')
        .select('user_id, status, can_sign_agreements')
        .eq('client_company_id', clientCompanyId);
      companyMemberships = memberships ?? [];
    }

    const signerAuthorization = authorizeCompanySigner({
      companyId: clientCompanyId,
      authenticatedUserId,
      memberships: companyMemberships,
    });
    if (!signerAuthorization.allowed) {
      return new Response(
        JSON.stringify({
          error: signerAuthorization.reason,
          requiresAuthentication: signerAuthorization.requiresAuthentication,
        }),
        {
          status: signerAuthorization.requiresAuthentication ? 401 : 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // For signed-in users the verified profile name wins. A caller cannot name
    // another person in the request body and have that identity recorded.
    const resolvedSignatory = resolveStoredSignatoryName(
      authenticatedProfileName,
      signatoryName || typedName || '',
    );
    const companyCedent = Boolean(clientCompanyId || isCompanyCedent);
    if (companyCedent && resolvedSignatory.length < 2) {
      return new Response(
        JSON.stringify({
          error: 'Please provide the full name of the person signing on behalf of the company',
          validation: 'signatoryName',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For canvas signatures, typed name is optional
    console.log(`✅ Signature validation passed for ${signatureType} signature`);

    // 4b. Referral-sourced proposals must include project details collected pre-signature.
    // NB: The RPC `get_proposal_by_token_direct` rewrites `content` and strips top-level
    // keys like `referral_created`, so we re-read it straight from the table.
    let isReferral = Boolean(proposal?.content?.referral_created);
    if (!isReferral && proposal?.id) {
      const { data: rawProposal } = await supabase
        .from('proposals')
        .select('content')
        .eq('id', proposal.id)
        .maybeSingle();
      isReferral = Boolean(rawProposal?.content?.referral_created);
    }
    if (isReferral) {
      const pd = projectDetails || {};
      const missing: string[] = [];
      if (!pd.systemAddress || pd.systemAddress.trim().length < 5) missing.push('systemAddress');
      if (!pd.commissioningDate) missing.push('commissioningDate');
      if (!pd.installerCompanyName || pd.installerCompanyName.trim().length < 2) missing.push('installerCompanyName');
      if (!pd.installerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pd.installerEmail)) missing.push('installerEmail');
      if (pd.commissioningDate) {
        const d = new Date(pd.commissioningDate);
        if (isNaN(d.getTime()) || d > new Date()) missing.push('commissioningDate');
      }
      if (missing.length > 0) {
        return new Response(
          JSON.stringify({ error: 'Missing required project details', missing }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }


    // Store the actual authenticated signer separately from the proposal contact.
    console.log('🔍 Finding signedBy:', { 
      client_reference_id: proposal.client_reference_id,
      client_id: proposal.client_id 
    });
    
    const signedBy = authenticatedUserId || ownerClientId || proposal.client_id;
    const masterClientId = ownerClientId;
    
    if (!signedBy || !masterClientId) {
      console.error("❌ No client reference found for proposal:", proposal.id);
      return new Response(
        JSON.stringify({ 
          error: "Invalid proposal configuration - no client reference",
          validation: 'signedBy'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    console.log('✅ signedBy identified:', signedBy);

    // Upload signature image if provided. We persist the STORAGE PATH (not a public URL)
    // because the `signed-agreements` bucket is private; consumers mint signed URLs on demand.
    let signatureImageUrl: string | null = null;
    if (signatureImage && signatureType === 'canvas') {
      console.log(`📸 Uploading signature image for proposal ${proposal.id}`, {
        imageLength: signatureImage.length,
        imagePrefix: signatureImage.substring(0, 50)
      });
      try {
        const base64Data = signatureImage.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        const fileName = `signature_${proposal.id}_${Date.now()}.png`;
        const filePath = `signatures/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('signed-agreements')
          .upload(filePath, buffer, {
            contentType: 'image/png',
            upsert: false
          });

        if (uploadError) {
          console.error('❌ Error uploading signature image:', uploadError);
        } else {
          // Store the storage path; AgreementTab/get-pdf-signed-url will create a signed URL on read.
          signatureImageUrl = filePath;
          console.log(`✅ Signature image uploaded at path: ${filePath}`);
        }
      } catch (uploadErr) {
        console.error('❌ Exception uploading signature:', uploadErr);
      }
    }

    // 5. Create agreement record with automatic system witnesses
    const witnessTimestamp = new Date().toISOString();
    
    // Map frontend signature type to database enum
    const dbSignatureType = signatureType === 'canvas' ? 'electronic_signature' : 'typed_name';

    // 5a. Resolve the LIVE cession revision. The wording the client just read and
    //     signed is whatever Admin → Legal Documents currently has flagged live —
    //     never a hardcoded copy.
    const { data: liveDocRaw } = await supabase.rpc('get_live_legal_document', {
      p_document_type: 'cession_agreement',
    });
    const liveDoc = Array.isArray(liveDocRaw) ? liveDocRaw[0] : liveDocRaw;
    if (!liveDoc?.id) {
      console.error('❌ No live cession agreement configured — refusing to record a signature');
      return new Response(
        JSON.stringify({
          error: 'No live Cession Agreement is configured. Please contact support.',
          validation: 'legal_document',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5b. Master signature: one per client, reused by every proposal they hold.
    let masterSignatureId: string | null = null;
    let masterDocId: string = liveDoc.id;
    let masterDocVersion: number = liveDoc.current_version;
    {
      const { data: existingMaster } = await supabase
        .from('client_cession_signatures')
        .select('id, legal_document_id, legal_document_version')
        .eq('client_id', masterClientId)
        .is('revoked_at', null)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingMaster) {
        // Already signed: keep the revision they actually signed, never re-stamp.
        masterSignatureId = existingMaster.id;
        masterDocId = existingMaster.legal_document_id ?? liveDoc.id;
        masterDocVersion = existingMaster.legal_document_version ?? liveDoc.current_version;
        console.log(`ℹ️ Reusing existing master signature ${masterSignatureId}`);
      } else {
        const { data: createdMaster, error: masterError } = await supabase
          .from('client_cession_signatures')
          .insert({
            client_id: masterClientId,
            legal_document_id: liveDoc.id,
            legal_document_version: liveDoc.current_version,
            legal_document_title: liveDoc.title,
            legal_document_file_path: liveDoc.file_path,
            signed_by: signedBy,
            origin_proposal_id: proposal.id,
            signature_type: dbSignatureType,
            typed_name: resolvedSignatory || null,
            signature_image_url: signatureImageUrl,
            ip_address: safeIp,
            user_agent: userAgent,
            signed_at: witnessTimestamp,
            metadata: {
              signed_via: token ? 'acceptance_link' : 'authenticated_user',
              signing_location: 'South Africa',
              signatory_name: resolvedSignatory || null,
              cedent_is_company: companyCedent,
              signer_user_id: authenticatedUserId,
            },
          })
          .select('id')
          .single();

        if (masterError || !createdMaster) {
          console.error('❌ Failed to create master cession signature:', masterError);
          throw new Error('Failed to record cession signature');
        }
        masterSignatureId = createdMaster.id;
        console.log(`✅ Master cession signature created: ${masterSignatureId}`);
      }
    }

    // Check for existing agreement to prevent duplicates from retries
    const { data: existingAgreement } = await supabase
      .from('proposal_agreements')
      .select('id')
      .eq('proposal_id', proposal.id)
      .limit(1)
      .single();
    
    let newAgreement;
    
    if (existingAgreement) {
      console.log(`⚠️ Agreement already exists for proposal ${proposal.id}: ${existingAgreement.id}, reusing it`);
      newAgreement = existingAgreement;
    } else {
      const { data: createdAgreement, error: agreementError } = await supabase
        .from('proposal_agreements')
        .insert({
          proposal_id: proposal.id,
          signed_by: signedBy,
          signature_type: dbSignatureType,
          signature_type_used: dbSignatureType,
          signature_image_url: signatureImageUrl,
          typed_name: resolvedSignatory || null,
          ip_address: safeIp,
          user_agent: userAgent,
          client_cession_signature_id: masterSignatureId,
          legal_document_id: masterDocId,
          legal_document_version: masterDocVersion,
          accepted_terms_version: String(masterDocVersion),
          witness_1_name: 'DIGITAL WITNESS 1',

          witness_1_verified_at: witnessTimestamp,
          witness_1_ip_address: safeIp,
          witness_2_name: 'DIGITAL WITNESS 2',
          witness_2_verified_at: witnessTimestamp,
          witness_2_ip_address: safeIp,
          witness_method: 'automatic_system',
          metadata: {
            signed_via: token ? 'acceptance_link' : 'authenticated_user',
            token_used: token ? token.substring(0, 8) + '...' : null,
            proposal_id_used: proposalId || null,
            timestamp: new Date().toISOString(),
            signing_location: 'South Africa',
            signatory_name: resolvedSignatory || null,
            cedent_is_company: companyCedent,
            signer_user_id: authenticatedUserId,
            witness_info: {
              method: 'automatic_system',
              witness_1: 'DIGITAL WITNESS 1',
              witness_2: 'DIGITAL WITNESS 2',
              witnessed_at: witnessTimestamp
            }
          }
        })
        .select()
        .single();

      if (agreementError || !createdAgreement) {
        console.error("Error creating agreement:", agreementError);
        throw new Error("Failed to record agreement");
      }
      newAgreement = createdAgreement;
    }

    console.log(`✅ Agreement created with ID: ${newAgreement.id}`);

    // 6. Update proposal status
    const { error: updateError } = await supabase
      .from('proposals')
      .update({
        status: 'approved',
        signed_at: new Date().toISOString()
      })
      .eq('id', proposal.id);

    if (updateError) {
      console.error("Error updating proposal:", updateError);
      throw new Error("Failed to update proposal status");
    }

    console.log(`✅ Proposal ${proposal.id} successfully signed via ${signatureType}`);

    // 7. Master-agreement propagation (client.cession_signed_at, first_agreement_id,
    //    sibling proposal approval, and cloned agreement rows) is performed by the
    //    propagate_master_agreement() DB trigger on INSERT into proposal_agreements.


    // 9. Mark invitation as viewed (for analytics) - only if token was used
    if (token) {
      await supabase.rpc('mark_invitation_viewed', { token_param: token });
    }

    // 10. Persist project details collected pre-signature + trigger installer invitation
    //     (referral-sourced proposals only).
    if (isReferral && projectDetails) {
      try {
        let { data: po } = await supabase
          .from('project_onboarding')
          .select('id')
          .eq('proposal_id', proposal.id)
          .maybeSingle();
        if (!po) {
          const { data: created, error: poErr } = await supabase
            .from('project_onboarding')
            .insert({ proposal_id: proposal.id })
            .select('id')
            .single();
          if (poErr) {
            console.error('[accept-proposal] create project_onboarding failed', poErr);
          } else {
            po = created;
          }
        }

        if (po) {
          const { data: existingFields } = await supabase
            .from('onboarding_fields')
            .select('id')
            .eq('project_id', po.id)
            .maybeSingle();

          const payload = {
            project_id: po.id,
            system_address: projectDetails.systemAddress!.trim(),
            system_gps_lat: projectDetails.systemLat ?? null,
            system_gps_lng: projectDetails.systemLng ?? null,
            commissioning_date: projectDetails.commissioningDate!,
            installer_company_name: projectDetails.installerCompanyName!.trim(),
            installer_email: projectDetails.installerEmail!.trim().toLowerCase(),
          };

          if (existingFields) {
            await supabase
              .from('onboarding_fields')
              .update(payload)
              .eq('id', existingFields.id);
          } else {
            await supabase.from('onboarding_fields').insert(payload);
          }

          const { error: invErr } = await supabase.functions.invoke('send-installer-invitation', {
            body: { proposalId: proposal.id },
          });
          if (invErr) console.error('[accept-proposal] installer invite failed', invErr);
        }
      } catch (e) {
        console.error('[accept-proposal] project details / installer invite error', e);
      }
    }

    // 11. Resolve client email BEFORE launching the background chain, so it's captured.
    let clientEmail: string | null = null;
    try {
      if (proposal.content?.clientInfo?.email) {
        clientEmail = proposal.content.clientInfo.email;
      } else if (proposal.client_id) {
        const { data } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', proposal.client_id)
          .single();
        clientEmail = data?.email || null;
      } else {
        const { data } = await supabase
          .from('clients')
          .select('email')
            .eq('id', ownerClientId)
          .single();
        clientEmail = data?.email || null;
      }
    } catch (e) {
      console.error('[accept-proposal] failed to resolve client email', e);
    }

    // 12. Post-signature chain: generate signed PDF FIRST, then email the client with it.
    //     Wrapped in EdgeRuntime.waitUntil so it survives past the HTTP response
    //     (fire-and-forget IIFEs get killed by the edge runtime after Response returns).
    const postSign = (async () => {
      try {
        console.log('🖊️ [post-sign] Generating signed agreement PDF...');
        const { data: signedPdfResult, error: pdfError } = await supabase.functions.invoke(
          'generate-signed-agreement-pdf',
          { body: { proposalId: proposal.id, agreementId: newAgreement.id } }
        );

        if (pdfError) {
          console.error('❌ [post-sign] Failed to generate signed PDF:', pdfError);
        } else {
          console.log('✅ [post-sign] Signed agreement PDF generated:', signedPdfResult?.signed_pdf_url);
        }

        if (clientEmail) {
          console.log(`📧 [post-sign] Sending cession agreement email to ${clientEmail}`);
          const { data: emailData, error: emailError } = await supabase.functions.invoke(
            'send-cession-agreement-email',
            { body: { proposalId: proposal.id, clientEmail } }
          );
          if (emailError) {
            console.error('❌ [post-sign] Cession email send failed:', emailError);
          } else {
            console.log('✅ [post-sign] Cession email sent:', emailData);
          }
        } else {
          console.warn('⚠️ [post-sign] No client email found, skipping confirmation email');
        }

        // Sibling proposals for the same client were approved and given their own
        // agreement rows by the propagate_master_agreement() trigger. Each needs
        // its own generated PDF + email — no manual intervention.
        const { data: sweepResult, error: sweepError } = await supabase.functions.invoke(
          'sweep-agreement-documents',
          { body: { clientId: masterClientId } }
        );
        if (sweepError) {
          console.error('❌ [post-sign] Sibling document sweep failed:', sweepError);
        } else if (sweepResult?.processed) {
          console.log(`✅ [post-sign] Generated ${sweepResult.processed} inherited sibling document(s)`);
        }

      } catch (err) {
        console.error('❌ [post-sign] Chain error:', err);
      }
    })();

    // @ts-ignore — EdgeRuntime is available in Supabase / Deno Deploy
    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
      // @ts-ignore
      EdgeRuntime.waitUntil(postSign);
    }



    return new Response(
      JSON.stringify({ 
        success: true,
        proposalId: proposal.id,
        message: "Proposal accepted successfully"
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error("Error in accept-proposal function:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Failed to accept proposal",
        details: error instanceof Error ? error.stack : undefined
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
