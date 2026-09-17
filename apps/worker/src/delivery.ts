import { prisma } from '@physiocore/db';

export type DeliveryChannel = 'EMAIL' | 'SMS' | 'WHATSAPP';

export async function deliverNotification(input: {
  tenantId: string;
  channel: DeliveryChannel;
  to: string;
  subject?: string;
  body: string;
}) {
  const providerType = input.channel === 'EMAIL'
    ? 'RESEND_EMAIL'
    : input.channel === 'SMS' ? 'TWILIO_SMS' : 'TWILIO_WHATSAPP';
  const provider = await prisma.notificationChannel.findFirst({
    where: { tenantId: input.tenantId, type: providerType, isActive: true },
  });
  if (!provider) return false;

  if (input.channel === 'EMAIL') {
    try {
      return await sendEmail(input, provider.apiKey || process.env.RESEND_API_KEY, provider.from || process.env.EMAIL_FROM || 'noreply@physiocore.com');
    } catch {
      return false;
    }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const config = provider.config && typeof provider.config === 'object' && !Array.isArray(provider.config)
    ? provider.config as Record<string, unknown>
    : {};
  const configuredAccountSid = typeof config.accountSid === 'string' ? config.accountSid : undefined;
  const resolvedAccountSid = configuredAccountSid || accountSid;
  const authToken = provider.apiKey || process.env.TWILIO_AUTH_TOKEN;
  const from = provider.from || (input.channel === 'SMS' ? process.env.TWILIO_SMS_FROM : process.env.TWILIO_WHATSAPP_FROM);
  if (!resolvedAccountSid || !authToken || !from || resolvedAccountSid === 'your_twilio_sid') return false;

  const to = input.channel === 'WHATSAPP' ? `whatsapp:${input.to}` : input.to;
  const sender = input.channel === 'WHATSAPP' ? `whatsapp:${from}` : from;
  const body = new URLSearchParams({ To: to, From: sender, Body: input.body });
  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${resolvedAccountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${resolvedAccountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function sendEmail(input: { to: string; subject?: string; body: string }, apiKey: string | null | undefined, from: string) {
  if (!apiKey || apiKey === 'your_resend_api_key') return false;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject || 'Message from your physiotherapy clinic',
      html: input.body,
    }),
  });
  return response.ok;
}
