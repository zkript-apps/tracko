export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? 'WorkTrack <onboarding@resend.dev>';
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.log(
      `[Tracko] Email (dev — set RESEND_API_KEY to send): ${input.subject} → ${input.to}`,
    );
    console.log(`[Tracko] ${input.text}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getEmailFrom(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Failed to send email (${response.status})${body ? `: ${body}` : ''}`,
    );
  }
}

function invitationEmailLayout(
  title: string,
  bodyHtml: string,
  actionUrl: string,
) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#020617;font-family:Arial,sans-serif;color:#e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#020617;padding:32px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:32px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#34d399;">WorkTrack</p>
                <h1 style="margin:0 0 16px;font-size:24px;color:#ffffff;">${title}</h1>
                ${bodyHtml}
                <p style="margin:24px 0 0;">
                  <a href="${actionUrl}" style="display:inline-block;background:#10b981;color:#020617;text-decoration:none;font-weight:600;padding:12px 18px;border-radius:8px;">Accept invitation</a>
                </p>
                <p style="margin:24px 0 0;font-size:12px;color:#64748b;word-break:break-all;">Or copy this link:<br>${actionUrl}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendAdminInvitationEmail(input: {
  email: string;
  planTier: string;
  signupUrl: string;
}): Promise<void> {
  const planLabel =
    input.planTier.charAt(0).toUpperCase() + input.planTier.slice(1);
  const text = `You have been invited to set up your WorkTrack organization (${planLabel} plan). Accept your invitation: ${input.signupUrl}`;
  const html = invitationEmailLayout(
    'Set up your organization',
    `<p style="margin:0;color:#cbd5e1;line-height:1.6;">You have been invited to create your organization admin account on WorkTrack.</p>
     <p style="margin:16px 0 0;color:#94a3b8;">Plan: <strong style="color:#e2e8f0;">${planLabel}</strong></p>`,
    input.signupUrl,
  );

  await sendEmail({
    to: input.email,
    subject: 'Your WorkTrack organization invitation',
    html,
    text,
  });
}

export async function sendOrgInvitationEmail(input: {
  email: string;
  role: string;
  inviteUrl: string;
  organizationName?: string;
  branchName?: string | null;
}): Promise<void> {
  const roleLabel =
    input.role === 'hr'
      ? 'HR'
      : input.role === 'employee'
        ? 'Employee'
        : input.role;
  const orgLabel = input.organizationName ?? 'your organization';
  const branchLabel = input.branchName ? ` for ${input.branchName}` : '';
  const text = `You have been invited to join ${orgLabel} as ${roleLabel}${branchLabel}. Accept your invitation: ${input.inviteUrl}`;
  const html = invitationEmailLayout(
    `Join ${orgLabel}`,
    `<p style="margin:0;color:#cbd5e1;line-height:1.6;">You have been invited as <strong style="color:#e2e8f0;">${roleLabel}</strong>${branchLabel}.</p>`,
    input.inviteUrl,
  );

  await sendEmail({
    to: input.email,
    subject: `You're invited to join ${orgLabel} on WorkTrack`,
    html,
    text,
  });
}
