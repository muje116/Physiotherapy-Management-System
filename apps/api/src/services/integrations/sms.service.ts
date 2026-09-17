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

export async function sendSms(payload: SmsPayload, options?: TwilioOptions): Promise<boolean> {
  const accountSid = options?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = options?.authToken || process.env.TWILIO_AUTH_TOKEN;
  const from = payload.from || options?.from || process.env.TWILIO_SMS_FROM;

  if (!accountSid || !authToken || !from || accountSid === 'your_twilio_sid') return false;

  try {
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);
    await client.messages.create({ body: payload.body, from, to: payload.to });
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
      body: payload.body,
      from: `whatsapp:${from}`,
      to: `whatsapp:${payload.to}`,
    });
    return true;
  } catch (error) {
    console.warn('[WhatsApp] Twilio delivery failed:', error);
    return false;
  }
}
