
import { Resend } from "npm:resend@2.0.0";
import { EmailTemplateData } from "./types.ts";

const BRAND = {
  yellow: "#FFC400",
  ink: "#1A1A1A",
  inkMuted: "#5C5C5C",
  border: "#E6E6E6",
  surfaceAlt: "#FAFAFA",
  logoUrl: "https://crunchcarbon.com/lovable-uploads/c818a4d4-97db-4b88-bd74-801376152ebc.png",
};

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

export class EmailService {
  private resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  generateEmailTemplate(data: EmailTemplateData): string {
    const hasNamedAgent = Boolean(data.agentFirstName && data.agentLastName);
    const agentName = hasNamedAgent
      ? `${escapeHtml(data.agentFirstName ?? "")} ${escapeHtml(data.agentLastName ?? "")}`
      : "the Crunch Carbon team";
    const agentAffiliation = hasNamedAgent && data.agentCompanyName
      ? `${agentName} from ${escapeHtml(data.agentCompanyName)}`
      : agentName;
    const contactEmail = escapeHtml(data.agentEmail || "proposals@crunchcarbon.com");
    const contactSentence = hasNamedAgent
      ? `If you have questions, or you did not expect this email, please contact ${agentName} at <a href="mailto:${contactEmail}" style="color:${BRAND.ink};font-weight:700">${contactEmail}</a>${data.agentEmail ? " (copied on this email too)" : ""}.`
      : `If you have questions, or you did not expect this email, please contact us at <a href="mailto:${contactEmail}" style="color:${BRAND.ink};font-weight:700">${contactEmail}</a>.`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Your Crunch Carbon proposal</title>
<style>
  @media only screen and (max-width:520px) {
    .proposal-action-cell { display:block !important; width:100% !important; padding:5px 0 !important; }
    .proposal-action-link { display:block !important; }
    .email-gutter { padding-left:20px !important; padding-right:20px !important; }
    .brand-logo { width:170px !important; max-width:170px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#ffffff;opacity:0">Review, accept and sign, or decline your solar carbon proposal.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
  <tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden">

      <tr><td class="email-gutter" style="background:#ffffff;padding:22px 30px;border-bottom:3px solid ${BRAND.yellow}">
        <table role="presentation" width="100%"><tr>
          <td>
            <a href="https://crunchcarbon.com" target="_blank" style="text-decoration:none">
              <img class="brand-logo" src="${BRAND.logoUrl}" width="220" alt="Crunch Carbon" style="display:block;border:0;outline:none;text-decoration:none;width:220px;max-width:220px;height:auto" />
            </a>
          </td>
          <td align="right" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;color:${BRAND.inkMuted};letter-spacing:1px;text-transform:uppercase">Solar Carbon Credits</td>
        </tr></table>
      </td></tr>

      <tr><td class="email-gutter" style="padding:28px 30px 0 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.ink};line-height:1.65">
        Dear <strong>${escapeHtml(data.clientName)}</strong>,
      </td></tr>

      <tr><td class="email-gutter" style="padding:14px 30px 0 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.inkMuted};line-height:1.7">
        ${agentAffiliation} prepared this proposal for the solar system you have installed. It sets out the potential earnings from your solar system through carbon credits with the Crunch Carbon team.
        <div style="height:10px;line-height:10px">&nbsp;</div>
        ${contactSentence}
      </td></tr>

      <tr><td class="email-gutter" style="padding:20px 30px 0 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${BRAND.ink};line-height:1.7">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.surfaceAlt};border:1px solid ${BRAND.border};border-radius:10px">
          <tr><td style="padding:18px 18px 10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:17px;color:${BRAND.ink};line-height:1.5">
            <strong>What happens next?</strong>
          </td></tr>
          <tr><td style="padding:0 18px 10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.inkMuted};line-height:1.6">
            You are in control. Choose one of the options below and we'll take care of the rest.
          </td></tr>
          <tr><td style="padding:12px 18px;border-top:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.ink};line-height:1.7">
            <strong style="color:${BRAND.ink}">Review your proposal first</strong><br/>
            Open your proposal on the Crunch Carbon platform, read through the details, and decide when you're ready.
          </td></tr>
          <tr><td style="padding:12px 18px;border-top:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.ink};line-height:1.7">
            <strong style="color:${BRAND.ink}">Accept &amp; sign online</strong><br/>
            Ready to move forward? Accept the proposal and sign the Cession Agreement securely in just a few clicks.
          </td></tr>
          <tr><td style="padding:12px 18px 16px 18px;border-top:1px solid ${BRAND.border};font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.ink};line-height:1.7">
            <strong style="color:${BRAND.ink}">Decline this proposal</strong><br/>
            If this isn't right for you, select Decline and we'll close this proposal with no follow-up pressure.
          </td></tr>
        </table>
      </td></tr>

      <tr><td class="email-gutter" style="padding:18px 26px 0 26px">
        <table class="proposal-actions" role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td class="proposal-action-cell" width="33.33%" style="padding:4px">
              <a class="proposal-action-link" href="${data.viewLink}" target="_blank" style="display:block;padding:14px 6px;border-radius:8px;background:#22C55E;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-align:center;text-decoration:none;white-space:nowrap">Review Proposal</a>
            </td>
            <td class="proposal-action-cell" width="33.33%" style="padding:4px">
              <a class="proposal-action-link" href="${data.acceptLink}" target="_blank" style="display:block;padding:14px 6px;border-radius:8px;background:${BRAND.yellow};font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:${BRAND.ink};text-align:center;text-decoration:none;white-space:nowrap">Accept &amp; Sign</a>
            </td>
            <td class="proposal-action-cell" width="33.33%" style="padding:4px">
              <a class="proposal-action-link" href="${data.declineLink}" target="_blank" style="display:block;padding:14px 6px;border-radius:8px;background:#DC2626;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;color:#ffffff;text-align:center;text-decoration:none;white-space:nowrap">Decline</a>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td class="email-gutter" style="padding:20px 30px 0 30px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${BRAND.inkMuted};line-height:1.6">
        All figures are estimates based on the system details provided and current carbon-credit assumptions. Actual income depends on verified generation from your system, audit outcomes and market prices at the time of sale. No account or password is required to sign — the link above opens your proposal directly and is valid for 10 days.
      </td></tr>

      <tr><td class="email-gutter" style="padding:24px 30px 22px 30px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:${BRAND.ink};line-height:1.6">
        Warm regards,<br/><strong>The Crunch Carbon Team</strong>
      </td></tr>

      <tr><td style="background:${BRAND.ink};padding:20px 30px 24px 30px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#ffffff;line-height:1.6">
        Crunch Carbon (Pty) Ltd &nbsp;·&nbsp; Sunny South Africa<br/>
        Questions? <a href="mailto:support@crunchcarbon.com" style="color:${BRAND.yellow};text-decoration:none;font-weight:600">support@crunchcarbon.com</a>
      </td></tr>

      <tr><td style="display:none">
        <!-- Token: ${data.tokenPreview} -->
        <!-- Proposal: ${data.proposalId} -->
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  }

  generatePlainTextTemplate(data: EmailTemplateData): string {
    const hasNamedAgent = Boolean(data.agentFirstName && data.agentLastName);
    const agentName = hasNamedAgent
      ? `${data.agentFirstName ?? ""} ${data.agentLastName ?? ""}`
      : "the Crunch Carbon team";
    const agentAffiliation = hasNamedAgent && data.agentCompanyName
      ? `${agentName} from ${data.agentCompanyName}`
      : agentName;
    const contactEmail = data.agentEmail || "proposals@crunchcarbon.com";
    const lines: string[] = [];
    lines.push(`Dear ${data.clientName},`);
    lines.push("");
    lines.push(`${agentAffiliation} prepared this proposal for the solar system you have installed. It sets out the potential earnings from your solar system through carbon credits with the Crunch Carbon team.`);
    lines.push("");
    lines.push(hasNamedAgent
      ? `If you have questions, or you did not expect this email, please contact ${agentName} at ${contactEmail}${data.agentEmail ? " (copied on this email too)" : ""}.`
      : `If you have questions, or you did not expect this email, please contact us at ${contactEmail}.`);
    lines.push("");
    lines.push("What happens next?");
    lines.push("You are in control. Choose one of the options below and we'll take care of the rest.");
    lines.push("");
    lines.push("Review your proposal first");
    lines.push("Open your proposal on the Crunch Carbon platform, read through the details, and decide when you're ready.");
    lines.push("");
    lines.push("Accept & sign online");
    lines.push("Ready to move forward? Accept the proposal and sign the Cession Agreement securely in just a few clicks.");
    lines.push("");
    lines.push("Decline this proposal");
    lines.push("If this isn't right for you, select Decline and we'll close this proposal with no follow-up pressure.");
    lines.push("");
    lines.push(`Review Proposal: ${data.viewLink}`);
    lines.push(`Accept & Sign: ${data.acceptLink}`);
    lines.push(`Decline: ${data.declineLink}`);
    lines.push("");
    lines.push(
      "All figures are estimates based on the system details provided and current carbon-credit assumptions. Actual income depends on verified generation from your system, audit outcomes and market prices at the time of sale. No account or password is required to sign — the link above opens your proposal directly and is valid for 10 days."
    );
    lines.push("");
    lines.push("Warm regards,");
    lines.push("The Crunch Carbon Team");
    lines.push("Crunch Carbon (Pty) Ltd - Sunny South Africa - support@crunchcarbon.com");
    return lines.join("\n");
  }

  async sendInvitationEmail(
    clientEmail: string,
    projectName: string,
    emailTemplate: string,
    ccEmail?: string,
    plainText?: string
  ) {
    const emailPayload: any = {
      from: "Crunch Carbon <proposals@crunchcarbon.com>",
      to: [clientEmail],
      subject: `Your solar carbon income proposal - ${projectName}`,
      html: emailTemplate,
    };

    if (plainText) {
      emailPayload.text = plainText;
    }

    // Add CC if agent email is provided
    if (ccEmail) {
      emailPayload.cc = [ccEmail];
    }

    return await this.resend.emails.send(emailPayload);
  }
}
