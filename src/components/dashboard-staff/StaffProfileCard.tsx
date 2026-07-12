import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/useI18n";
import {
  AvailabilityRow,
  Service,
  StaffMember,
  UpdateStaffField,
} from "./dashboardStaffTypes";
import StaffAvailabilitySummary from "./StaffAvailabilitySummary";
import StaffServiceAssignmentCard from "./StaffServiceAssignmentCard";

type Props = {
  staff: StaffMember;
  services: Service[];
  assignedServiceIds: string[];
  availabilityRows: AvailabilityRow[];
  isEditing: boolean;
  savingStaffId: string | null;
  savingAssignmentKey: string | null;
  actionLoadingKey: string | null;
  updateLocalStaff: UpdateStaffField;
  saveStaff: (staff: StaffMember) => void;
  toggleStaffActive: (staff: StaffMember) => void;
  setEditingStaffId: (id: string | null) => void;
  loadData: () => void;
  toggleStaffService: (
    staffId: string,
    serviceId: string,
    currentlyAssigned: boolean,
  ) => void;
  isCurrentUser?: boolean;
  resendStaffInvite: (staff: StaffMember) => void;
  copyStaffInviteLink: (staff: StaffMember) => void;
  revokeStaffInvite: (staff: StaffMember) => void;
};

export default function StaffProfileCard({
  staff,
  services,
  assignedServiceIds,
  availabilityRows,
  isEditing,
  savingStaffId,
  savingAssignmentKey,
  actionLoadingKey,
  updateLocalStaff,
  saveStaff,
  toggleStaffActive,
  setEditingStaffId,
  loadData,
  toggleStaffService,
  isCurrentUser = false,
  resendStaffInvite,
  copyStaffInviteLink,
  revokeStaffInvite,
}: Props) {
  const { t } = useI18n();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const activeAssignedCount = services.filter(
    (service) => service.active && assignedServiceIds.includes(service.id),
  ).length;
  const openDayCount = availabilityRows.filter(
    (row) => row.staff_member_id === staff.id && row.is_closed !== true,
  ).length;

  const normalisedInviteStatus = (staff.invite_status || "").toLowerCase();
  const isLinked = Boolean(staff.user_id);
  const hasInviteEmail = Boolean(staff.email);
  const inviteStatusLabel = isCurrentUser
    ? t("dashboardStaff.card.currentAccount", "Your profile")
    : isLinked
      ? t("dashboardStaff.card.accountLinked", "Account linked")
      : hasInviteEmail
        ? normalisedInviteStatus === "invited" ||
          normalisedInviteStatus === "pending"
          ? t("dashboardStaff.card.invitePending", "Invite pending")
          : t("dashboardStaff.card.readyToLink", "Ready to link")
        : t("dashboardStaff.card.noLoginEmail", "No login email");
  const inviteStatusBody = isCurrentUser
    ? t(
        "dashboardStaff.card.currentAccountBody",
        "This is your own bookable staff profile. Manage services and working hours here; appointment requests stay in Inbox and Calendar.",
      )
    : isLinked
      ? t(
          "dashboardStaff.card.accountLinkedBody",
          "This staff profile is connected to a user login. They can access their own staff workspace.",
        )
      : hasInviteEmail
        ? t(
            "dashboardStaff.card.readyToLinkBody",
            "This profile can link automatically when the staff member signs up or logs in using this exact email.",
          )
        : t(
            "dashboardStaff.card.noLoginEmailBody",
            "Add an email if this staff member needs their own Mirëbook login. Leave it blank for owner-managed or non-login staff.",
          );
  const inviteStatusTone = isLinked
    ? "success"
    : hasInviteEmail
      ? "warning"
      : "muted";
  const displayName = isCurrentUser
    ? t("dashboardStaff.card.currentUserName", "You")
    : staff.name || t("dashboardStaff.card.untitled", "Untitled staff member");

  const bookableStatusLabel = staff.active
    ? t("dashboardStaff.card.bookableActive", "Bookable: active")
    : t("dashboardStaff.card.bookableDisabled", "Bookable: disabled");
  const bookableStatusBody = staff.active
    ? t(
        "dashboardStaff.card.bookableActiveBody",
        "This staff profile can be used for new customer bookings once services and availability are set.",
      )
    : t(
        "dashboardStaff.card.bookableDisabledBody",
        "This staff profile is saved but hidden from new customer bookings.",
      );
  return (
    <div
      className="card staff-profile-card"
      style={{
        borderColor: !staff.active
          ? "rgba(255,190,11,0.25)"
          : activeAssignedCount === 0
            ? "rgba(255,190,11,0.35)"
            : "rgba(45,212,191,0.18)",
      }}
    >
      <div className="staff-card-top">
        <div className="staff-main-copy">
          <div className="staff-title-row">
            <strong>{displayName}</strong>

            <span
              className={`small staff-status-pill staff-status-${inviteStatusTone}`}
              title={t("dashboardStaff.card.accountLink", "Account")}
            >
              {inviteStatusLabel}
            </span>

            <span
              className={`small staff-status-pill ${staff.active ? "staff-status-success" : "staff-status-warning"}`}
              title={t("dashboardStaff.card.bookableStatus", "Bookable status")}
            >
              {bookableStatusLabel}
            </span>
          </div>

          {!isEditing && (
            <>
              <p className="small muted staff-line">
                {[
                  isCurrentUser && staff.name ? staff.name : null,
                  staff.role_title ||
                    t("dashboardStaff.card.noRole", "No role title added"),
                ]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                · {activeAssignedCount}{" "}
                {t("dashboardStaff.card.servicesAssigned", "services")} ·{" "}
                {openDayCount} {t("dashboardStaff.card.openDays", "open days")}
              </p>

              {detailsOpen && (
                <div className="staff-detail-summary">
                  <p className="small muted staff-line">
                    {staff.email ||
                      t("dashboardStaff.card.noEmail", "No email")}{" "}
                    ·{" "}
                    {staff.phone ||
                      t("dashboardStaff.card.noPhone", "No phone")}
                  </p>
                  <p className="small muted staff-line">{inviteStatusBody}</p>
                  <p className="small muted staff-line">{bookableStatusBody}</p>
                </div>
              )}
            </>
          )}

          {isEditing && (
            <div className="staff-edit-grid">
              <input
                placeholder={t(
                  "dashboardStaff.create.namePlaceholder",
                  "Staff name",
                )}
                value={staff.name || ""}
                onChange={(e) =>
                  updateLocalStaff(staff.id, "name", e.target.value)
                }
              />

              <input
                placeholder={t(
                  "dashboardStaff.create.rolePlaceholder",
                  "Role title",
                )}
                value={staff.role_title || ""}
                onChange={(e) =>
                  updateLocalStaff(staff.id, "role_title", e.target.value)
                }
              />

              <input
                type="email"
                placeholder={t(
                  "dashboardStaff.create.emailPlaceholder",
                  "Email",
                )}
                value={staff.email || ""}
                onChange={(e) =>
                  updateLocalStaff(staff.id, "email", e.target.value)
                }
              />

              <p className="small muted staff-edit-help">
                {staff.user_id
                  ? t(
                      "dashboardStaff.card.linkedEmailLockedHint",
                      "Changing this email will not move the linked user login. Use this field only for contact/reference details once linked.",
                    )
                  : t(
                      "dashboardStaff.card.emailLinkHint",
                      "Use the exact email this staff member will use to register or log in if they need staff access.",
                    )}
              </p>

              <input
                placeholder={t("common.phone", "Phone")}
                value={staff.phone || ""}
                onChange={(e) =>
                  updateLocalStaff(staff.id, "phone", e.target.value)
                }
              />

              <label
                className="card staff-active-toggle"
                style={{ background: "var(--surface-2)" }}
              >
                <div className="staff-active-toggle-row">
                  <input
                    type="checkbox"
                    checked={staff.active}
                    onChange={(e) =>
                      updateLocalStaff(staff.id, "active", e.target.checked)
                    }
                  />

                  <div>
                    <strong>
                      {t(
                        "dashboardStaff.card.activeForBookings",
                        "Active for bookings",
                      )}
                    </strong>
                    <p className="small muted staff-line">
                      {t(
                        "dashboardStaff.card.activeForBookingsBody",
                        "Inactive staff stay saved but should not be used for new customer bookings.",
                      )}
                    </p>
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        <div className="staff-card-actions">
          {isEditing ? (
            <>
              <button
                onClick={() => saveStaff(staff)}
                className="btn btn-accent"
                disabled={savingStaffId === staff.id}
              >
                {savingStaffId === staff.id
                  ? t("account.saving", "Saving...")
                  : t("dashboardStaff.card.saveStaff", "Save staff")}
              </button>

              <button
                onClick={() => {
                  setEditingStaffId(null);
                  loadData();
                }}
                className="btn btn-ghost"
              >
                {t("common.cancel", "Cancel")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setDetailsOpen((open) => !open)}
                className="btn btn-ghost"
              >
                {detailsOpen
                  ? t("dashboardStaff.card.hideDetails", "Hide details")
                  : t("dashboardStaff.card.viewDetails", "View details")}
              </button>

              <details className="staff-more-actions">
                <summary
                  aria-label={t("dashboardStaff.card.actions", "Staff actions")}
                  title={t("dashboardStaff.card.actions", "Staff actions")}
                >
                  <span aria-hidden="true">•••</span>
                </summary>
                <div className="staff-actions-menu">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailsOpen(true);
                      setEditingStaffId(staff.id);
                    }}
                  >
                    {t("common.edit", "Edit")}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleStaffActive(staff)}
                  >
                    {staff.active
                      ? t("dashboardStaff.card.deactivate", "Deactivate")
                      : t("dashboardStaff.card.activate", "Activate")}
                  </button>

                  <Link
                    href={`/dashboard/staff-availability?staffId=${staff.id}`}
                  >
                    {t(
                      "dashboardStaff.availability.openCta",
                      "Open availability",
                    )}
                  </Link>

                  {!isLinked && hasInviteEmail && (
                    <>
                      <button
                        type="button"
                        onClick={() => resendStaffInvite(staff)}
                        disabled={actionLoadingKey === `invite-${staff.id}`}
                      >
                        {t("dashboardStaff.invite.resend", "Resend invite")}
                      </button>
                      <button
                        type="button"
                        onClick={() => copyStaffInviteLink(staff)}
                        disabled={
                          actionLoadingKey === `copy-invite-${staff.id}`
                        }
                      >
                        {t("dashboardStaff.invite.copy", "Copy invite link")}
                      </button>
                      {(normalisedInviteStatus === "invited" ||
                        normalisedInviteStatus === "pending") && (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => revokeStaffInvite(staff)}
                          disabled={
                            actionLoadingKey === `revoke-invite-${staff.id}`
                          }
                        >
                          {t("dashboardStaff.invite.revoke", "Revoke invite")}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </details>
            </>
          )}
        </div>
      </div>

      {(detailsOpen || isEditing) && (
        <div className="grid-2 staff-card-grid">
          <StaffServiceAssignmentCard
            staff={staff}
            services={services}
            assignedServiceIds={assignedServiceIds}
            savingAssignmentKey={savingAssignmentKey}
            onToggleAssignment={toggleStaffService}
          />

          <StaffAvailabilitySummary
            staff={staff}
            availabilityRows={availabilityRows}
          />
        </div>
      )}

      <style jsx>{`
        .staff-profile-card {
          display: grid;
          gap: 1rem;
        }

        .staff-card-top {
          display: flex;
          justify-content: space-between;
          gap: 1.25rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .staff-main-copy {
          flex: 1;
          min-width: 260px;
          display: grid;
          gap: 0.6rem;
        }

        .staff-line {
          margin-top: 0;
        }

        .staff-detail-summary {
          display: grid;
          gap: 0.35rem;
          padding-top: 0.35rem;
          border-top: 1px solid var(--border);
        }

        .staff-title-row,
        .staff-card-actions {
          display: flex;
          gap: 0.55rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .staff-more-actions {
          position: relative;
        }

        .staff-more-actions summary {
          display: grid;
          width: 2.55rem;
          height: 2.55rem;
          place-items: center;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
          color: var(--text);
          cursor: pointer;
          list-style: none;
          letter-spacing: 0;
        }

        .staff-more-actions summary::-webkit-details-marker {
          display: none;
        }

        .staff-actions-menu {
          position: absolute;
          top: calc(100% + 0.4rem);
          right: 0;
          z-index: 20;
          display: grid;
          min-width: 12rem;
          padding: 0.35rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          box-shadow: 0 1rem 2.5rem rgba(0, 0, 0, 0.3);
        }

        .staff-actions-menu button,
        .staff-actions-menu a {
          width: 100%;
          padding: 0.55rem 0.65rem;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          font: inherit;
          text-align: left;
          text-decoration: none;
          cursor: pointer;
        }

        .staff-actions-menu button:hover,
        .staff-actions-menu button:focus-visible,
        .staff-actions-menu a:hover,
        .staff-actions-menu a:focus-visible {
          background: var(--surface-2);
        }

        .staff-actions-menu .danger {
          color: var(--danger);
        }

        .staff-status-pill {
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
        }

        .staff-status-success {
          background: rgba(45, 212, 191, 0.12);
          color: var(--success);
        }

        .staff-status-warning {
          background: rgba(255, 190, 11, 0.12);
          color: var(--warning);
        }

        .staff-status-muted {
          background: var(--surface-2);
          color: var(--text-muted);
        }

        .staff-linking-success {
          border-color: rgba(45, 212, 191, 0.22);
        }

        .staff-linking-warning {
          border-color: rgba(255, 190, 11, 0.25);
        }

        .staff-linking-muted {
          border-color: var(--border);
        }

        .staff-edit-help {
          grid-column: 1 / -1;
          margin-top: -0.25rem;
        }

        .staff-card-actions {
          justify-content: flex-end;
          align-items: center;
        }

        .staff-edit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.75rem;
          margin-top: 0.25rem;
        }

        .staff-active-toggle {
          cursor: pointer;
          grid-column: 1 / -1;
        }

        .staff-active-toggle-row {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }

        .staff-active-toggle-row p {
          margin-top: 0;
        }

        @media (max-width: 640px) {
          .staff-profile-card {
            padding: 0.8rem;
          }

          .staff-card-top {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 0.65rem;
          }

          .staff-main-copy {
            min-width: 0;
          }

          .staff-card-actions {
            display: grid;
            grid-template-columns: auto 2.55rem;
            justify-content: end;
            align-items: start;
          }

          .staff-card-actions > button {
            width: auto;
            min-height: 2.55rem;
            padding-inline: 0.65rem;
          }

          .staff-actions-menu {
            right: 0;
            min-width: min(13rem, calc(100vw - 2rem));
          }
        }
      `}</style>
    </div>
  );
}
