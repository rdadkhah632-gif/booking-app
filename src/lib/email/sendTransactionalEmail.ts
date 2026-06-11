import {
  TransactionalEmailMessage,
  TransactionalEmailResult,
} from "./types";

export async function sendTransactionalEmail(
  message: TransactionalEmailMessage,
): Promise<TransactionalEmailResult> {
  if (message.preferenceEnabled === false) {
    return { status: "skipped", reason: "preference_disabled" };
  }

  if (!message.to.trim()) {
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

  console.warn("[email] Unsupported transactional email provider", {
    event: message.event,
    provider,
  });

  return { status: "skipped", reason: "unsupported_provider" };
}
