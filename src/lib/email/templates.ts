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

type EmailDetail = {
  label: string;
  value?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: string) {
  return `${new Date(value).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  })} UTC`;
}

function detailRows(details: EmailDetail[]) {
  return details
    .filter((detail) => detail.value)
    .map(
      (detail) => `
        <tr>
          <td style="padding: 10px 0; color: #6b7280; font-size: 13px; line-height: 18px; border-bottom: 1px solid #edf0f5;">${escapeHtml(detail.label)}</td>
          <td style="padding: 10px 0; color: #111827; font-size: 14px; line-height: 20px; font-weight: 700; text-align: right; border-bottom: 1px solid #edf0f5;">${escapeHtml(detail.value || "")}</td>
        </tr>`,
    )
    .join("");
}

function brandedEmailHtml(input: {
  preview: string;
  eyebrow?: string;
  title: string;
  intro: string;
  details?: EmailDetail[];
  actionLabel: string;
  actionUrl: string;
  note?: string;
}) {
  const details = input.details?.length
    ? `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 24px 0 8px;">
        ${detailRows(input.details)}
      </table>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #f6f7fb; color: #111827; font-family: Arial, Helvetica, sans-serif;">
    <span style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">${escapeHtml(input.preview)}</span>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #f6f7fb; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background: #ffffff; border-radius: 18px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 18px 44px rgba(17, 24, 39, 0.08);">
            <tr>
              <td style="padding: 22px 28px; background: #111827;">
                <div style="font-size: 20px; line-height: 24px; color: #ffffff; font-weight: 800; letter-spacing: 0;">Mirëbook</div>
                ${input.eyebrow ? `<div style="margin-top: 6px; color: #f97316; font-size: 12px; line-height: 16px; font-weight: 700; text-transform: uppercase;">${escapeHtml(input.eyebrow)}</div>` : ""}
              </td>
            </tr>
            <tr>
              <td style="padding: 30px 28px 34px;">
                <h1 style="margin: 0 0 12px; color: #111827; font-size: 26px; line-height: 32px; font-weight: 800;">${escapeHtml(input.title)}</h1>
                <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 24px;">${escapeHtml(input.intro)}</p>
                ${details}
                <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top: 26px;">
                  <tr>
                    <td style="border-radius: 12px; background: #f97316;">
                      <a href="${escapeHtml(input.actionUrl)}" style="display: inline-block; padding: 13px 18px; color: #ffffff; text-decoration: none; font-size: 14px; line-height: 18px; font-weight: 800;">${escapeHtml(input.actionLabel)}</a>
                    </td>
                  </tr>
                </table>
                ${input.note ? `<p style="margin: 22px 0 0; color: #6b7280; font-size: 13px; line-height: 20px;">${escapeHtml(input.note)}</p>` : ""}
              </td>
            </tr>
          </table>
          <p style="max-width: 600px; margin: 18px auto 0; color: #8b94a7; font-size: 12px; line-height: 18px; text-align: center;">
            This email was sent by Mirëbook. In-app records remain the source of truth for bookings and support.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

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

    if (status === "cancelled") {
      return {
        subject: "Customer cancelled booking",
        intro: "A customer cancelled their booking.",
      };
    }

    if (status === "completed") {
      return {
        subject: "Appointment completed",
        intro: "An appointment has been marked as completed.",
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

    if (status === "completed") {
      return {
        subject: "Assigned appointment completed",
        intro: "An assigned appointment has been marked as completed.",
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
  const appointmentTime = formatDateTime(input.startAt);
  const staffLine = input.staffName ? `\nStaff: ${input.staffName}` : "";
  const actionLabel =
    input.recipientRole === "business"
      ? "Open business calendar"
      : input.recipientRole === "staff"
        ? "Open staff schedule"
        : "View booking";

  const text = `${copy.intro}

Business: ${input.businessName}
Customer: ${input.customerName}
Service: ${input.serviceName}${staffLine}
Date and time: ${appointmentTime}

Open Mirëbook: ${input.actionUrl}

In-app notifications remain the authoritative booking record.`;

  return {
    event: input.event,
    to: input.recipientEmail,
    subject: `Mirëbook: ${copy.subject}`,
    text,
    html: brandedEmailHtml({
      preview: copy.intro,
      eyebrow:
        input.recipientRole === "business"
          ? "Business update"
          : input.recipientRole === "staff"
            ? "Staff schedule"
            : "Booking update",
      title: copy.subject,
      intro: copy.intro,
      details: [
        { label: "Business", value: input.businessName },
        { label: "Customer", value: input.customerName },
        { label: "Service", value: input.serviceName },
        { label: "Staff", value: input.staffName },
        { label: "Date and time", value: appointmentTime },
      ],
      actionLabel,
      actionUrl: input.actionUrl,
      note: "Open Mirëbook for the latest booking status and any available actions.",
    }),
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
  const appointmentTime = formatDateTime(input.startAt);
  const staffLine = input.staffName ? `\nStaff: ${input.staffName}` : "";

  return {
    event: "appointment_reminder",
    to: input.recipientEmail,
    subject: "Mirëbook: Appointment reminder",
    text: `Your appointment is coming up in about 24 hours.

Business: ${input.businessName}
Service: ${input.serviceName}${staffLine}
Date and time: ${appointmentTime}

Open Mirëbook: ${input.actionUrl}

In-app notifications remain the authoritative booking record.`,
    html: brandedEmailHtml({
      preview: "Your appointment is coming up in about 24 hours.",
      eyebrow: "Appointment reminder",
      title: "Your appointment is coming up",
      intro: "This is a reminder for your upcoming Mirëbook appointment.",
      details: [
        { label: "Business", value: input.businessName },
        { label: "Service", value: input.serviceName },
        { label: "Staff", value: input.staffName },
        { label: "Date and time", value: appointmentTime },
      ],
      actionLabel: "View appointment",
      actionUrl: input.actionUrl,
      note: "If anything looks wrong, open Mirëbook and contact the business from your booking details.",
    }),
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
    html: brandedEmailHtml({
      preview: `${input.businessName} invited you to join their staff workspace on Mirëbook.`,
      eyebrow: "Staff invitation",
      title: `Join ${input.businessName} on Mirëbook`,
      intro:
        "You have been invited to join the staff workspace so you can see assigned appointments and manage your schedule.",
      details: [{ label: "Business", value: input.businessName }],
      actionLabel: "Accept invitation",
      actionUrl: input.inviteUrl,
      note: "Open this link using the invited email address. If you do not have a Mirëbook account, you can create a staff account after opening the link.",
    }),
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
    html: brandedEmailHtml({
      preview: intro,
      eyebrow: input.isAdminNotification ? "Support alert" : "Support",
      title:
        input.event === "support_replied"
          ? "Support replied"
          : input.isAdminNotification
            ? "New support request"
            : "Support request received",
      intro,
      details: [{ label: "Subject", value: input.subject }],
      actionLabel: input.isAdminNotification
        ? "Open admin support"
        : "Open conversation",
      actionUrl: input.actionUrl,
      note: "For privacy, this email only includes the subject and secure Mirëbook link.",
    }),
    preferenceEnabled: input.preferenceEnabled,
  };
}
