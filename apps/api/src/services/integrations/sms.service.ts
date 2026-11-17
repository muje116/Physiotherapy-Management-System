interface SmsPayload {
  to: string;
  body: string;
  from?: string;
}

interface TwilioOptions {
  accountSid?: string;
  authToken?: string;
  from?: string;
}

function toPlainText(value: string) {
  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendSms(payload: SmsPayload, options?: TwilioOptions): Promise<boolean> {
  const accountSid = options?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = options?.authToken || process.env.TWILIO_AUTH_TOKEN;
  const from = payload.from || options?.from || process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from || accountSid === 'your_twilio_sid') return false;

  try {
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);
    await client.messages.create({ body: toPlainText(payload.body), from, to: payload.to });
    return true;
  } catch (error) {
    console.warn('[SMS] Twilio delivery failed:', error);
    return false;
  }
}

export async function sendWhatsApp(payload: SmsPayload, options?: TwilioOptions): Promise<boolean> {
  const accountSid = options?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = options?.authToken || process.env.TWILIO_AUTH_TOKEN;
  const from = payload.from || options?.from || process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !from || accountSid === 'your_twilio_sid') return false;

  try {
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);
    await client.messages.create({
      body: toPlainText(payload.body),
      from: `whatsapp:${from}`,
      to: `whatsapp:${payload.to}`,
    });
    return true;
  } catch (error) {
    console.warn('[WhatsApp] Twilio delivery failed:', error);
    return false;
  }
}
