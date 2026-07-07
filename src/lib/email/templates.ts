import { Locale } from "@/lib/i18n";
import {
  BookingEmailStatus,
  TransactionalEmailEvent,
  TransactionalEmailMessage,
} from "./types";

type EmailLocale = Locale;

type BookingTemplateInput = {
  event: TransactionalEmailEvent;
  recipientEmail: string;
  recipientRole: "customer" | "business" | "staff";
  bookingStatus: BookingEmailStatus;
  businessName?: string | null;
  customerName?: string | null;
  serviceName?: string | null;
  staffName?: string | null;
  startAt: string;
  actionUrl: string;
  locale?: EmailLocale;
  preferenceEnabled?: boolean;
};

type EmailDetail = {
  label: string;
  value?: string | null;
};

type BookingStatusCopy = {
  subject: string;
  intro: string;
};

type EmailCopy = {
  localeCode: string;
  footer: string;
  sourceOfTruthBookings: string;
  sourceOfTruthSupport: string;
  openMirebook: string;
  subjectLabel: string;
  businessLabel: string;
  customerLabel: string;
  serviceLabel: string;
  staffLabel: string;
  dateTimeLabel: string;
  businessFallback: string;
  customerFallback: string;
  appointmentFallback: string;
  bookingEyebrows: Record<BookingTemplateInput["recipientRole"], string>;
  bookingActions: Record<BookingTemplateInput["recipientRole"], string>;
  bookingNote: string;
  status: Record<
    BookingTemplateInput["recipientRole"],
    Record<BookingEmailStatus | "default", BookingStatusCopy>
  >;
  reminder: {
    subject: string;
    preview: string;
    eyebrow: string;
    title: string;
    intro: string;
    actionLabel: string;
    note: string;
  };
  invite: {
    subject: (businessName: string) => string;
    preview: (businessName: string) => string;
    eyebrow: string;
    title: (businessName: string) => string;
    intro: string;
    actionLabel: string;
    text: (businessName: string, inviteUrl: string) => string;
    note: string;
  };
  support: {
    replyIntro: string;
    adminIntro: string;
    createdIntro: string;
    replySubject: string;
    adminSubjectPrefix: string;
    createdSubject: string;
    replyTitle: string;
    adminTitle: string;
    createdTitle: string;
    supportAlert: string;
    supportEyebrow: string;
    openAdminSupport: string;
    openConversation: string;
    note: string;
    text: (intro: string, subject: string, actionUrl: string) => string;
  };
};

const EMAIL_COPY: Record<EmailLocale, EmailCopy> = {
  en: {
    localeCode: "en-GB",
    footer:
      "This email was sent by Mirëbook. In-app records remain the source of truth for bookings and support.",
    sourceOfTruthBookings:
      "In-app notifications remain the authoritative booking record.",
    sourceOfTruthSupport:
      "The in-app support conversation remains the authoritative record.",
    openMirebook: "Open Mirëbook",
    subjectLabel: "Subject",
    businessLabel: "Business",
    customerLabel: "Customer",
    serviceLabel: "Service",
    staffLabel: "Staff",
    dateTimeLabel: "Date and time",
    businessFallback: "Business",
    customerFallback: "Customer",
    appointmentFallback: "Appointment",
    bookingEyebrows: {
      business: "Business update",
      staff: "Staff schedule",
      customer: "Booking update",
    },
    bookingActions: {
      business: "Open business calendar",
      staff: "Open staff schedule",
      customer: "View booking",
    },
    bookingNote:
      "Open Mirëbook for the latest booking status and any available actions.",
    status: {
      business: {
        pending: {
          subject: "New booking request needs approval",
          intro: "A new booking request needs your review.",
        },
        confirmed: {
          subject: "New booking confirmed",
          intro: "A new booking has been confirmed.",
        },
        declined: {
          subject: "Booking request declined",
          intro: "A booking request has been declined.",
        },
        cancelled: {
          subject: "Customer cancelled booking",
          intro: "A customer cancelled their booking.",
        },
        completed: {
          subject: "Appointment completed",
          intro: "An appointment has been marked as completed.",
        },
        default: {
          subject: "New booking confirmed",
          intro: "A new booking has been confirmed.",
        },
      },
      staff: {
        pending: {
          subject: "Booking request assigned",
          intro: "A booking request is awaiting business approval.",
        },
        confirmed: {
          subject: "Booking assigned to you",
          intro: "A confirmed booking has been assigned to your schedule.",
        },
        declined: {
          subject: "Assigned booking cancelled",
          intro: "An assigned booking is no longer active.",
        },
        cancelled: {
          subject: "Assigned booking cancelled",
          intro: "An assigned booking is no longer active.",
        },
        completed: {
          subject: "Assigned appointment completed",
          intro: "An assigned appointment has been marked as completed.",
        },
        default: {
          subject: "Booking assigned to you",
          intro: "A confirmed booking has been assigned to your schedule.",
        },
      },
      customer: {
        pending: {
          subject: "Booking request sent",
          intro: "Your booking request was sent to the business for review.",
        },
        confirmed: {
          subject: "Booking confirmed",
          intro: "Your booking is confirmed.",
        },
        declined: {
          subject: "Booking request declined",
          intro: "The business declined this booking request.",
        },
        cancelled: {
          subject: "Booking cancelled",
          intro: "This booking has been cancelled.",
        },
        completed: {
          subject: "Appointment completed",
          intro: "This appointment has been marked as completed.",
        },
        default: {
          subject: "Booking confirmed",
          intro: "Your booking is confirmed.",
        },
      },
    },
    reminder: {
      subject: "Mirëbook: Appointment reminder",
      preview: "Your appointment is coming up in about 24 hours.",
      eyebrow: "Appointment reminder",
      title: "Your appointment is coming up",
      intro: "This is a reminder for your upcoming Mirëbook appointment.",
      actionLabel: "View appointment",
      note: "If anything looks wrong, open Mirëbook and contact the business from your booking details.",
    },
    invite: {
      subject: (businessName) =>
        `You've been invited to join ${businessName} on Mirëbook`,
      preview: (businessName) =>
        `${businessName} invited you to join their staff workspace on Mirëbook.`,
      eyebrow: "Staff invitation",
      title: (businessName) => `Join ${businessName} on Mirëbook`,
      intro:
        "You have been invited to join the staff workspace so you can see assigned appointments and manage your schedule.",
      actionLabel: "Accept invitation",
      text: (businessName, inviteUrl) =>
        `${businessName} invited you to join their staff workspace on Mirëbook.

Accept invite: ${inviteUrl}

Open this link using the invited email address. If you do not have a Mirëbook account, you can create a staff account after opening the link.

For your security, do not forward this invitation if it was not intended for you.`,
      note: "Open this link using the invited email address. If you do not have a Mirëbook account, you can create a staff account after opening the link.",
    },
    support: {
      replyIntro: "Mirëbook support replied to your support conversation.",
      adminIntro: "A new support request is ready for operator review.",
      createdIntro: "We received your Mirëbook support request.",
      replySubject: "Mirëbook support replied",
      adminSubjectPrefix: "Mirëbook support",
      createdSubject: "Mirëbook support request received",
      replyTitle: "Support replied",
      adminTitle: "New support request",
      createdTitle: "Support request received",
      supportAlert: "Support alert",
      supportEyebrow: "Support",
      openAdminSupport: "Open admin support",
      openConversation: "Open conversation",
      note: "For privacy, this email only includes the subject and secure Mirëbook link.",
      text: (intro, subject, actionUrl) => `${intro}

Subject: ${subject}

Open the support conversation: ${actionUrl}

The in-app support conversation remains the authoritative record.`,
    },
  },
  sq: {
    localeCode: "sq-AL",
    footer:
      "Ky email u dërgua nga Mirëbook. Të dhënat brenda aplikacionit mbeten burimi kryesor për rezervimet dhe suportin.",
    sourceOfTruthBookings:
      "Njoftimet brenda Mirëbook mbeten burimi kryesor për këtë rezervim.",
    sourceOfTruthSupport:
      "Biseda e suportit brenda Mirëbook mbetet burimi kryesor.",
    openMirebook: "Hap Mirëbook",
    subjectLabel: "Subjekti",
    businessLabel: "Biznesi",
    customerLabel: "Klienti",
    serviceLabel: "Shërbimi",
    staffLabel: "Stafi",
    dateTimeLabel: "Data dhe ora",
    businessFallback: "Biznesi",
    customerFallback: "Klienti",
    appointmentFallback: "Takim",
    bookingEyebrows: {
      business: "Përditësim biznesi",
      staff: "Orari i stafit",
      customer: "Përditësim rezervimi",
    },
    bookingActions: {
      business: "Hap kalendarin e biznesit",
      staff: "Hap orarin e stafit",
      customer: "Shiko rezervimin",
    },
    bookingNote:
      "Hap Mirëbook për statusin më të fundit të rezervimit dhe veprimet e disponueshme.",
    status: {
      business: {
        pending: {
          subject: "Kërkesë e re rezervimi për miratim",
          intro: "Një kërkesë e re rezervimi pret shqyrtimin tënd.",
        },
        confirmed: {
          subject: "Rezervim i ri i konfirmuar",
          intro: "Një rezervim i ri është konfirmuar.",
        },
        declined: {
          subject: "Kërkesa e rezervimit u refuzua",
          intro: "Një kërkesë rezervimi është refuzuar.",
        },
        cancelled: {
          subject: "Klienti anuloi rezervimin",
          intro: "Një klient anuloi rezervimin e tij.",
        },
        completed: {
          subject: "Takimi u përfundua",
          intro: "Një takim është shënuar si i përfunduar.",
        },
        default: {
          subject: "Rezervim i ri i konfirmuar",
          intro: "Një rezervim i ri është konfirmuar.",
        },
      },
      staff: {
        pending: {
          subject: "Kërkesë rezervimi e caktuar",
          intro: "Një kërkesë rezervimi pret miratimin nga biznesi.",
        },
        confirmed: {
          subject: "Rezervim i caktuar për ty",
          intro: "Një rezervim i konfirmuar është shtuar në orarin tënd.",
        },
        declined: {
          subject: "Rezervimi i caktuar u anulua",
          intro: "Një rezervim i caktuar nuk është më aktiv.",
        },
        cancelled: {
          subject: "Rezervimi i caktuar u anulua",
          intro: "Një rezervim i caktuar nuk është më aktiv.",
        },
        completed: {
          subject: "Takimi i caktuar u përfundua",
          intro: "Një takim i caktuar është shënuar si i përfunduar.",
        },
        default: {
          subject: "Rezervim i caktuar për ty",
          intro: "Një rezervim i konfirmuar është shtuar në orarin tënd.",
        },
      },
      customer: {
        pending: {
          subject: "Kërkesa e rezervimit u dërgua",
          intro: "Kërkesa jote e rezervimit iu dërgua biznesit për shqyrtim.",
        },
        confirmed: {
          subject: "Rezervimi u konfirmua",
          intro: "Rezervimi yt është konfirmuar.",
        },
        declined: {
          subject: "Kërkesa e rezervimit u refuzua",
          intro: "Biznesi e refuzoi këtë kërkesë rezervimi.",
        },
        cancelled: {
          subject: "Rezervimi u anulua",
          intro: "Ky rezervim është anuluar.",
        },
        completed: {
          subject: "Takimi u përfundua",
          intro: "Ky takim është shënuar si i përfunduar.",
        },
        default: {
          subject: "Rezervimi u konfirmua",
          intro: "Rezervimi yt është konfirmuar.",
        },
      },
    },
    reminder: {
      subject: "Mirëbook: Kujtesë takimi",
      preview: "Takimi yt është pas rreth 24 orësh.",
      eyebrow: "Kujtesë takimi",
      title: "Takimi yt po afrohet",
      intro: "Kjo është një kujtesë për takimin tënd të ardhshëm në Mirëbook.",
      actionLabel: "Shiko takimin",
      note: "Nëse diçka nuk duket mirë, hap Mirëbook dhe kontakto biznesin nga detajet e rezervimit.",
    },
    invite: {
      subject: (businessName) =>
        `Je ftuar të bashkohesh me ${businessName} në Mirëbook`,
      preview: (businessName) =>
        `${businessName} të ftoi të bashkohesh me hapësirën e stafit në Mirëbook.`,
      eyebrow: "Ftesë stafi",
      title: (businessName) => `Bashkohu me ${businessName} në Mirëbook`,
      intro:
        "Je ftuar të bashkohesh me hapësirën e stafit që të shohësh takimet e caktuara dhe të menaxhosh orarin.",
      actionLabel: "Prano ftesën",
      text: (businessName, inviteUrl) =>
        `${businessName} të ftoi të bashkohesh me hapësirën e stafit në Mirëbook.

Prano ftesën: ${inviteUrl}

Hape këtë link me adresën e email-it që është ftuar. Nëse nuk ke ende llogari Mirëbook, mund të krijosh një llogari stafi pasi të hapësh linkun.

Për sigurinë tënde, mos e përcill këtë ftesë nëse nuk ishte menduar për ty.`,
      note: "Hape këtë link me adresën e email-it që është ftuar. Nëse nuk ke ende llogari Mirëbook, mund të krijosh një llogari stafi pasi të hapësh linkun.",
    },
    support: {
      replyIntro: "Suporti Mirëbook iu përgjigj bisedës tënde të suportit.",
      adminIntro: "Një kërkesë e re suporti është gati për shqyrtim.",
      createdIntro: "E morëm kërkesën tënde për suport në Mirëbook.",
      replySubject: "Suporti Mirëbook u përgjigj",
      adminSubjectPrefix: "Suport Mirëbook",
      createdSubject: "Kërkesa për suport në Mirëbook u pranua",
      replyTitle: "Suporti u përgjigj",
      adminTitle: "Kërkesë e re suporti",
      createdTitle: "Kërkesa për suport u pranua",
      supportAlert: "Njoftim suporti",
      supportEyebrow: "Suport",
      openAdminSupport: "Hap suportin e operatorit",
      openConversation: "Hap bisedën",
      note: "Për privatësi, ky email përfshin vetëm subjektin dhe linkun e sigurt të Mirëbook.",
      text: (intro, subject, actionUrl) => `${intro}

Subjekti: ${subject}

Hap bisedën e suportit: ${actionUrl}

Biseda e suportit brenda Mirëbook mbetet burimi kryesor.`,
    },
  },
};

function copyFor(locale?: EmailLocale): EmailCopy {
  return locale === "sq" ? EMAIL_COPY.sq : EMAIL_COPY.en;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: string, copy: EmailCopy) {
  return `${new Date(value).toLocaleString(copy.localeCode, {
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
  footer: string;
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
            ${escapeHtml(input.footer)}
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
  copy: EmailCopy,
) {
  return copy.status[role][status] || copy.status[role].default;
}

export function bookingEmailTemplate(
  input: BookingTemplateInput,
): TransactionalEmailMessage {
  const copy = copyFor(input.locale);
  const status = statusCopy(input.bookingStatus, input.recipientRole, copy);
  const businessName = input.businessName || copy.businessFallback;
  const customerName = input.customerName || copy.customerFallback;
  const serviceName = input.serviceName || copy.appointmentFallback;
  const appointmentTime = formatDateTime(input.startAt, copy);
  const staffLine = input.staffName
    ? `\n${copy.staffLabel}: ${input.staffName}`
    : "";

  const text = `${status.intro}

${copy.businessLabel}: ${businessName}
${copy.customerLabel}: ${customerName}
${copy.serviceLabel}: ${serviceName}${staffLine}
${copy.dateTimeLabel}: ${appointmentTime}

${copy.openMirebook}: ${input.actionUrl}

${copy.sourceOfTruthBookings}`;

  return {
    event: input.event,
    to: input.recipientEmail,
    subject: `Mirëbook: ${status.subject}`,
    text,
    html: brandedEmailHtml({
      preview: status.intro,
      eyebrow: copy.bookingEyebrows[input.recipientRole],
      title: status.subject,
      intro: status.intro,
      details: [
        { label: copy.businessLabel, value: businessName },
        { label: copy.customerLabel, value: customerName },
        { label: copy.serviceLabel, value: serviceName },
        { label: copy.staffLabel, value: input.staffName },
        { label: copy.dateTimeLabel, value: appointmentTime },
      ],
      actionLabel: copy.bookingActions[input.recipientRole],
      actionUrl: input.actionUrl,
      note: copy.bookingNote,
      footer: copy.footer,
    }),
    preferenceEnabled: input.preferenceEnabled,
  };
}

export function appointmentReminderEmailTemplate(input: {
  recipientEmail: string;
  businessName?: string | null;
  serviceName?: string | null;
  staffName?: string | null;
  startAt: string;
  actionUrl: string;
  locale?: EmailLocale;
  preferenceEnabled?: boolean;
}): TransactionalEmailMessage {
  const copy = copyFor(input.locale);
  const businessName = input.businessName || copy.businessFallback;
  const serviceName = input.serviceName || copy.appointmentFallback;
  const appointmentTime = formatDateTime(input.startAt, copy);
  const staffLine = input.staffName
    ? `\n${copy.staffLabel}: ${input.staffName}`
    : "";

  return {
    event: "appointment_reminder",
    to: input.recipientEmail,
    subject: copy.reminder.subject,
    text: `${copy.reminder.preview}

${copy.businessLabel}: ${businessName}
${copy.serviceLabel}: ${serviceName}${staffLine}
${copy.dateTimeLabel}: ${appointmentTime}

${copy.openMirebook}: ${input.actionUrl}

${copy.sourceOfTruthBookings}`,
    html: brandedEmailHtml({
      preview: copy.reminder.preview,
      eyebrow: copy.reminder.eyebrow,
      title: copy.reminder.title,
      intro: copy.reminder.intro,
      details: [
        { label: copy.businessLabel, value: businessName },
        { label: copy.serviceLabel, value: serviceName },
        { label: copy.staffLabel, value: input.staffName },
        { label: copy.dateTimeLabel, value: appointmentTime },
      ],
      actionLabel: copy.reminder.actionLabel,
      actionUrl: input.actionUrl,
      note: copy.reminder.note,
      footer: copy.footer,
    }),
    preferenceEnabled: input.preferenceEnabled,
  };
}

export function staffInviteEmailTemplate(input: {
  recipientEmail: string;
  businessName: string;
  inviteUrl: string;
  locale?: EmailLocale;
}): TransactionalEmailMessage {
  const copy = copyFor(input.locale);

  return {
    event: "staff_invited",
    to: input.recipientEmail,
    subject: copy.invite.subject(input.businessName),
    text: copy.invite.text(input.businessName, input.inviteUrl),
    html: brandedEmailHtml({
      preview: copy.invite.preview(input.businessName),
      eyebrow: copy.invite.eyebrow,
      title: copy.invite.title(input.businessName),
      intro: copy.invite.intro,
      details: [{ label: copy.businessLabel, value: input.businessName }],
      actionLabel: copy.invite.actionLabel,
      actionUrl: input.inviteUrl,
      note: copy.invite.note,
      footer: copy.footer,
    }),
  };
}

export function supportEmailTemplate(input: {
  event: "support_created" | "support_replied";
  recipientEmail: string;
  subject: string;
  actionUrl: string;
  isAdminNotification?: boolean;
  locale?: EmailLocale;
  preferenceEnabled?: boolean;
}): TransactionalEmailMessage {
  const copy = copyFor(input.locale);
  const intro =
    input.event === "support_replied"
      ? copy.support.replyIntro
      : input.isAdminNotification
        ? copy.support.adminIntro
        : copy.support.createdIntro;

  const subject =
    input.event === "support_replied"
      ? copy.support.replySubject
      : input.isAdminNotification
        ? `${copy.support.adminSubjectPrefix}: ${input.subject}`
        : copy.support.createdSubject;

  return {
    event: input.event,
    to: input.recipientEmail,
    subject,
    text: copy.support.text(intro, input.subject, input.actionUrl),
    html: brandedEmailHtml({
      preview: intro,
      eyebrow: input.isAdminNotification
        ? copy.support.supportAlert
        : copy.support.supportEyebrow,
      title:
        input.event === "support_replied"
          ? copy.support.replyTitle
          : input.isAdminNotification
            ? copy.support.adminTitle
            : copy.support.createdTitle,
      intro,
      details: [{ label: copy.subjectLabel, value: input.subject }],
      actionLabel: input.isAdminNotification
        ? copy.support.openAdminSupport
        : copy.support.openConversation,
      actionUrl: input.actionUrl,
      note: copy.support.note,
      footer: copy.footer,
    }),
    preferenceEnabled: input.preferenceEnabled,
  };
}
