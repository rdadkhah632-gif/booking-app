import { Locale } from "@/lib/i18n";
import { DEFAULT_TIME_ZONE } from "@/lib/timezone";
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
  timeZone?: string | null;
  actionUrl: string;
  locale?: EmailLocale;
  preferenceEnabled?: boolean;
  customerAccountHint?: boolean;
  bookingType?: "appointment" | "group";
  partySize?: number | null;
  bookingOption?: "appointment" | "shared" | "private" | null;
  meetingPoint?: string | null;
  totalPrice?: number | null;
  currency?: string | null;
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
  guideLabel: string;
  dateTimeLabel: string;
  departureLabel: string;
  guestsLabel: string;
  bookingTypeLabel: string;
  sharedSeatsLabel: string;
  privateTripLabel: string;
  meetingPointLabel: string;
  totalLabel: string;
  businessFallback: string;
  customerFallback: string;
  appointmentFallback: string;
  bookingEyebrows: Record<BookingTemplateInput["recipientRole"], string>;
  bookingActions: Record<BookingTemplateInput["recipientRole"], string>;
  bookingNote: string;
  customerAccountNote: string;
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
  groupReminder: {
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
    guideLabel: "Guide",
    dateTimeLabel: "Date and time",
    departureLabel: "Departure",
    guestsLabel: "Guests",
    bookingTypeLabel: "Booking type",
    sharedSeatsLabel: "Shared seats",
    privateTripLabel: "Private trip",
    meetingPointLabel: "Meeting point",
    totalLabel: "Total",
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
    customerAccountNote:
      "Use this customer email address to sign in or create a customer account. Once verified, this booking will appear in My bookings.",
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
    groupReminder: {
      subject: "Mirëbook: Trip reminder",
      preview: "Your trip is coming up in about 24 hours.",
      eyebrow: "Trip reminder",
      title: "Your trip is coming up",
      intro: "This is a reminder for your upcoming Mirëbook trip.",
      actionLabel: "View trip booking",
      note: "Check the departure and meeting point in Mirëbook before you travel.",
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
    guideLabel: "Guida",
    dateTimeLabel: "Data dhe ora",
    departureLabel: "Nisja",
    guestsLabel: "Persona",
    bookingTypeLabel: "Lloji i rezervimit",
    sharedSeatsLabel: "Vende të përbashkëta",
    privateTripLabel: "Udhëtim privat",
    meetingPointLabel: "Pika e takimit",
    totalLabel: "Totali",
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
    customerAccountNote:
      "Përdor këtë adresë email-i klienti për të hyrë ose për të krijuar një llogari klienti. Pas verifikimit, ky rezervim do të shfaqet te Rezervimet e mia.",
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
    groupReminder: {
      subject: "Mirëbook: Kujtesë udhëtimi",
      preview: "Udhëtimi yt është pas rreth 24 orësh.",
      eyebrow: "Kujtesë udhëtimi",
      title: "Udhëtimi yt po afrohet",
      intro:
        "Kjo është një kujtesë për udhëtimin tënd të ardhshëm në Mirëbook.",
      actionLabel: "Shiko rezervimin",
      note: "Kontrollo nisjen dhe pikën e takimit në Mirëbook para udhëtimit.",
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

function safeEmailTimeZone(timeZone?: string | null) {
  const candidate = timeZone || DEFAULT_TIME_ZONE;

  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: candidate }).format(
      new Date(),
    );
    return candidate;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

function formatDateTime(
  value: string,
  copy: EmailCopy,
  timeZone?: string | null,
) {
  return new Intl.DateTimeFormat(copy.localeCode, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: safeEmailTimeZone(timeZone),
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatMoney(
  value: number | null | undefined,
  currency: string | null | undefined,
  copy: EmailCopy,
) {
  if (value == null || !Number.isFinite(Number(value))) return null;

  try {
    return new Intl.NumberFormat(copy.localeCode, {
      style: "currency",
      currency: currency || "ALL",
      maximumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency || "ALL"}`;
  }
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
  const appointmentTime = formatDateTime(input.startAt, copy, input.timeZone);
  const bookingNote =
    input.recipientRole === "customer" && input.customerAccountHint
      ? copy.customerAccountNote
      : copy.bookingNote;
  const isGroupBooking =
    input.bookingType === "group" ||
    input.bookingOption === "shared" ||
    input.bookingOption === "private";
  const staffLabel = isGroupBooking ? copy.guideLabel : copy.staffLabel;
  const dateTimeLabel = isGroupBooking
    ? copy.departureLabel
    : copy.dateTimeLabel;
  const staffLine = input.staffName
    ? `\n${staffLabel}: ${input.staffName}`
    : "";
  const bookingOptionLabel = isGroupBooking
    ? input.bookingOption === "private"
      ? copy.privateTripLabel
      : copy.sharedSeatsLabel
    : null;
  const bookingTypeLine = bookingOptionLabel
    ? `\n${copy.bookingTypeLabel}: ${bookingOptionLabel}`
    : "";
  const guestsLine =
    isGroupBooking && input.partySize
      ? `\n${copy.guestsLabel}: ${input.partySize}`
      : "";
  const meetingPointLine = input.meetingPoint
    ? `\n${copy.meetingPointLabel}: ${input.meetingPoint}`
    : "";
  const totalPrice = formatMoney(input.totalPrice, input.currency, copy);
  const totalLine = totalPrice ? `\n${copy.totalLabel}: ${totalPrice}` : "";

  const text = `${status.intro}

${copy.businessLabel}: ${businessName}
${copy.customerLabel}: ${customerName}
${copy.serviceLabel}: ${serviceName}${staffLine}${bookingTypeLine}${guestsLine}
${dateTimeLabel}: ${appointmentTime}${meetingPointLine}${totalLine}

${copy.openMirebook}: ${input.actionUrl}

${bookingNote}

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
        { label: staffLabel, value: input.staffName },
        { label: copy.bookingTypeLabel, value: bookingOptionLabel },
        {
          label: copy.guestsLabel,
          value:
            isGroupBooking && input.partySize
              ? String(input.partySize)
              : null,
        },
        { label: dateTimeLabel, value: appointmentTime },
        { label: copy.meetingPointLabel, value: input.meetingPoint },
        { label: copy.totalLabel, value: totalPrice },
      ],
      actionLabel: copy.bookingActions[input.recipientRole],
      actionUrl: input.actionUrl,
      note: bookingNote,
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
  timeZone?: string | null;
  actionUrl: string;
  locale?: EmailLocale;
  preferenceEnabled?: boolean;
  bookingType?: "appointment" | "group";
  partySize?: number | null;
  bookingOption?: "appointment" | "shared" | "private" | null;
  meetingPoint?: string | null;
}): TransactionalEmailMessage {
  const copy = copyFor(input.locale);
  const reminder =
    input.bookingType === "group" ? copy.groupReminder : copy.reminder;
  const businessName = input.businessName || copy.businessFallback;
  const serviceName = input.serviceName || copy.appointmentFallback;
  const appointmentTime = formatDateTime(input.startAt, copy, input.timeZone);
  const staffLabel =
    input.bookingType === "group" ? copy.guideLabel : copy.staffLabel;
  const dateTimeLabel =
    input.bookingType === "group" ? copy.departureLabel : copy.dateTimeLabel;
  const staffLine = input.staffName
    ? `\n${staffLabel}: ${input.staffName}`
    : "";
  const bookingOptionLabel =
    input.bookingType === "group"
      ? input.bookingOption === "private"
        ? copy.privateTripLabel
        : copy.sharedSeatsLabel
      : null;
  const bookingTypeLine = bookingOptionLabel
    ? `${copy.bookingTypeLabel}: ${bookingOptionLabel}\n`
    : "";
  const guestsLine =
    input.bookingType === "group" && input.partySize
      ? `${copy.guestsLabel}: ${input.partySize}\n`
      : "";
  const meetingPointLine = input.meetingPoint
    ? `${copy.meetingPointLabel}: ${input.meetingPoint}\n`
    : "";

  return {
    event: "appointment_reminder",
    to: input.recipientEmail,
    subject: reminder.subject,
    text: `${reminder.preview}

${copy.businessLabel}: ${businessName}
${copy.serviceLabel}: ${serviceName}${staffLine}
${bookingTypeLine}${guestsLine}${dateTimeLabel}: ${appointmentTime}
${meetingPointLine}

${copy.openMirebook}: ${input.actionUrl}

${copy.sourceOfTruthBookings}`,
    html: brandedEmailHtml({
      preview: reminder.preview,
      eyebrow: reminder.eyebrow,
      title: reminder.title,
      intro: reminder.intro,
      details: [
        { label: copy.businessLabel, value: businessName },
        { label: copy.serviceLabel, value: serviceName },
        { label: staffLabel, value: input.staffName },
        { label: copy.bookingTypeLabel, value: bookingOptionLabel },
        {
          label: copy.guestsLabel,
          value:
            input.bookingType === "group" && input.partySize
              ? String(input.partySize)
              : null,
        },
        { label: dateTimeLabel, value: appointmentTime },
        { label: copy.meetingPointLabel, value: input.meetingPoint },
      ],
      actionLabel: reminder.actionLabel,
      actionUrl: input.actionUrl,
      note: reminder.note,
      footer: copy.footer,
    }),
    preferenceEnabled: input.preferenceEnabled,
  };
}

export function departureStatusEmailTemplate(input: {
  recipientEmail: string;
  businessName?: string | null;
  serviceName?: string | null;
  staffName?: string | null;
  startAt: string;
  timeZone?: string | null;
  meetingPoint?: string | null;
  status: "cancelled" | "completed";
  actionUrl: string;
  locale?: EmailLocale;
  preferenceEnabled?: boolean;
}): TransactionalEmailMessage {
  const copy = copyFor(input.locale);
  const albanian = input.locale === "sq";
  const cancelled = input.status === "cancelled";
  const subject = cancelled
    ? albanian
      ? "Nisja u anulua"
      : "Departure cancelled"
    : albanian
      ? "Nisja u përfundua"
      : "Departure completed";
  const intro = cancelled
    ? albanian
      ? "Biznesi anuloi një nisje të caktuar në orarin tënd."
      : "The business cancelled a departure assigned to your schedule."
    : albanian
      ? "Një nisje e caktuar në orarin tënd u shënua si e përfunduar."
      : "A departure assigned to your schedule was marked as completed.";
  const businessName = input.businessName || copy.businessFallback;
  const serviceName = input.serviceName || copy.appointmentFallback;
  const departureTime = formatDateTime(input.startAt, copy, input.timeZone);
  const staffLine = input.staffName
    ? `\n${copy.guideLabel}: ${input.staffName}`
    : "";
  const meetingPointLine = input.meetingPoint
    ? `\n${copy.meetingPointLabel}: ${input.meetingPoint}`
    : "";

  return {
    event: "departure_status_changed",
    to: input.recipientEmail,
    subject: `Mirëbook: ${subject}`,
    text: `${intro}

${copy.businessLabel}: ${businessName}
${copy.serviceLabel}: ${serviceName}${staffLine}
${copy.departureLabel}: ${departureTime}${meetingPointLine}

${copy.openMirebook}: ${input.actionUrl}

${copy.sourceOfTruthBookings}`,
    html: brandedEmailHtml({
      preview: intro,
      eyebrow: copy.bookingEyebrows.staff,
      title: subject,
      intro,
      details: [
        { label: copy.businessLabel, value: businessName },
        { label: copy.serviceLabel, value: serviceName },
        { label: copy.guideLabel, value: input.staffName },
        { label: copy.departureLabel, value: departureTime },
        { label: copy.meetingPointLabel, value: input.meetingPoint },
      ],
      actionLabel: copy.bookingActions.staff,
      actionUrl: input.actionUrl,
      note: cancelled
        ? albanian
          ? "Nisja është mbyllur dhe nuk pranon më rezervime."
          : "The departure is closed and no longer accepts reservations."
        : copy.bookingNote,
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

type OwnershipClaimStatus =
  "submitted" | "needs_more_info" | "approved" | "rejected";

const OWNERSHIP_CLAIM_COPY: Record<
  EmailLocale,
  {
    place: string;
    business: string;
    reviewNote: string;
    footer: string;
    operator: {
      subject: string;
      eyebrow: string;
      title: string;
      intro: (businessName: string, placeName: string) => string;
      action: string;
      note: string;
    };
    owner: Record<
      OwnershipClaimStatus,
      {
        subject: string;
        eyebrow: string;
        title: string;
        intro: (placeName: string) => string;
        action: string;
        note: string;
      }
    >;
  }
> = {
  en: {
    place: "Directory place",
    business: "Mirëbook business",
    reviewNote: "Review note",
    footer:
      "This email was sent by Mirëbook about a business ownership request. Mirëbook Business remains the source of truth.",
    operator: {
      subject: "Mirëbook: Ownership claim needs review",
      eyebrow: "Ownership review",
      title: "Ownership claim needs review",
      intro: (businessName, placeName) =>
        `${businessName} submitted an ownership claim for ${placeName}.`,
      action: "Review claim",
      note: "Review the evidence before linking any directory place to a Mirëbook business.",
    },
    owner: {
      submitted: {
        subject: "Mirëbook: Ownership claim received",
        eyebrow: "Ownership request",
        title: "Ownership claim received",
        intro: (placeName) =>
          `We received your ownership request for ${placeName}.`,
        action: "View request",
        note: "The directory listing stays unchanged while Mirëbook reviews the evidence.",
      },
      needs_more_info: {
        subject: "Mirëbook: More ownership information needed",
        eyebrow: "Action needed",
        title: "More information is needed",
        intro: (placeName) =>
          `Mirëbook needs more information for your ownership request for ${placeName}.`,
        action: "Add information",
        note: "Open the request to read the review note and submit clearer evidence.",
      },
      approved: {
        subject: "Mirëbook: Ownership claim approved",
        eyebrow: "Ownership approved",
        title: "Ownership claim approved",
        intro: (placeName) =>
          `${placeName} is now linked to your Mirëbook business.`,
        action: "Continue business setup",
        note: "Approval does not publish the business. Complete Setup and publish only when you are ready.",
      },
      rejected: {
        subject: "Mirëbook: Ownership claim not approved",
        eyebrow: "Ownership review",
        title: "Ownership claim not approved",
        intro: (placeName) =>
          `The ownership request for ${placeName} was not approved.`,
        action: "Review decision",
        note: "Open the request to read the review note before submitting new evidence.",
      },
    },
  },
  sq: {
    place: "Vendi në direktori",
    business: "Biznesi në Mirëbook",
    reviewNote: "Shënimi i shqyrtimit",
    footer:
      "Ky email u dërgua nga Mirëbook për një kërkesë pronësie biznesi. Mirëbook Business mbetet burimi zyrtar.",
    operator: {
      subject: "Mirëbook: Pretendim pronësie për shqyrtim",
      eyebrow: "Shqyrtimi i pronësisë",
      title: "Pretendim pronësie për shqyrtim",
      intro: (businessName, placeName) =>
        `${businessName} dërgoi një pretendim pronësie për ${placeName}.`,
      action: "Shqyrto pretendimin",
      note: "Kontrollo provat përpara se të lidhësh një vend të direktorisë me një biznes në Mirëbook.",
    },
    owner: {
      submitted: {
        subject: "Mirëbook: Pretendimi i pronësisë u mor",
        eyebrow: "Kërkesë pronësie",
        title: "Pretendimi i pronësisë u mor",
        intro: (placeName) =>
          `Morëm kërkesën tënde të pronësisë për ${placeName}.`,
        action: "Shiko kërkesën",
        note: "Listimi në direktori mbetet i pandryshuar ndërsa Mirëbook shqyrton provat.",
      },
      needs_more_info: {
        subject: "Mirëbook: Nevojiten më shumë të dhëna pronësie",
        eyebrow: "Nevojitet veprim",
        title: "Nevojiten më shumë të dhëna",
        intro: (placeName) =>
          `Mirëbook ka nevojë për më shumë të dhëna për kërkesën e pronësisë për ${placeName}.`,
        action: "Shto të dhëna",
        note: "Hap kërkesën për të lexuar shënimin e shqyrtimit dhe dërgo prova më të qarta.",
      },
      approved: {
        subject: "Mirëbook: Pretendimi i pronësisë u miratua",
        eyebrow: "Pronësia u miratua",
        title: "Pretendimi i pronësisë u miratua",
        intro: (placeName) =>
          `${placeName} tani është lidhur me biznesin tënd në Mirëbook.`,
        action: "Vazhdo konfigurimin e biznesit",
        note: "Miratimi nuk e publikon biznesin. Përfundo Konfigurimin dhe publikoje vetëm kur të jesh gati.",
      },
      rejected: {
        subject: "Mirëbook: Pretendimi i pronësisë nuk u miratua",
        eyebrow: "Shqyrtimi i pronësisë",
        title: "Pretendimi i pronësisë nuk u miratua",
        intro: (placeName) =>
          `Kërkesa e pronësisë për ${placeName} nuk u miratua.`,
        action: "Shiko vendimin",
        note: "Hap kërkesën për të lexuar shënimin përpara se të dërgosh prova të reja.",
      },
    },
  },
};

export function ownershipClaimEmailTemplate(input: {
  recipientEmail: string;
  recipientRole: "owner" | "operator";
  status: OwnershipClaimStatus;
  placeName: string;
  businessName: string;
  actionUrl: string;
  reviewNote?: string | null;
  locale?: EmailLocale;
}): TransactionalEmailMessage {
  const locale = input.locale === "sq" ? "sq" : "en";
  const copy = OWNERSHIP_CLAIM_COPY[locale];
  const content =
    input.recipientRole === "operator"
      ? copy.operator
      : copy.owner[input.status];
  const intro =
    input.recipientRole === "operator"
      ? copy.operator.intro(input.businessName, input.placeName)
      : copy.owner[input.status].intro(input.placeName);

  return {
    event:
      input.status === "submitted"
        ? "directory_claim_submitted"
        : "directory_claim_status_changed",
    to: input.recipientEmail,
    subject: content.subject,
    text: `${intro}

${copy.place}: ${input.placeName}
${copy.business}: ${input.businessName}${
      input.reviewNote ? `\n${copy.reviewNote}: ${input.reviewNote}` : ""
    }

${content.action}: ${input.actionUrl}

${content.note}`,
    html: brandedEmailHtml({
      preview: intro,
      eyebrow: content.eyebrow,
      title: content.title,
      intro,
      details: [
        { label: copy.place, value: input.placeName },
        { label: copy.business, value: input.businessName },
        { label: copy.reviewNote, value: input.reviewNote },
      ],
      actionLabel: content.action,
      actionUrl: input.actionUrl,
      note: content.note,
      footer: copy.footer,
    }),
  };
}
