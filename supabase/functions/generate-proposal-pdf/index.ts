import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { getMinimumVintageYear } from "../_shared/vintageConfig.ts"
import { getProposalAuditTags, getEligibleStartDate, eligibleFractionOfYear, formatEligibleStart } from "../_shared/auditPeriods.ts"

// Create Supabase admin client with service role key
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "https://uyjryuopuqgmsvayiccl.supabase.co"
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProposalPdfRequest {
  proposalId: string
  forceRegenerate?: boolean
}

interface ProposalData {
  id: string
  title: string
  status: string
  content: any
  agent_id: string
  client_reference_id: string
  system_size_kwp: number
  carbon_credits: number
  client_share_percentage: number
  agent_commission_percentage: number
  pdf_version: number
  created_at: string
  invitation_token?: string
  invitation_expires_at?: string
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { proposalId, forceRegenerate = false }: ProposalPdfRequest = await req.json()

    console.log(`[PDF] Generating PDF for proposal: ${proposalId}, force regenerate: ${forceRegenerate}`)

    // Fetch proposal data with client information
    const { data: proposal, error: proposalError } = await supabaseAdmin
      .from('proposals')
      .select(`
        *,
        agent:profiles!proposals_agent_id_fkey(first_name, last_name, company_name, company_logo_url, email),
        client:clients!proposals_client_reference_id_fkey(first_name, last_name, email, company_name)
      `)
      .eq('id', proposalId)
      .single()

    if (proposalError || !proposal) {
      console.error('[PDF] Error fetching proposal:', proposalError)
      return new Response(
        JSON.stringify({ error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[PDF] Proposal fetched: ${proposal.title}, status: ${proposal.status}`)

    // CRITICAL: Ensure invitation token exists for ANY unsigned proposal
    // Token renewal now works for all statuses (draft, sent, pending, etc.) as long as proposal is unsigned
    let tokenUpdated = false
    const isUnsigned = !proposal.signed_at
    if (isUnsigned) {
      const now = new Date()
      const tokenExpired = !proposal.invitation_expires_at || new Date(proposal.invitation_expires_at) <= now
      
      if (!proposal.invitation_token || tokenExpired) {
        console.log(`[PDF] Generating new invitation token for unsigned proposal (status: ${proposal.status})`)
        
        const newToken = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
        const expiresAt = new Date(now.getTime() + 240 * 60 * 60 * 1000) // 10 days
        
        const { error: updateError } = await supabaseAdmin
          .from('proposals')
          .update({
            invitation_token: newToken,
            invitation_expires_at: expiresAt.toISOString()
          })
          .eq('id', proposalId)
        
        if (updateError) {
          console.error('[PDF] Failed to update invitation token:', updateError)
        } else {
          // CRITICAL: Re-fetch to confirm the token was saved correctly
          const { data: refreshedProposal, error: refreshError } = await supabaseAdmin
            .from('proposals')
            .select('invitation_token, invitation_expires_at')
            .eq('id', proposalId)
            .single()
          
          if (refreshError) {
            console.error('[PDF] Failed to re-fetch proposal after token update:', refreshError)
            // Fallback to local values
            proposal.invitation_token = newToken
            proposal.invitation_expires_at = expiresAt.toISOString()
          } else if (refreshedProposal) {
            proposal.invitation_token = refreshedProposal.invitation_token
            proposal.invitation_expires_at = refreshedProposal.invitation_expires_at
            console.log(`[PDF] Token confirmed from database:`, {
              hasToken: !!refreshedProposal.invitation_token,
              tokenLength: refreshedProposal.invitation_token?.length,
              expiresAt: refreshedProposal.invitation_expires_at
            })
          }
          tokenUpdated = true
          console.log(`[PDF] Token updated for ${proposal.status} proposal, expires at: ${proposal.invitation_expires_at}`)
        }
      } else {
        console.log('[PDF] Existing token is valid:', {
          hasToken: !!proposal.invitation_token,
          tokenLength: proposal.invitation_token?.length,
          expiresAt: proposal.invitation_expires_at
        })
      }
    } else {
      console.log('[PDF] Proposal already signed, skipping token renewal')
    }

    // Check if PDF exists and is current (unless force regenerating or token was just updated)
    if (!forceRegenerate && !tokenUpdated && proposal.pdf_url && proposal.pdf_generated_at) {
      const pdfAge = new Date().getTime() - new Date(proposal.pdf_generated_at).getTime()
      const proposalAge = new Date().getTime() - new Date(proposal.updated_at || proposal.created_at).getTime()
      
      // If PDF is newer than proposal updates, return existing URL
      if (pdfAge < proposalAge) {
        console.log('[PDF] Valid PDF already exists, returning cached version')
        return new Response(
          JSON.stringify({ 
            success: true, 
            pdf_url: proposal.pdf_url,
            cached: true 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    // Generate PDF content
    const pdfContent = await generatePdfContent(proposal as ProposalData)
    
    // Upload PDF to storage
    const fileName = `proposal-${proposalId}-v${proposal.pdf_version || 1}.pdf`
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('proposal-pdfs')
      .upload(fileName, pdfContent, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (uploadError) {
      console.error('Error uploading PDF:', uploadError)
      return new Response(
        JSON.stringify({ error: 'Failed to upload PDF' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('proposal-pdfs')
      .getPublicUrl(fileName)

    // Build update payload with PDF metadata
    const updatePayload: Record<string, any> = {
      pdf_url: publicUrl,
      pdf_generated_at: new Date().toISOString(),
      pdf_version: (proposal.pdf_version || 1) + 1
    }

    // If proposal was stale, revive it when PDF is regenerated
    // This signals the agent has actively re-engaged with this proposal
    const wasStale = proposal.status === 'stale'
    if (wasStale) {
      console.log(`[PDF] Reviving stale proposal ${proposalId} - agent regenerated PDF`)
      updatePayload.status = 'sent'
      updatePayload.invitation_sent_at = new Date().toISOString()
      updatePayload.last_email_sent_at = new Date().toISOString()
    }

    // Update proposal with PDF metadata (and status revival if stale)
    const { error: updateError } = await supabaseAdmin
      .from('proposals')
      .update(updatePayload)
      .eq('id', proposalId)

    if (updateError) {
      console.error('Error updating proposal with PDF metadata:', updateError)
    } else if (wasStale) {
      console.log(`[PDF] Successfully revived proposal from stale to sent`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        pdf_url: publicUrl,
        generated: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-proposal-pdf function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Generate a real PDF using pdf-lib styled to match 5-page template
async function generatePdfContent(proposal: ProposalData): Promise<Uint8Array> {
  const start = Date.now();
  // Dynamically import pdf-lib to avoid top-level imports
  const { PDFDocument, StandardFonts, rgb, PDFString, PDFArray, PDFName } = await import('https://esm.sh/pdf-lib@1.17.1');

  const pdfDoc = await PDFDocument.create();
  const A4: [number, number] = [595.28, 841.89];

  // Fonts
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

  // Official Crunch Carbon corporate colors
  const crunchYellow = rgb(1, 0.804, 0.012); // #FFCD03
  const crunchCharcoal = rgb(0.137, 0.122, 0.125); // #231F20
  
  const colors = {
    text: crunchCharcoal,
    muted: rgb(0.40, 0.40, 0.40),
    light: rgb(0.70, 0.70, 0.70),
    border: rgb(0.85, 0.85, 0.85),
    white: rgb(1, 1, 1),
    yellow: crunchYellow,
    charcoal: crunchCharcoal,
    white: rgb(1, 1, 1),
  };

  // Logo sources: try public Storage bucket paths first, then agent-provided URL
  const STORAGE_PUBLIC_BASE = 'https://uyjryuopuqgmsvayiccl.supabase.co/storage/v1/object/public';
  const LOGO_CANDIDATE_URLS = [
    `${STORAGE_PUBLIC_BASE}/company-logos/branding/crunch-logo-horizontal.png`,
    `${STORAGE_PUBLIC_BASE}/company-logos/branding/crunch-carbon-logo-new.png`,
    `${STORAGE_PUBLIC_BASE}/company-logos/crunch-carbon-logo-new.png`,
  ];

  // Safe accessors
  const anyProposal: any = proposal as any;
  const agent = anyProposal.agent || {};
  const client = anyProposal.client || {};
  const clientName = `${client.first_name ?? ''} ${client.last_name ?? ''}`.trim() || client.company_name || 'Client';
  const agentName = `${agent.first_name ?? ''} ${agent.last_name ?? ''}`.trim() || agent.company_name || 'Crunch Carbon';
  const agentEmail = agent.email || '';
  const logoUrl = agent.company_logo_url || null;

  // ===== Generation model: normalise kWp / kWh / multi-phase =====
  const PDF_ANNUAL_GEN_FACTOR = 1642.50; // kWh per kWp per year
  const PDF_EMISSION_FACTOR = 1.0334;    // tCO2e per MWh
  const _projectInfo = (anyProposal.content?.projectInfo || {}) as any;
  const _generationMode: 'kwp' | 'kwh' =
    _projectInfo.generationInputMode === 'kwh' ? 'kwh' : 'kwp';
  const _topAddress =
    anyProposal.project_info?.address || _projectInfo.address || 'To be confirmed';
  const _topCommission =
    anyProposal.project_info?.commission_date || _projectInfo.commissionDate || null;

  interface NormalisedPhase {
    name: string;
    address: string;
    sizeKWp: number;
    commissionDate: string | null;
    annualKwhByYear: Record<string, number>;
  }

  const _rawPhases = Array.isArray(_projectInfo.phases) ? _projectInfo.phases : [];
  const normalisedPhases: NormalisedPhase[] = (_rawPhases.length > 1)
    ? _rawPhases.map((p: any, i: number) => ({
        name: p.phaseName || p.name || `Phase ${i + 1}`,
        address: p.address || _topAddress,
        sizeKWp: Number(p.sizeKWp) || 0,
        commissionDate: p.commissionDate || _topCommission || null,
        annualKwhByYear: p.annualKwhByYear || {},
      }))
    : [{
        name: 'Project',
        address: _topAddress,
        sizeKWp: Number(_projectInfo.size) || Number(anyProposal.system_size_kwp) || 0,
        commissionDate: _topCommission || null,
        annualKwhByYear: _projectInfo.annualKwhByYear || {},
      }];

  // Audit eligibility: generation only counts from the start of the audit round
  // the project belongs to. Untagged projects (every new proposal) start 1 July 2026.
  const auditTags = await getProposalAuditTags(supabaseAdmin, anyProposal.id);

  const phaseKwhForYear = (phase: NormalisedPhase, year: number): number => {
    const eligibleStart = getEligibleStartDate(phase.commissionDate, auditTags);
    const fraction = eligibleFractionOfYear(year, eligibleStart);
    if (fraction <= 0) return 0;

    if (_generationMode === 'kwh') {
      return (Number(phase.annualKwhByYear?.[String(year)]) || 0) * fraction;
    }
    return phase.sizeKWp * PDF_ANNUAL_GEN_FACTOR * fraction;
  };

  const totalKwhForYear = (year: number): number =>
    normalisedPhases.reduce((s, p) => s + phaseKwhForYear(p, year), 0);


  const phaseTotalKwh = (phase: NormalisedPhase): number =>
    Object.values(phase.annualKwhByYear || {}).reduce(
      (s: number, v: any) => s + (Number(v) || 0),
      0,
    );

  // Helpers
  const mm = (n: number) => (n / 25.4) * 72; // convert mm to points

  const numberToWords = (num: number): string => {
    const ones = ['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];
    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
    if (num < 0) return ones[0];
    if (num < 20) return ones[num];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const r = num % 10;
      return tens[t] + (r ? '-' + ones[r] : '');
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const r = num % 100;
      return ones[h] + ' HUNDRED' + (r ? ' ' + numberToWords(r) : '');
    }
    return String(num);
  };

  const addPage = () => {
    const page = pdfDoc.addPage(A4);
    return page;
  };

  // Sanitize text to remove Unicode characters unsupported by WinAnsi
  const sanitizeText = (text: string): string => {
    return text
      // Replace subscript digits with normal digits
      .replace(/₀/g, '0').replace(/₁/g, '1').replace(/₂/g, '2').replace(/₃/g, '3')
      .replace(/₄/g, '4').replace(/₅/g, '5').replace(/₆/g, '6').replace(/₇/g, '7')
      .replace(/₈/g, '8').replace(/₉/g, '9')
      // Normalize quotes
      .replace(/[""]/g, '"').replace(/['']/g, "'")
      // Replace em/en dashes with hyphen
      .replace(/[—–]/g, '-')
      // Replace multiplication sign
      .replace(/×/g, 'x');
  };

  const drawPageNumber = (page: any, idx: number, total: number) => {
    const { width } = page.getSize();
    const text = `Page ${idx} of ${total}`;
    page.drawText(text, {
      x: width - 120,
      y: mm(10),
      size: 9,
      font,
      color: colors.light,
    });
  };

  // Safe wrapper for drawText that sanitizes text first
  const drawTextSafe = (page: any, text: string, options: any) => {
    page.drawText(sanitizeText(text), options);
  };

  const wrapText = (text: string, maxWidth: number, size: number, f = font) => {
    const usedFont = (f && typeof (f as any).widthOfTextAtSize === 'function') ? f : font;
    const sanitized = sanitizeText(text || '');
    const words = sanitized.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      const width = usedFont.widthOfTextAtSize(test, size);
      if (width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const wrapUrl = (url: string, maxWidth: number, size: number, f = font) => {
    const usedFont = (f && typeof (f as any).widthOfTextAtSize === 'function') ? f : font;
    const lines: string[] = [];
    let currentLine = '';
    
    // Break URL at logical points: /, ?, &, =
    for (let i = 0; i < url.length; i++) {
      const char = url[i];
      const testLine = currentLine + char;
      const width = usedFont.widthOfTextAtSize(testLine, size);
      
      if (width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
        
        // Force break opportunity after these characters
        if (char === '/' || char === '?' || char === '&' || char === '=') {
          const nextChar = url[i + 1];
          if (nextChar) {
            const projectedWidth = usedFont.widthOfTextAtSize(currentLine + nextChar + nextChar, size);
            // If adding more chars would exceed, break now
            if (projectedWidth > maxWidth * 0.9) {
              lines.push(currentLine);
              currentLine = '';
            }
          }
        }
      }
    }
    
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  const drawHeading = (page: any, text: string, x: number, y: number) => {
    page.drawText(text, { x, y, size: 18, font: bold, color: colors.white });
  };

  const drawSubheading = (page: any, text: string, x: number, y: number) => {
    page.drawText(text, { x, y, size: 12, font: bold, color: colors.text });
  };

  const drawParagraph = (page: any, text: string, x: number, y: number, width: number, size = 10) => {
    const lines = wrapText(text, width, size, font);
    let cursorY = y;
    for (const line of lines) {
      page.drawText(line, { x, y: cursorY, size, font, color: colors.text });
      cursorY -= size + 3;
    }
    return cursorY;
  };

  const drawKeyValue = (page: any, label: string, value: string, x: number, y: number) => {
    page.drawText(label, { x, y, size: 10, font: bold, color: colors.muted });
    page.drawText(value, { x: x + 120, y, size: 11, font, color: colors.text });
  };

  const drawDivider = (page: any, x: number, y: number, w: number) => {
    page.drawRectangle({ x, y, width: w, height: 0.5, color: colors.border });
  };

  const fmtNum = (n: number | null | undefined, suffix = '') =>
    typeof n === 'number' ? `${Number(n.toFixed(2)).toLocaleString()}${suffix}` : '—';

  // Try embedding logo if provided
  const tryEmbedLogo = async (url?: string) => {
    if (!url) return null;
    try {
      console.log('[PDF] Attempting to fetch logo', { url });
      const res = await fetch(url);
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        console.warn('[PDF] Logo fetch failed', { url, status: res.status, statusText: res.statusText });
        return null;
      }
      const buf = new Uint8Array(await res.arrayBuffer());
      try {
        const img = await pdfDoc.embedPng(buf);
        console.log('[PDF] Embedded PNG logo successfully', { url, contentType });
        return img;
      } catch (e1) {
        try {
          const img = await pdfDoc.embedJpg(buf);
          console.log('[PDF] Embedded JPG logo successfully', { url, contentType });
          return img;
        } catch (e2) {
          console.warn('[PDF] Failed to embed logo as PNG or JPG', { url, contentType });
          return null;
        }
      }
    } catch (e) {
      console.error('[PDF] Error fetching/embedding logo', { url, error: String(e) });
      return null;
    }
  };

  let logoImage: any = null;
  for (const candidate of [...LOGO_CANDIDATE_URLS, logoUrl]) {
    const img = await tryEmbedLogo(candidate as string | undefined);
    if (img) {
      logoImage = img;
      console.log('[PDF] Using logo from', candidate);
      break;
    }
  }

  // PAGE 1: Cover
  const cover = addPage();
  const coverPaddingX = mm(20);
  const coverWidth = cover.getSize().width;
  const coverHeight = cover.getSize().height;

  // Full-page background
  cover.drawRectangle({ x: 0, y: 0, width: coverWidth, height: coverHeight, color: crunchYellow });

  // Top heading block
  const titleSize = 48;
  const topMargin = mm(20);
  const leftMargin = mm(20);
  const firstLineY = coverHeight - topMargin - titleSize;
  cover.drawText('Crunching Carbon', { x: leftMargin, y: firstLineY, size: titleSize, font: bold, color: crunchCharcoal });
  const secondLineY = firstLineY - titleSize - mm(4);
  cover.drawText(`for ${clientName}`, { x: leftMargin, y: secondLineY, size: titleSize, font: boldItalic, color: colors.white });

  // Logo - centered in the middle of the bottom third
  if (logoImage) {
    const maxLogoWidth = mm(127.5); // 127.5mm width (15% smaller than 150mm)
    const lw = Math.min(maxLogoWidth, logoImage.width);
    const lh = (logoImage.height / logoImage.width) * lw;
    
    // Position in the middle of the bottom third
    const bottomThirdY = coverHeight / 3; // Bottom third starts at 1/3 of page height
    const logoX = (coverWidth - lw) / 2; // Center horizontally
    const logoY = bottomThirdY - (lh / 2); // Center vertically in bottom third
    
    cover.drawImage(logoImage, { x: logoX, y: logoY, width: lw, height: lh });
  } else {
    const placeholder = 'Crunch Carbon';
    const placeholderSize = 24;
    const textWidth = bold.widthOfTextAtSize(placeholder, placeholderSize);
    cover.drawText(placeholder, { x: (coverWidth - textWidth) / 2, y: mm(40), size: placeholderSize, font: bold, color: crunchCharcoal });
  }

  // Bottom-right revision label
  const revision = Math.max(0, (proposal.pdf_version || 1) - 1);
  const revisionWord = numberToWords(revision).toUpperCase();
  const revisionText = `Revision ${revisionWord}`;
  const revisionSize = 48;
  const revisionTextWidth = bold.widthOfTextAtSize(revisionText, revisionSize);
  cover.drawText(revisionText, { x: coverWidth - mm(20) - revisionTextWidth, y: mm(20), size: revisionSize, font: boldItalic, color: colors.white });

  // PAGE 2: About / Benefits / Process (Yellow Background)
  const page2 = addPage();
  
  // Draw full-page yellow background (#FFCD03)
  page2.drawRectangle({
    x: 0,
    y: 0,
    width: page2.getSize().width,
    height: page2.getSize().height,
    color: crunchYellow,
  });

  const p2x = mm(20);
  let y = page2.getSize().height - mm(25);

  // Helper function for section headings (White, Helvetica Bold, size 18)
  const drawSectionHeading = (page: any, text: string, x: number, y: number) => {
    page.drawText(text, { x, y, size: 18, font: bold, color: colors.white });
  };

  // Helper function for section content (Charcoal, Helvetica, size 12)
  const drawSectionContent = (page: any, text: string, x: number, y: number, maxWidth: number) => {
    const lines = wrapText(text, maxWidth, 12, font);
    let currentY = y;
    for (const line of lines) {
      page.drawText(line, { x, y: currentY, size: 12, font, color: crunchCharcoal });
      currentY -= mm(5.5);
    }
    return currentY;
  };

  // ABOUT Section
  drawSectionHeading(page2, 'About', p2x, y);
  y -= mm(8);
  const aboutText = `Carbon credits are designed as a market-based mechanism to reduce greenhouse gas emissions. They allow companies to trade emission permits while giving businesses and individuals a unique opportunity to contribute to the global fight against climate change.

At Crunch Carbon, we manage the entire carbon credit generation process for you—from sign-up through to data collection, auditing, and verification of your solar energy usage. Together with our partners, we then sell these credits on your behalf and ensure that you, as the solar system owner, are rewarded once the credits are sold.`;
  y = drawSectionContent(page2, aboutText, p2x, y, page2.getSize().width - p2x * 2);

  y -= mm(8);

  // BENEFITS Section
  drawSectionHeading(page2, 'Benefits', p2x, y);
  y -= mm(8);

  const benefitsText = `Join Crunch Carbon and transform your solar energy into verified carbon credits earning real rewards while helping build a cleaner planet.

Get Paid for Impact: We handle the entire carbon credit process, from verification to sale and you earn from every ton reduced.

Zero Cost, Zero Risk: Joining is completely free, with no hidden fees or financial exposure.

Support a Sustainable Future: Your participation directly drives renewable energy growth and carbon reduction across Africa.

Do good. Get rewarded. Join Crunch Carbon.`;
  
  y = drawSectionContent(page2, benefitsText, p2x, y, page2.getSize().width - p2x * 2);

  y -= mm(4);

  // THE PROCESS Section
  drawSectionHeading(page2, 'The Process', p2x, y);
  y -= mm(8);
  const processText = 'No gimmicks, tricks or funnies. We handle all the complex paperwork and data audits, ensuring a seamless experience for our clients.';
  y = drawSectionContent(page2, processText, p2x, y, page2.getSize().width - p2x * 2);

  y -= mm(8);

  // THE T&C'S Section
  drawSectionHeading(page2, "The T&C's", p2x, y);
  y -= mm(8);
  const tcText = `Our Cession Agreement protects your rights as a solar system owner while allowing you to benefit from carbon credits with minimal effort and no cost. You remain the lawful owner of your system and only environmental benefits are ceded for credit generation. Crunch Carbon, with our partner CDSA, manages the full Carbon Credit process. From registration, audits, verification to sales and disbursement of cash. Crunch Carbon covers all related costs. You receive the revenue share from credits sold, paid annually in June/July being the norm. Your data is treated as confidential, and you may request process details at any time. If you decide for whatever reason the Cession Agreement may be cancelled by either party with 30 days' notice. Disputes are resolved through mediation and arbitration, and if unforeseen events prevent performance, either party may terminate without penalty.`;
  y = drawSectionContent(page2, tcText, p2x, y, page2.getSize().width - p2x * 2);

  // Add 5-step circular flow diagram at bottom of page 2
  const contentWidth = page2.getSize().width - p2x * 2;
  const availableBottomSpace = y - mm(20); // Space from current y to page bottom margin
  
  // Flow diagram settings - matching reference image
  const flowSteps = [
    'Review Proposal\n(if happy proceed\nto step 2)',
    'Agree to\nCession\nAgreement',
    'Project\nOnboarding',
    'Crunch Carbon\nprepares for\nannual Audit',
    'Reward'
  ];
  
  // Gold/yellow color for icons and arrows
  const goldColor = rgb(0.831, 0.686, 0.216); // #D4AF37
  
  const circleRadius = mm(10);
  const circleDiameter = circleRadius * 2;
  const circleSpacing = mm(6);
  const arrowLength = mm(8);
  const labelHeight = mm(16); // Increased for multi-line labels
  const totalDiagramHeight = circleDiameter + labelHeight;
  
  // Calculate total width and ensure it fits within content width
  const totalDiagramWidth = (circleDiameter * flowSteps.length) + (arrowLength * (flowSteps.length - 1)) + (circleSpacing * (flowSteps.length - 1) * 2);
  const diagramStartX = p2x + (contentWidth - totalDiagramWidth) / 2;
  
  // Center vertically in available bottom space
  const diagramCenterY = mm(20) + availableBottomSpace / 2;
  const circleY = diagramCenterY + labelHeight / 2;
  
  // Draw each step circle with gold/yellow geometric icons
  for (let i = 0; i < flowSteps.length; i++) {
    const circleX = diagramStartX + circleRadius + i * (circleDiameter + arrowLength + circleSpacing * 2);
    
    // Draw white circle with subtle border
    page2.drawCircle({
      x: circleX,
      y: circleY,
      size: circleRadius,
      color: rgb(1, 1, 1), // white fill
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 1.5,
    });
    
    // Draw gold/yellow geometric icon in center of circle based on step
    const iconSize = mm(4.5);
    if (i === 0) {
      // Step 1: Document with magnifying glass
      // Document (rectangle)
      page2.drawRectangle({
        x: circleX - iconSize * 0.5,
        y: circleY - iconSize * 0.6,
        width: iconSize * 0.8,
        height: iconSize * 1.1,
        borderColor: goldColor,
        borderWidth: 1.8,
      });
      // Lines inside document
      page2.drawLine({
        start: { x: circleX - iconSize * 0.3, y: circleY + iconSize * 0.2 },
        end: { x: circleX + iconSize * 0.1, y: circleY + iconSize * 0.2 },
        thickness: 1.2,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX - iconSize * 0.3, y: circleY - iconSize * 0.1 },
        end: { x: circleX + iconSize * 0.1, y: circleY - iconSize * 0.1 },
        thickness: 1.2,
        color: goldColor,
      });
      // Magnifying glass (small circle)
      page2.drawCircle({
        x: circleX + iconSize * 0.4,
        y: circleY - iconSize * 0.4,
        size: iconSize * 0.35,
        borderColor: goldColor,
        borderWidth: 1.5,
      });
    } else if (i === 1) {
      // Step 2: Handshake (geometric representation)
      // Two rectangles meeting at angle
      page2.drawRectangle({
        x: circleX - iconSize * 0.7,
        y: circleY - iconSize * 0.3,
        width: iconSize * 0.6,
        height: iconSize * 0.8,
        borderColor: goldColor,
        borderWidth: 1.8,
      });
      page2.drawRectangle({
        x: circleX + iconSize * 0.1,
        y: circleY - iconSize * 0.3,
        width: iconSize * 0.6,
        height: iconSize * 0.8,
        borderColor: goldColor,
        borderWidth: 1.8,
      });
      // Connection line
      page2.drawLine({
        start: { x: circleX - iconSize * 0.4, y: circleY },
        end: { x: circleX + iconSize * 0.4, y: circleY },
        thickness: 2,
        color: goldColor,
      });
    } else if (i === 2) {
      // Step 3: Rocket
      // Triangle pointing up
      page2.drawLine({
        start: { x: circleX, y: circleY + iconSize },
        end: { x: circleX - iconSize * 0.5, y: circleY - iconSize * 0.3 },
        thickness: 2,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX, y: circleY + iconSize },
        end: { x: circleX + iconSize * 0.5, y: circleY - iconSize * 0.3 },
        thickness: 2,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX - iconSize * 0.5, y: circleY - iconSize * 0.3 },
        end: { x: circleX + iconSize * 0.5, y: circleY - iconSize * 0.3 },
        thickness: 2,
        color: goldColor,
      });
      // Flames (small lines at bottom)
      page2.drawLine({
        start: { x: circleX - iconSize * 0.3, y: circleY - iconSize * 0.3 },
        end: { x: circleX - iconSize * 0.5, y: circleY - iconSize * 0.8 },
        thickness: 1.5,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX, y: circleY - iconSize * 0.3 },
        end: { x: circleX, y: circleY - iconSize * 0.9 },
        thickness: 1.5,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX + iconSize * 0.3, y: circleY - iconSize * 0.3 },
        end: { x: circleX + iconSize * 0.5, y: circleY - iconSize * 0.8 },
        thickness: 1.5,
        color: goldColor,
      });
    } else if (i === 3) {
      // Step 4: Calendar grid with magnifying glass
      // Calendar grid
      page2.drawRectangle({
        x: circleX - iconSize * 0.6,
        y: circleY - iconSize * 0.6,
        width: iconSize * 0.9,
        height: iconSize * 1.0,
        borderColor: goldColor,
        borderWidth: 1.8,
      });
      // Grid lines
      page2.drawLine({
        start: { x: circleX - iconSize * 0.6, y: circleY + iconSize * 0.1 },
        end: { x: circleX + iconSize * 0.3, y: circleY + iconSize * 0.1 },
        thickness: 1.2,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX - iconSize * 0.3, y: circleY + iconSize * 0.4 },
        end: { x: circleX - iconSize * 0.3, y: circleY - iconSize * 0.6 },
        thickness: 1.2,
        color: goldColor,
      });
      // Magnifying glass
      page2.drawCircle({
        x: circleX + iconSize * 0.4,
        y: circleY - iconSize * 0.4,
        size: iconSize * 0.35,
        borderColor: goldColor,
        borderWidth: 1.5,
      });
    } else if (i === 4) {
      // Step 5: Treasure chest
      // Chest body (rectangle)
      page2.drawRectangle({
        x: circleX - iconSize * 0.6,
        y: circleY - iconSize * 0.7,
        width: iconSize * 1.2,
        height: iconSize * 0.8,
        borderColor: goldColor,
        borderWidth: 1.8,
      });
      // Chest lid (arc approximation using lines)
      page2.drawLine({
        start: { x: circleX - iconSize * 0.6, y: circleY + iconSize * 0.1 },
        end: { x: circleX - iconSize * 0.3, y: circleY + iconSize * 0.4 },
        thickness: 1.8,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX - iconSize * 0.3, y: circleY + iconSize * 0.4 },
        end: { x: circleX, y: circleY + iconSize * 0.5 },
        thickness: 1.8,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX, y: circleY + iconSize * 0.5 },
        end: { x: circleX + iconSize * 0.3, y: circleY + iconSize * 0.4 },
        thickness: 1.8,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX + iconSize * 0.3, y: circleY + iconSize * 0.4 },
        end: { x: circleX + iconSize * 0.6, y: circleY + iconSize * 0.1 },
        thickness: 1.8,
        color: goldColor,
      });
      // Sparkles (small stars around chest)
      const sparkleSize = mm(1);
      page2.drawLine({
        start: { x: circleX - iconSize * 0.9, y: circleY + iconSize * 0.3 },
        end: { x: circleX - iconSize * 0.9, y: circleY + iconSize * 0.5 },
        thickness: 1,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: circleX - iconSize, y: circleY + iconSize * 0.4 },
        end: { x: circleX - iconSize * 0.8, y: circleY + iconSize * 0.4 },
        thickness: 1,
        color: goldColor,
      });
    }
    
    // Draw label below circle (centered, multi-line)
    const labelLines = flowSteps[i].split('\n');
    const labelLineHeight = mm(3.5);
    let labelY = circleY - circleRadius - mm(5);
    
    for (const line of labelLines) {
      const lineWidth = font.widthOfTextAtSize(line, 8);
      page2.drawText(line, {
        x: circleX - lineWidth / 2,
        y: labelY,
        size: 8,
        font,
        color: crunchCharcoal,
      });
      labelY -= labelLineHeight;
    }
    
    // Draw gold/yellow arrow to next step (except for last step)
    if (i < flowSteps.length - 1) {
      const arrowStartX = circleX + circleRadius + mm(2);
      const arrowEndX = arrowStartX + arrowLength + circleSpacing * 2 - mm(4);
      
      // Arrow line
      page2.drawLine({
        start: { x: arrowStartX, y: circleY },
        end: { x: arrowEndX, y: circleY },
        thickness: 2.5,
        color: goldColor,
      });
      
      // Arrow head
      const arrowHeadSize = mm(2.5);
      page2.drawLine({
        start: { x: arrowEndX, y: circleY },
        end: { x: arrowEndX - arrowHeadSize, y: circleY + arrowHeadSize },
        thickness: 2.5,
        color: goldColor,
      });
      page2.drawLine({
        start: { x: arrowEndX, y: circleY },
        end: { x: arrowEndX - arrowHeadSize, y: circleY - arrowHeadSize },
        thickness: 2.5,
        color: goldColor,
      });
    }
  }

  drawPageNumber(page2, 2, 4);

  // PAGE 3: Project Schedule (Yellow Background)
  const page3 = addPage();
  
  // Draw full-page yellow background (#FFCD03)
  page3.drawRectangle({
    x: 0,
    y: 0,
    width: page3.getSize().width,
    height: page3.getSize().height,
    color: crunchYellow,
  });

  const p3x = mm(20);
  y = page3.getSize().height - mm(25);

  // Heading: "Project Schedule" in charcoal
  page3.drawText('Project Schedule', { x: p3x, y, size: 18, font: bold, color: colors.white });
  y -= mm(12);

  // Description paragraph in black
  const descriptionText = 'The project schedule is based on information as provided by the Client or Client\'s Agent or Solar Installer. The proposal, based on the project schedule, can be amended as required and will be annexed to the Cession Agreement. Note that it may impact the eligibility and structure of the agreement.';
  const descriptionLines = wrapText(descriptionText, page3.getSize().width - p3x * 2, 11, font);
  for (const line of descriptionLines) {
    page3.drawText(line, { x: p3x, y, size: 11, font, color: crunchCharcoal });
    y -= mm(5.5);
  }

    y -= mm(2);

  // Draw table with yellow background and black borders - 3 columns design
  const scheduleTableX = p3x;
  const scheduleTableY = y - mm(2.5);
  const scheduleTableWidth = page3.getSize().width - p3x * 2;
  
  // Calculate available height for table (to bottom margin)
  const availableHeight = scheduleTableY - mm(30);
  const scheduleRowHeight = mm(9.5);
  const headerRowHeight = mm(12); // Taller header row
  const maxRows = Math.floor(availableHeight / scheduleRowHeight) - 1; // -1 for header and totals
  const scheduleTableHeight = maxRows * scheduleRowHeight + headerRowHeight; // Use headerRowHeight for header
  
  // Draw outer black border
  page3.drawRectangle({
    x: scheduleTableX,
    y: scheduleTableY - scheduleTableHeight,
    width: scheduleTableWidth,
    height: scheduleTableHeight,
    color: crunchYellow, // yellow background matching page
    borderColor: crunchCharcoal, // charcoal border
    borderWidth: 1.5,
  });

  // Extract project data — one row per phase, kWp or kWh-total depending on mode
  const projects = normalisedPhases.map((p) => {
    const sizeLabel = _generationMode === 'kwh'
      ? `${fmtNum(phaseTotalKwh(p))} kWh total`
      : fmtNum(p.sizeKWp, ' kWp');
    return {
      address: p.address || 'To be confirmed',
      commissionDate: p.commissionDate
        ? new Date(p.commissionDate).toLocaleDateString()
        : 'To be confirmed',
      sizeKwp: p.sizeKWp,
      sizeLabel,
    };
  });

  // Calculate column widths and positions
  const col1Width = scheduleTableWidth * 0.50; // Project Address
  const col2Width = scheduleTableWidth * 0.25; // Commissioning Date
  const col3Width = scheduleTableWidth * 0.25; // Project Size kWp
  
  const tableLeftMargin = scheduleTableX + mm(4);
  const col1X = tableLeftMargin;
  const col2X = col1X + col1Width;
  const col3X = col2X + col2Width;
  
  // Calculate column centers for text alignment
  const col1Center = col1X + (col1Width / 2);
  const col2Center = col2X + (col2Width / 2);
  const col3Center = col3X + (col3Width / 2);
  
  const verticalCenterOffset = mm(1);
  const headerVerticalCenter = mm(3); // Vertical centering for taller header row

  // Draw header row with text wrapping
  const headerY = scheduleTableY - headerRowHeight;
  
  // Header 1: Project Address
  const header1Text = 'Project Address';
  const header1Width = col1Width - mm(4);
  const header1Lines = wrapText(header1Text, header1Width, 11, bold);
  const maxHeaderLines = Math.max(1, header1Lines.length);
  const headerLineHeight = mm(4.5);
  const header1StartY = headerY + (headerRowHeight / 2) + ((maxHeaderLines - 1) * headerLineHeight / 2);
  
  header1Lines.forEach((line, idx) => {
    page3.drawText(line, { 
      x: col1X + mm(2), 
      y: header1StartY - (idx * headerLineHeight), 
      size: 11, 
      font: bold, 
      color: rgb(1, 1, 1)
    });
  });
  
  // Header 2: Commissioning Date
  const header2Text = 'Commissioning Date';
  const header2Width = col2Width - mm(4);
  const header2Lines = wrapText(header2Text, header2Width, 11, bold);
  const header2StartY = headerY + (headerRowHeight / 2) + ((header2Lines.length - 1) * headerLineHeight / 2);
  
  header2Lines.forEach((line, idx) => {
    const lineWidth = bold.widthOfTextAtSize(line, 11);
    page3.drawText(line, { 
      x: col2Center - (lineWidth / 2), 
      y: header2StartY - (idx * headerLineHeight), 
      size: 11, 
      font: bold, 
      color: rgb(1, 1, 1)
    });
  });
  
  // Header 3: Project Size (kWp)
  const header3Text = _generationMode === 'kwh' ? 'Project Size (kWh)' : 'Project Size (kWp)';
  const header3Width = col3Width - mm(4);
  const header3Lines = wrapText(header3Text, header3Width, 11, bold);
  const header3StartY = headerY + (headerRowHeight / 2) + ((header3Lines.length - 1) * headerLineHeight / 2);
  
  header3Lines.forEach((line, idx) => {
    const lineWidth = bold.widthOfTextAtSize(line, 11);
    page3.drawText(line, { 
      x: col3Center - (lineWidth / 2), 
      y: header3StartY - (idx * headerLineHeight), 
      size: 11, 
      font: bold, 
      color: rgb(1, 1, 1)
    });
  });
  
  // Draw horizontal line after header
  page3.drawRectangle({
    x: scheduleTableX,
    y: scheduleTableY - headerRowHeight,
    width: scheduleTableWidth,
    height: 1,
    color: crunchCharcoal,
  });

  // Draw project data rows with comprehensive text wrapping
  let currentRow = 0;
  let cumulativeRowHeight = 0;
  const dataLineHeight = mm(4.5);
  const maxLinesPerCell = 3; // Safety limit
  
  for (const project of projects) {
    // Wrap text for all three columns
    const col1AvailWidth = col1Width - mm(4);
    const col2AvailWidth = col2Width - mm(4);
    const col3AvailWidth = col3Width - mm(4);
    
    // Column 1: Address (with line limit)
    let addressLines = wrapText(project.address, col1AvailWidth, 10, font);
    if (addressLines.length > maxLinesPerCell) {
      addressLines = addressLines.slice(0, maxLinesPerCell);
      addressLines[maxLinesPerCell - 1] = addressLines[maxLinesPerCell - 1].substring(0, addressLines[maxLinesPerCell - 1].length - 3) + '...';
    }
    
    // Column 2: Commissioning Date (with line limit)
    const dateText = String(project.commissionDate);
    let dateLines = wrapText(dateText, col2AvailWidth, 10, font);
    if (dateLines.length > maxLinesPerCell) {
      dateLines = dateLines.slice(0, maxLinesPerCell);
      dateLines[maxLinesPerCell - 1] = dateLines[maxLinesPerCell - 1].substring(0, dateLines[maxLinesPerCell - 1].length - 3) + '...';
    }
    
    // Column 3: Project Size (with line limit)
    const kwpText = (project as any).sizeLabel || fmtNum(project.sizeKwp, ' kWp');
    let kwpLines = wrapText(kwpText, col3AvailWidth, 10, font);
    if (kwpLines.length > maxLinesPerCell) {
      kwpLines = kwpLines.slice(0, maxLinesPerCell);
      kwpLines[maxLinesPerCell - 1] = kwpLines[maxLinesPerCell - 1].substring(0, kwpLines[maxLinesPerCell - 1].length - 3) + '...';
    }
    
    // Calculate dynamic row height based on tallest column
    const maxLines = Math.max(addressLines.length, dateLines.length, kwpLines.length);
    const dynamicRowHeight = Math.max(scheduleRowHeight, mm(5) + (maxLines * dataLineHeight));
    
    // Calculate row Y position
    const rowY = scheduleTableY - headerRowHeight - cumulativeRowHeight - dynamicRowHeight;
    
    // Calculate vertical centering for this row
    const rowCenterY = rowY + (dynamicRowHeight / 2) + ((maxLines - 1) * dataLineHeight / 2);
    
    // Draw Column 1: Address (left-aligned)
    addressLines.forEach((line, idx) => {
      page3.drawText(line, { 
        x: col1X + mm(2), 
        y: rowCenterY - (idx * dataLineHeight), 
        size: 10, 
        font, 
        color: crunchCharcoal
      });
    });
    
    // Draw Column 2: Commissioning Date (center-aligned)
    dateLines.forEach((line, idx) => {
      const lineWidth = font.widthOfTextAtSize(line, 10);
      page3.drawText(line, { 
        x: col2Center - (lineWidth / 2), 
        y: rowCenterY - (idx * dataLineHeight), 
        size: 10, 
        font, 
        color: crunchCharcoal
      });
    });
    
    // Draw Column 3: Project Size (center-aligned)
    kwpLines.forEach((line, idx) => {
      const lineWidth = font.widthOfTextAtSize(line, 10);
      page3.drawText(line, { 
        x: col3Center - (lineWidth / 2), 
        y: rowCenterY - (idx * dataLineHeight), 
        size: 10, 
        font, 
        color: crunchCharcoal
      });
    });
    
    // Draw horizontal line after this row
    page3.drawRectangle({
      x: scheduleTableX,
      y: rowY,
      width: scheduleTableWidth,
      height: 1,
      color: crunchCharcoal,
    });
    
    cumulativeRowHeight += dynamicRowHeight;
    currentRow++;
  }

  // Draw remaining empty rows to fill the table
  const remainingHeight = scheduleTableHeight - headerRowHeight - cumulativeRowHeight - scheduleRowHeight;
  const remainingRows = Math.floor(remainingHeight / scheduleRowHeight);
  
  for (let i = 0; i < remainingRows; i++) {
    const emptyRowY = scheduleTableY - headerRowHeight - cumulativeRowHeight - ((i + 1) * scheduleRowHeight);
    page3.drawRectangle({
      x: scheduleTableX,
      y: emptyRowY,
      width: scheduleTableWidth,
      height: 1,
      color: crunchCharcoal,
    });
  }

  // Draw totals row at the bottom
  const totalKwp = projects.reduce((sum, p) => sum + (p.sizeKwp || 0), 0);
  const totalKwhAllPhases = normalisedPhases.reduce((s, p) => s + phaseTotalKwh(p), 0);
  const totalsY = scheduleTableY - scheduleTableHeight + scheduleRowHeight;
  
  // Draw thicker line above totals
  page3.drawRectangle({
    x: scheduleTableX,
    y: totalsY + scheduleRowHeight,
    width: scheduleTableWidth,
    height: 1.5,
    color: crunchCharcoal,
  });
  
  const totalText = 'TOTAL';
  const totalTextWidth = bold.widthOfTextAtSize(totalText, 10);
  page3.drawText(totalText, { 
    x: col1X + mm(2), 
    y: totalsY + verticalCenterOffset, 
    size: 10, 
    font: bold, 
    color: crunchCharcoal
  });
  
  const totalKwpText = _generationMode === 'kwh'
    ? `${fmtNum(totalKwhAllPhases)} kWh`
    : fmtNum(totalKwp, ' kWp');
  const totalKwpWidth = bold.widthOfTextAtSize(totalKwpText, 10);
  page3.drawText(totalKwpText, { 
    x: col3Center - (totalKwpWidth / 2), 
    y: totalsY + verticalCenterOffset, 
    size: 10, 
    font: bold, 
    color: crunchCharcoal
  });

  // Draw vertical dividers between columns
  page3.drawRectangle({
    x: col2X,
    y: scheduleTableY - scheduleTableHeight,
    width: 1,
    height: scheduleTableHeight,
    color: crunchCharcoal,
  });
  page3.drawRectangle({
    x: col3X,
    y: scheduleTableY - scheduleTableHeight,
    width: 1,
    height: scheduleTableHeight,
    color: crunchCharcoal,
  });

  drawPageNumber(page3, 3, 4);

  // PAGE 4: Revenue Share
  const page4 = addPage();
  // Add yellow background
  page4.drawRectangle({
    x: 0,
    y: 0,
    width: page4.getSize().width,
    height: page4.getSize().height,
    color: crunchYellow,
  });
  const p4x = mm(20);
  y = page4.getSize().height - mm(25);

  drawHeading(page4, 'Revenue Share', p4x, y);
  y -= mm(12);

  // Introductory paragraph
  const introText = 'As can be seen in the table below there are material benefits that will be realised through working together. The benefits accumulate over time in line with our values of being a long term partner with yourselves.';
  const introLines = wrapText(introText, page4.getSize().width - p4x * 2, 11, font);
  for (const line of introLines) {
    page4.drawText(line, { x: p4x, y, size: 11, font, color: crunchCharcoal });
    y -= mm(5.5);
  }
  y -= mm(4);

  // Fetch dynamic carbon prices from system_settings
  const { data: carbonPricesData } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'carbon_prices')
    .maybeSingle();

  const carbonPrices: Record<string, number> = carbonPricesData?.setting_value || {
    '2025': 30, '2026': 32, '2027': 35, '2028': 38, '2029': 40, '2030': 42, '2031': 45
  };

  // Calculate revenue table data using real Crunch Carbon constants
  const systemSizeKWp = anyProposal.system_size_kwp || 500;
  const clientSharePercentage = anyProposal.client_share_percentage || 60;
  
  // Official Crunch Carbon calculation constants (matching frontend exactly)
  const ANNUAL_GENERATION_FACTOR = 1642.50; // kWh per kWp per year
  const EMISSION_FACTOR = 1.0334; // tCO₂e per MWh
  
  // Extract commission date for pro-rating
  const commissionDateStr = anyProposal.project_info?.commission_date || 
                            anyProposal.content?.projectInfo?.commissionDate || null;
  const commissionDate = commissionDateStr ? new Date(commissionDateStr) : null;
  
  // Get minimum vintage year from configuration
  const currentYear = await getMinimumVintageYear(supabaseAdmin);
  
  // Calculate yearly energy with pro-rating for commission year (matching frontend logic)
  const calculateYearlyEnergy = (systemKWp: number, actualYear: number): number => {
    const annualEnergy = systemKWp * ANNUAL_GENERATION_FACTOR;
    
    // Return 0 for years before commissioning
    if (commissionDate && actualYear < commissionDate.getFullYear()) {
      return 0;
    }
    
    // Pro-rate only for the ACTUAL commission year (not artificially moved forward)
    if (commissionDate && actualYear === commissionDate.getFullYear()) {
      const yearStart = new Date(actualYear, 0, 1);
      const yearEnd = new Date(actualYear, 11, 31);
      const remainingDays = Math.max(0, Math.floor((yearEnd.getTime() - commissionDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const totalDaysInYear = Math.floor((yearEnd.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return annualEnergy * (remainingDays / totalDaysInYear);
    }
    
    // Full year for years after commission year
    return annualEnergy;
  };
  
  // Calculate yearly carbon credits
  const calculateYearlyCarbonCredits = (yearlyEnergyKWh: number): number => {
    return (yearlyEnergyKWh / 1000) * EMISSION_FACTOR;
  };

  // Build table data for 7 years using real calculations
  interface RevenueRow {
    year: number;
    mwhGenerated: number;
    tco2Offset: number;
    clientPrice: number;
    clientRevenue: number;
  }
  
  const revenueData: RevenueRow[] = [];
  let totalMWh = 0;
  let totalTCO2 = 0;
  let totalRevenue = 0;
  
  // Build table using available carbon price years (filtered to current/future only)
  const availableYears = Object.keys(carbonPrices)
    .map(y => parseInt(y))
    .filter(y => y >= currentYear)
    .sort((a, b) => a - b);

  for (const actualYear of availableYears) {
    // Use real calculation functions
    // Use normalised generation model (handles kWh mode + multi-phase)
    const yearlyEnergyKWh = totalKwhForYear(actualYear);
    const yearlyEnergyMWh = yearlyEnergyKWh / 1000;
    const yearlyCarbonCredits = (yearlyEnergyKWh / 1000) * PDF_EMISSION_FACTOR;
    
    // Get dynamic market price for this year
    const marketPrice = carbonPrices[actualYear.toString()] || 0;
    
    // Calculate client-specific price (market price × client share)
    const clientPrice = marketPrice * (clientSharePercentage / 100);
    
    // Calculate client revenue (carbon credits × client price)
    const yearlyClientRevenue = yearlyCarbonCredits * clientPrice;
    
    revenueData.push({
      year: actualYear,
      mwhGenerated: yearlyEnergyMWh,
      tco2Offset: yearlyCarbonCredits,
      clientPrice,
      clientRevenue: yearlyClientRevenue
    });
    
    totalMWh += yearlyEnergyMWh;
    totalTCO2 += yearlyCarbonCredits;
    totalRevenue += yearlyClientRevenue;
  }

  // Draw revenue table
  const revenueTableX = p4x;
  const revenueTableY = y;
  const revenueTableWidth = page4.getSize().width - p4x * 2;
  const revenueRowHeight = mm(12);
  const revenueTableHeight = revenueRowHeight * (revenueData.length + 2); // Header + data rows + totals row
  
  // Draw outer border
  page4.drawRectangle({
    x: revenueTableX,
    y: revenueTableY - revenueTableHeight,
    width: revenueTableWidth,
    height: revenueTableHeight,
    color: crunchYellow,
    borderColor: crunchCharcoal,
    borderWidth: 1.5,
  });

  // Column widths
  const colYearWidth = revenueTableWidth * 0.10;
  const colMWhWidth = revenueTableWidth * 0.20;
  const colTCO2Width = revenueTableWidth * 0.20;
  const colPriceWidth = revenueTableWidth * 0.25;
  const colRevenueWidth = revenueTableWidth * 0.25;
  
  const colYearX = revenueTableX;
  const colMWhX = colYearX + colYearWidth;
  const colTCO2X = colMWhX + colMWhWidth;
  const colPriceX = colTCO2X + colTCO2Width;
  const colRevenueX = colPriceX + colPriceWidth;
  
  // Draw vertical column dividers
  const dividerX = [colMWhX, colTCO2X, colPriceX, colRevenueX];
  for (const dx of dividerX) {
    page4.drawLine({
      start: { x: dx, y: revenueTableY },
      end: { x: dx, y: revenueTableY - revenueTableHeight },
      thickness: 1,
      color: crunchCharcoal,
    });
  }
  
  const verticalOffset = mm(2);
  
  // Helper to center text in column
  const centerTextInColumn = (text: string, colX: number, colWidth: number, yPos: number, textFont: any, fontSize: number) => {
    const sanitized = sanitizeText(text);
    const textWidth = textFont.widthOfTextAtSize(sanitized, fontSize);
    return colX + (colWidth / 2) - (textWidth / 2);
  };
  
  // Helper to left-align text in column with padding
  const leftTextInColumn = (colX: number) => {
    return colX + mm(2);
  };
  
  // Helper to right-align text in column with padding
  const rightTextInColumn = (text: string, colX: number, colWidth: number, textFont: any, fontSize: number) => {
    const sanitized = sanitizeText(text);
    const textWidth = textFont.widthOfTextAtSize(sanitized, fontSize);
    return colX + colWidth - textWidth - mm(2); // Right edge minus text width minus padding
  };

  // Draw header row
  let currentRowY = revenueTableY - revenueRowHeight;
  
  // Draw yellow header background
  page4.drawRectangle({
    x: revenueTableX,
    y: currentRowY,
    width: revenueTableWidth,
    height: revenueRowHeight,
    color: crunchYellow,
  });
  
  // Draw top border of header row
  page4.drawLine({
    start: { x: revenueTableX, y: revenueTableY },
    end: { x: revenueTableX + revenueTableWidth, y: revenueTableY },
    thickness: 1,
    color: crunchCharcoal,
  });
  
  // Redraw vertical dividers for header row (after yellow background)
  for (const dx of dividerX) {
    page4.drawLine({
      start: { x: dx, y: revenueTableY },
      end: { x: dx, y: currentRowY },
      thickness: 1,
      color: crunchCharcoal,
    });
  }
  
  // Draw bottom border of header row
  page4.drawLine({
    start: { x: revenueTableX, y: currentRowY },
    end: { x: revenueTableX + revenueTableWidth, y: currentRowY },
    thickness: 1,
    color: crunchCharcoal,
  });
  
  const headers = ['Year', 'MWh Generated\nper Year', 'tCO2e Offset\nper Year', 'Client Price\n(R/tCO2e)', 'Client Revenue (R)\nper Year'];
  const headerCols = [
    { x: leftTextInColumn(colYearX), text: headers[0] },
    { x: centerTextInColumn(headers[1].split('\n')[0], colMWhX, colMWhWidth, 0, bold, 11), text: headers[1] },
    { x: centerTextInColumn(headers[2].split('\n')[0], colTCO2X, colTCO2Width, 0, bold, 11), text: headers[2] },
    { x: centerTextInColumn(headers[3].split('\n')[0], colPriceX, colPriceWidth, 0, bold, 11), text: headers[3] },
    { x: centerTextInColumn(headers[4].split('\n')[0], colRevenueX, colRevenueWidth, 0, bold, 11), text: headers[4] },
  ];
  
  headerCols.forEach((col, idx) => {
    const lines = col.text.split('\n');
    let lineY = currentRowY + verticalOffset + mm(3.5);
    lines.forEach((line, lineIdx) => {
      const fontSize = 11;
      const xPos = idx === 0 ? col.x : centerTextInColumn(line, 
        idx === 1 ? colMWhX : idx === 2 ? colTCO2X : idx === 3 ? colPriceX : colRevenueX,
        idx === 1 ? colMWhWidth : idx === 2 ? colTCO2Width : idx === 3 ? colPriceWidth : colRevenueWidth,
        0, bold, fontSize
      );
      page4.drawText(line, { 
        x: xPos, 
        y: lineY - (lineIdx * mm(3.5)), 
        size: fontSize, 
        font: bold, 
        color: rgb(1, 1, 1)
      });
    });
  });
  
  currentRowY -= revenueRowHeight;

  // Draw data rows
  for (const row of revenueData) {
    page4.drawLine({
      start: { x: revenueTableX, y: currentRowY },
      end: { x: revenueTableX + revenueTableWidth, y: currentRowY },
      thickness: 1,
      color: crunchCharcoal,
    });
    
    // Year (left-aligned)
    page4.drawText(row.year.toString(), { 
      x: leftTextInColumn(colYearX), 
      y: currentRowY + verticalOffset, 
      size: 11, 
      font, 
      color: crunchCharcoal 
    });
    
    // MWh Generated (center-aligned, 2 decimals)
    const mwhText = row.mwhGenerated.toFixed(2);
    page4.drawText(mwhText, { 
      x: centerTextInColumn(mwhText, colMWhX, colMWhWidth, 0, font, 11), 
      y: currentRowY + verticalOffset, 
      size: 11, 
      font, 
      color: crunchCharcoal 
    });
    
    // tCO₂e Offset (center-aligned, 2 decimals)
    const tco2Text = row.tco2Offset.toFixed(2);
    page4.drawText(tco2Text, { 
      x: centerTextInColumn(tco2Text, colTCO2X, colTCO2Width, 0, font, 11), 
      y: currentRowY + verticalOffset, 
      size: 11, 
      font, 
      color: crunchCharcoal 
    });
    
    // Client Price (center-aligned)
    const priceText = `R ${row.clientPrice.toFixed(2)}`;
    page4.drawText(priceText, { 
      x: centerTextInColumn(priceText, colPriceX, colPriceWidth, 0, font, 11), 
      y: currentRowY + verticalOffset, 
      size: 11, 
      font, 
      color: crunchCharcoal 
    });
    
    // Client Revenue (right-aligned, with commas)
    const revenueText = `R ${row.clientRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    page4.drawText(revenueText, { 
      x: rightTextInColumn(revenueText, colRevenueX, colRevenueWidth, font, 11), 
      y: currentRowY + verticalOffset, 
      size: 11, 
      font, 
      color: crunchCharcoal 
    });
    
    currentRowY -= revenueRowHeight;
  }

  // Draw totals row
  page4.drawLine({
    start: { x: revenueTableX, y: currentRowY },
    end: { x: revenueTableX + revenueTableWidth, y: currentRowY },
    thickness: 1.5,
    color: crunchCharcoal,
  });
  
  // "TOTAL" text (left-aligned, bold)
  page4.drawText('TOTAL', { 
    x: leftTextInColumn(colYearX), 
    y: currentRowY + verticalOffset, 
    size: 11, 
    font: bold, 
    color: crunchCharcoal 
  });
  
  // Total MWh
  const totalMWhText = totalMWh.toFixed(2);
  page4.drawText(totalMWhText, { 
    x: centerTextInColumn(totalMWhText, colMWhX, colMWhWidth, 0, bold, 11), 
    y: currentRowY + verticalOffset, 
    size: 11, 
    font: bold, 
    color: crunchCharcoal 
  });
  
  // Total tCO₂e
  const totalTCO2Text = totalTCO2.toFixed(2);
  page4.drawText(totalTCO2Text, { 
    x: centerTextInColumn(totalTCO2Text, colTCO2X, colTCO2Width, 0, bold, 11), 
    y: currentRowY + verticalOffset, 
    size: 11, 
    font: bold, 
    color: crunchCharcoal 
  });
  
  // Price column shows "-" for totals
  const dashText = '-';
  page4.drawText(dashText, { 
    x: centerTextInColumn(dashText, colPriceX, colPriceWidth, 0, bold, 11), 
    y: currentRowY + verticalOffset, 
    size: 11, 
    font: bold, 
    color: crunchCharcoal 
  });
  
  // Total Revenue
  const totalRevenueText = `R ${totalRevenue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  page4.drawText(totalRevenueText, { 
    x: rightTextInColumn(totalRevenueText, colRevenueX, colRevenueWidth, bold, 11), 
    y: currentRowY + verticalOffset, 
    size: 11, 
    font: bold, 
    color: crunchCharcoal 
  });

  // Disclaimer text below table
  y = currentRowY - mm(8);
  const disclaimerText = '*Note that the above numbers are assumptions & indicative. The Client Price shown is the market carbon price multiplied by your client share percentage. Final costs will be based on data as provided from the various systems as installed and validated via our auditing partners. While we aim to maintain the carbon pricing rates as per the schedule we cannot be held liable for any changes due to regulatory shifts, or legal requirements beyond our control which may necessitate adjustments. This document is strictly confidential and intended solely for the recipient. The validity of the information contained herein expires seven (7) working days from the date of submission. Unauthorised sharing, distribution, or reproduction of this document constitutes a breach of confidentiality and may render the document null and void.';
  const disclaimerLines = wrapText(disclaimerText, page4.getSize().width - p4x * 2, 8, font);
  for (const line of disclaimerLines) {
    page4.drawText(line, { x: p4x, y, size: 8, font, color: crunchCharcoal });
    y -= mm(3.5);
  }

  // Acceptance section on page 4
  y -= mm(15);
  drawHeading(page4, 'Acceptance', p4x, y);
  y -= mm(12);
  
  // Digital Signature Section - for unsigned proposals (draft, sent, delivered, opened, viewed, stale)
  const unsignedStatuses = ['draft', 'sent', 'delivered', 'opened', 'viewed', 'stale'];
  const isUnsigned = unsignedStatuses.includes(proposal.status);
  console.log('[PDF] Signature section check:', {
    status: proposal.status,
    hasInvitationToken: !!proposal.invitation_token,
    tokenLength: proposal.invitation_token?.length || 0,
    hasExpiresAt: !!proposal.invitation_expires_at,
    expiresAt: proposal.invitation_expires_at,
    willShowSignature: isUnsigned && !!proposal.invitation_token && !!proposal.invitation_expires_at
  });
  
  if (isUnsigned && proposal.invitation_token && proposal.invitation_expires_at) {
    y -= mm(2);
    
    const siteUrl = Deno.env.get('SITE_URL') || 'https://crunchcarbon.com';
    const acceptanceUrl = `${siteUrl}/proposals/${proposal.id}/accept?token=${proposal.invitation_token}`;
    
    // Calculate days until expiry
    const expiryDate = new Date(proposal.invitation_expires_at);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    console.log('[PDF] Creating digital signature link:', {
      proposalId: proposal.id,
      status: proposal.status,
      siteUrl,
      fullUrl: acceptanceUrl,
      tokenLength: proposal.invitation_token.length,
      expiresAt: proposal.invitation_expires_at,
      daysUntilExpiry
    });
    
    // Draw highlighted box for digital signature
    const boxY = y;
    const boxHeight = mm(42);
    const boxWidth = page4.getSize().width - p4x * 2;
    
    // Background box (light yellow/cream)
    page4.drawRectangle({
      x: p4x,
      y: boxY - boxHeight,
      width: boxWidth,
      height: boxHeight,
      color: rgb(1, 0.98, 0.9), // Light yellow/cream background
      borderColor: rgb(0.9, 0.72, 0.01), // Darker yellow-gold border
      borderWidth: 2,
    });
    
    y -= mm(6);
    page4.drawText('Digital Signature', { 
      x: p4x + mm(5), 
      y, 
      size: 12, 
      font: bold,
      color: crunchCharcoal 
    });
    
    y -= mm(6);
    const instructionText = 'To accept this proposal please sign digitally below:';
    const instructionLines = wrapText(instructionText, boxWidth - mm(10), 12, font);
    for (const line of instructionLines) {
      page4.drawText(line, { 
        x: p4x + mm(5), 
        y, 
        size: 12, 
        font, 
        color: crunchCharcoal 
      });
      y -= mm(4);
    }
    
    y -= mm(8);
    // Create clickable link with underline
    const linkText = 'CLICK HERE TO SIGN DIGITALLY';
    const linkWidth = bold.widthOfTextAtSize(linkText, 12);
    const linkX = p4x + mm(5);
    
    page4.drawText(linkText, { 
      x: linkX, 
      y, 
      size: 12, 
      font: bold, 
      color: rgb(0.9, 0.72, 0.01) // Yellow-gold color for link
    });
    
    // Draw underline to make it obviously clickable
    page4.drawLine({
      start: { x: linkX, y: y - mm(1) },
      end: { x: linkX + linkWidth, y: y - mm(1) },
      thickness: 1,
      color: rgb(0.9, 0.72, 0.01),
    });
    
    // Add link annotation to make it clickable
    const linkAnnotation = pdfDoc.context.register(
      pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [linkX, y - mm(2), linkX + linkWidth, y + mm(5)],
        Border: [0, 0, 0],
        C: [0.9, 0.72, 0.01],
        A: {
          Type: 'Action',
          S: 'URI',
          URI: PDFString.of(acceptanceUrl),
        },
      })
    );
    
    // Get existing annotations and append the new one
    const existingAnnots = page4.node.get(PDFName.of('Annots'));
    const annotsArray = existingAnnots ? existingAnnots : pdfDoc.context.obj([]);
    
    if (annotsArray instanceof PDFArray) {
      annotsArray.push(linkAnnotation);
      page4.node.set(PDFName.of('Annots'), annotsArray);
    } else {
      page4.node.set(PDFName.of('Annots'), pdfDoc.context.obj([linkAnnotation]));
    }
    
    console.log('[PDF] Link annotation created successfully');
    
    y -= mm(6);
    // Display the full URL as fallback
    page4.drawText('Or copy this link:', { 
      x: p4x + mm(5), 
      y, 
      size: 12, 
      font, 
      color: crunchCharcoal 
    });
    
    y -= mm(4);
    const urlLines = wrapUrl(acceptanceUrl, boxWidth - mm(10), 7, font);
    for (const line of urlLines) {
      page4.drawText(line, { 
        x: p4x + mm(5), 
        y, 
        size: 7, 
        font, 
        color: rgb(0.9, 0.72, 0.01) 
      });
      y -= mm(3.5);
    }
    
    y -= mm(4);
    const validityText = `This link is valid for ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. You'll review full terms and type your name to complete the signature.`;
    const validityLines = wrapText(validityText, boxWidth - mm(10), 9, font);
    for (const line of validityLines) {
      page4.drawText(line, { x: p4x + mm(5), y, size: 9, font, color: crunchCharcoal });
      y -= mm(3.5);
    }
    
    y -= mm(8);
  } else if (proposal.status === 'signed' && proposal.signed_at) {
    // Show signed status for approved proposals
    y -= mm(8);
    const signedDate = new Date(proposal.signed_at).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const signedText = `[SIGNED] This proposal was digitally signed on ${signedDate}`;
    page4.drawText(signedText, {
      x: p4x,
      y,
      size: 10,
      font: bold,
      color: rgb(0.13, 0.55, 0.13) // Green color
    });
    
    y -= mm(8);
    console.log('[PDF] Showing signed status for approved proposal');
  }

  drawPageNumber(page4, 4, 4);

  const bytes = await pdfDoc.save();
  console.log(`PDF generated in ${Date.now() - start}ms, pages: ${pdfDoc.getPages().length}`);
  return bytes;
}
