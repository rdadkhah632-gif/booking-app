export type TransactionalEmailEvent =
  | "booking_created"
  | "booking_status_changed"
  | "support_created"
  | "support_replied"
  | "staff_invited";

export type BookingEmailStatus =
  | "pending"
  | "confirmed"
  | "declined"
  | "cancelled"
  | "completed";

export type TransactionalEmailRequest =
  | {
      event: "booking_created";
      bookingId: string;
    }
  | {
      event: "booking_status_changed";
      bookingId: string;
    };

export type TransactionalEmailMessage = {
  event: TransactionalEmailEvent;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type TransactionalEmailResult =
  | {
      status: "sent";
      provider: string;
    }
  | {
      status: "skipped";
      reason: "provider_disabled" | "recipient_missing" | "unsupported_provider";
    }
  | {
      status: "failed";
      reason: string;
    };
