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
  };
}
