interface EmailPayload {
  to: string | string[];
  subject: string;
  body: string;
  textBody?: string;
  from?: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

export async function sendEmail(payload: EmailPayload, options?: { apiKey?: string }): Promise<boolean> {
  const apiKey = options?.apiKey || process.env.RESEND_API_KEY;
  const from = payload.from || process.env.EMAIL_FROM || 'noreply@physiocore.com';

  if (!apiKey || apiKey === 'your_resend_api_key') return false;

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.body,
      text: payload.textBody,
    });
    return !result.error;
  } catch (error) {
    console.warn('[Email] Resend delivery failed:', error);
    return false;
  }
}
