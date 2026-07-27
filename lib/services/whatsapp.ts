type OrderConfirmationWhatsAppInput = {
  customerName?: string | null;
  orderNumber: string;
  phone?: string | null;
};

const normalizeCountryCode = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "";
  }

  const digits = trimmed.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : "";
};

const normalizePhoneToE164 = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const compact = trimmed.replace(/[^+\d]/g, "");
  const defaultCountryCode = normalizeCountryCode(
    process.env.TWILIO_WHATSAPP_DEFAULT_COUNTRY_CODE
  );

  let normalized = compact;

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  } else if (!normalized.startsWith("+") && defaultCountryCode) {
    normalized = normalized.startsWith("0")
      ? `${defaultCountryCode}${normalized.slice(1)}`
      : `${defaultCountryCode}${normalized}`;
  }

  if (!/^\+\d{8,15}$/.test(normalized)) {
    return null;
  }

  return normalized;
};

const toWhatsAppAddress = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("whatsapp:")) {
    const normalized = normalizePhoneToE164(trimmed.slice("whatsapp:".length));
    return normalized ? `whatsapp:${normalized}` : null;
  }

  const normalized = normalizePhoneToE164(trimmed);
  return normalized ? `whatsapp:${normalized}` : null;
};

const getTwilioConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = toWhatsAppAddress(process.env.TWILIO_WHATSAPP_FROM);
  const contentSid =
    process.env.TWILIO_CONTENT_SID?.trim() ||
    process.env.TWILIO_WHATSAPP_ORDER_TEMPLATE_SID?.trim();

  if (!accountSid || !authToken || !from) {
    return null;
  }

  return {
    accountSid,
    authToken,
    from,
    contentSid: contentSid || null,
  };
};

const getPublicOrderReference = (orderNumber: string) =>
  orderNumber.slice(-8).toUpperCase();

const buildConfirmationBody = ({
  customerName,
  orderNumber,
}: OrderConfirmationWhatsAppInput) => {
  const name = customerName?.trim() || "عميلنا العزيز";
  const orderReference = getPublicOrderReference(orderNumber);
  return `مرحبا ${name}، تم تسجيل طلبكم لدى Zayna بنجاح. رقم الطلب هو #${orderReference}. شكرا لثقتكم بنا.`;
};

const sendTwilioWhatsAppMessage = async (input: {
  to: string;
  body?: string;
  contentSid?: string | null;
  contentVariables?: Record<string, string>;
}) => {
  const config = getTwilioConfig();
  if (!config) {
    return { sent: false, reason: "missing_config" as const };
  }

  const params = new URLSearchParams();
  params.set("From", config.from);
  params.set("To", input.to);

  const contentSid = input.contentSid ?? config.contentSid;
  // Prefer a Twilio-approved template when available, with a plain Arabic
  // message fallback so order confirmations still go out during setup.
  if (contentSid) {
    params.set("ContentSid", contentSid);
    params.set(
      "ContentVariables",
      JSON.stringify(input.contentVariables || {})
    );
  } else if (input.body) {
    params.set("Body", input.body);
  } else {
    return { sent: false, reason: "missing_message_content" as const };
  }

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${config.accountSid}:${config.authToken}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Twilio WhatsApp send failed (${response.status}): ${errorText}`
    );
  }

  return { sent: true as const };
};

export async function sendOrderConfirmationWhatsApp(
  input: OrderConfirmationWhatsAppInput
) {
  const to = toWhatsAppAddress(input.phone);
  if (!to) {
    return { sent: false, reason: "missing_or_invalid_phone" as const };
  }

  try {
    const orderReference = getPublicOrderReference(input.orderNumber);
    const customerName = input.customerName?.trim() || "عميلنا العزيز";

    return await sendTwilioWhatsAppMessage({
      to,
      body: buildConfirmationBody(input),
      contentVariables: {
        "1": customerName,
        "2": orderReference,
      },
    });
  } catch (error) {
    console.error("WhatsApp order confirmation failed:", {
      orderNumber: input.orderNumber,
      phone: input.phone,
      error,
    });
    return { sent: false, reason: "send_failed" as const };
  }
}
