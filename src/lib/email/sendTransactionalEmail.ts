import {
  TransactionalEmailMessage,
  TransactionalEmailResult,
} from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validRecipient(value: string) {
  return EMAIL_PATTERN.test(value.trim());
}

async function sendWithResend(
  message: TransactionalEmailMessage,
): Promise<TransactionalEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM_ADDRESS?.trim();
  const replyTo =
    message.replyTo?.trim() || process.env.EMAIL_REPLY_TO?.trim() || undefined;

  if (!apiKey || !from) {
    console.warn("[email] Resend configuration is incomplete", {
      event: message.event,
      missingApiKey: !apiKey,
      missingFromAddress: !from,
    });
    return { status: "failed", reason: "config_missing" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to.trim()],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const payload = (await response.json().catch(() => null)) as {
      id?: string;
    } | null;

    if (!response.ok || !payload?.id) {
      console.warn("[email] Resend delivery failed", {
        event: message.event,
        status: response.status,
      });
      return { status: "failed", reason: "provider_error" };
    }

    return {
      status: "sent",
      provider: "resend",
      providerMessageId: payload.id,
    };
  } catch (error) {
    console.warn("[email] Resend request failed", {
      event: message.event,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    return { status: "failed", reason: "provider_error" };
  }
}

export async function sendTransactionalEmail(
  message: TransactionalEmailMessage,
): Promise<TransactionalEmailResult> {
  if (message.preferenceEnabled === false) {
    return { status: "skipped", reason: "preference_disabled" };
  }

  if (!validRecipient(message.to)) {
    return { status: "skipped", reason: "recipient_missing" };
  }

  const provider = (process.env.EMAIL_PROVIDER || "disabled").toLowerCase();

  if (provider === "disabled") {
    if (process.env.NODE_ENV !== "production") {
      console.info("[email] Transactional email skipped", {
        event: message.event,
        provider,
      });
    }

    return { status: "skipped", reason: "provider_disabled" };
  }

  if (provider === "resend") {
    return sendWithResend(message);
  }

  console.warn("[email] Unsupported transactional email provider", {
    event: message.event,
    provider,
  });

  return { status: "skipped", reason: "unsupported_provider" };
}
