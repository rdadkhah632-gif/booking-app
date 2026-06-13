import {
  BookingEmailStatus,
  TransactionalEmailEvent,
  TransactionalEmailMessage,
} from "./types";

type BookingTemplateInput = {
  event: TransactionalEmailEvent;
  recipientEmail: string;
  recipientRole: "customer" | "business" | "staff";
  bookingStatus: BookingEmailStatus;
  businessName: string;
  customerName: string;
  serviceName: string;
  staffName?: string | null;
  startAt: string;
  actionUrl: string;
  preferenceEnabled?: boolean;
};

function statusCopy(
  status: BookingEmailStatus,
  role: BookingTemplateInput["recipientRole"],
) {
  if (role === "business") {
    if (status === "pending") {
      return {
        subject: "New booking request needs approval",
        intro: "A new booking request needs your review.",
      };
    }

    return {
      subject: "New booking confirmed",
      intro: "A new booking has been confirmed.",
    };
  }

  if (role === "staff") {
    if (status === "cancelled" || status === "declined") {
      return {
        subject: "Assigned booking cancelled",
        intro: "An assigned booking is no longer active.",
      };
    }

    return {
      subject: "Booking assigned to you",
      intro: "A confirmed booking has been assigned to your schedule.",
    };
  }

  if (status === "pending") {
    return {
      subject: "Booking request sent",
      intro: "Your booking request was sent to the business for review.",
    };
  }
  if (status === "confirmed") {
    return {
      subject: "Booking confirmed",
      intro: "Your booking is confirmed.",
    };
  }
  if (status === "declined") {
    return {
      subject: "Booking request declined",
      intro: "The business declined this booking request.",
    };
  }
  if (status === "cancelled") {
    return {
      subject: "Booking cancelled",
      intro: "This booking has been cancelled.",
    };
  }

  return {
    subject: "Appointment completed",
    intro: "This appointment has been marked as completed.",
  };
}

export function bookingEmailTemplate(
  input: BookingTemplateInput,
): TransactionalEmailMessage {
  const copy = statusCopy(input.bookingStatus, input.recipientRole);
  const appointmentTime = new Date(input.startAt).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const staffLine = input.staffName
    ? `\nStaff: ${input.staffName}`
    : "";

  const text = `${copy.intro}

Business: ${input.businessName}
Customer: ${input.customerName}
Service: ${input.serviceName}${staffLine}
Date and time: ${appointmentTime} UTC

Open Mirëbook: ${input.actionUrl}

In-app notifications remain the authoritative booking record.`;

  return {
    event: input.event,
    to: input.recipientEmail,
    subject: `Mirëbook: ${copy.subject}`,
    text,
    preferenceEnabled: input.preferenceEnabled,
  };
}

export function appointmentReminderEmailTemplate(input: {
  recipientEmail: string;
  businessName: string;
  serviceName: string;
  staffName?: string | null;
  startAt: string;
  actionUrl: string;
  preferenceEnabled?: boolean;
}): TransactionalEmailMessage {
  const appointmentTime = new Date(input.startAt).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  });
  const staffLine = input.staffName ? `\nStaff: ${input.staffName}` : "";

  return {
    event: "appointment_reminder",
    to: input.recipientEmail,
    subject: "Mirëbook: Appointment reminder",
    text: `Your appointment is coming up in about 24 hours.

Business: ${input.businessName}
Service: ${input.serviceName}${staffLine}
Date and time: ${appointmentTime} UTC

Open Mirëbook: ${input.actionUrl}

In-app notifications remain the authoritative booking record.`,
    preferenceEnabled: input.preferenceEnabled,
  };
}

export function staffInviteEmailTemplate(input: {
  recipientEmail: string;
  businessName: string;
  inviteUrl: string;
}): TransactionalEmailMessage {
  return {
    event: "staff_invited",
    to: input.recipientEmail,
    subject: `You've been invited to join ${input.businessName} on Mirëbook`,
    text: `${input.businessName} invited you to join their staff workspace on Mirëbook.

Accept invite: ${input.inviteUrl}

Open this link using the invited email address. If you do not have a Mirëbook account, you can create a staff account after opening the link.

For your security, do not forward this invitation if it was not intended for you.`,
  };
}

export function supportEmailTemplate(input: {
  event: "support_created" | "support_replied";
  recipientEmail: string;
  subject: string;
  actionUrl: string;
  isAdminNotification?: boolean;
  preferenceEnabled?: boolean;
}): TransactionalEmailMessage {
  const intro =
    input.event === "support_replied"
      ? "Mirëbook support replied to your support conversation."
      : input.isAdminNotification
        ? "A new support request is ready for operator review."
        : "We received your Mirëbook support request.";

  return {
    event: input.event,
    to: input.recipientEmail,
    subject:
      input.event === "support_replied"
        ? "Mirëbook support replied"
        : input.isAdminNotification
          ? `Mirëbook support: ${input.subject}`
          : "Mirëbook support request received",
    text: `${intro}

Subject: ${input.subject}

Open the support conversation: ${input.actionUrl}

The in-app support conversation remains the authoritative record.`,
    preferenceEnabled: input.preferenceEnabled,
  };
}
