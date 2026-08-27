import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  Link2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { getStableBrowserSession } from "@/lib/auth/getStableBrowserSession";
import {
  EMPTY_PREPARED_PROFILE,
  newPreparedService,
  type PreparedBusinessProfile,
  type PreparedProfileDraft,
  type PreparedServiceDraft,
} from "@/lib/onboardingPreparedProfile";

type Props = {
  caseId: string;
  prospectName: string;
  categoryKey: string;
  city: string;
  address: string;
  phone: string;
  ownerEmail: string;
  t: (key: string, fallback?: string) => string;
};

const CURRENCIES = ["ALL", "EUR", "GBP", "USD"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function preparedBusinessCategory(categoryKey: string) {
  const values: Record<string, string> = {
    beauty_grooming: "Beauty",
    dental_health: "Dental health",
    wellness_fitness: "Wellness and fitness",
    events: "Events",
    learning_lessons: "Learning and lessons",
    tours_activities: "Tours and activities",
    rentals: "Rentals",
    attractions: "Attractions",
    food_drink: "Food and drink",
    lodging: "Accommodation",
  };
  return values[categoryKey] || categoryKey;
}

export default function PreparedProfilePanel({
  caseId,
  prospectName,
  categoryKey,
  city,
  address,
  phone,
  ownerEmail: initialOwnerEmail,
  t,
}: Props) {
  const [profile, setProfile] = useState<PreparedBusinessProfile>({
    ...EMPTY_PREPARED_PROFILE,
    name: prospectName,
    category: preparedBusinessCategory(categoryKey),
    city,
    address,
    phone,
  });
  const [services, setServices] = useState<PreparedServiceDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [saved, setSaved] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(
    initialOwnerEmail.trim().toLowerCase(),
  );
  const [handoffIssuedAt, setHandoffIssuedAt] = useState<string | null>(null);
  const [adoptedBusinessId, setAdoptedBusinessId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const linkRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      const session = await getStableBrowserSession();
      if (!session || !active) return;
      const response = await fetch(
        `/api/admin/onboarding-profile?caseId=${encodeURIComponent(caseId)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      const payload = (await response.json()) as {
        storageAvailable?: boolean;
        draft?: PreparedProfileDraft | null;
        error?: string;
      };
      if (!active) return;
      if (!response.ok) {
        setError(
          payload.error ||
            t(
              "admin.onboarding.prepared.loadError",
              "The prepared profile could not be loaded.",
            ),
        );
      } else if (payload.storageAvailable === false) {
        setStorageAvailable(false);
      } else if (payload.draft) {
        setProfile(payload.draft.profile);
        setServices(payload.draft.services || []);
        setOwnerEmail(
          payload.draft.intendedOwnerEmail ||
            initialOwnerEmail.trim().toLowerCase(),
        );
        setSaved(true);
        setHandoffIssuedAt(payload.draft.handoffIssuedAt || null);
        setAdoptedBusinessId(payload.draft.adoptedBusinessId || null);
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [caseId, initialOwnerEmail, t]);

  function updateProfile<K extends keyof PreparedBusinessProfile>(
    key: K,
    value: PreparedBusinessProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setMessage("");
  }

  function updateService<K extends keyof PreparedServiceDraft>(
    id: string,
    key: K,
    value: PreparedServiceDraft[K],
  ) {
    setServices((current) =>
      current.map((service) =>
        service.id === id ? { ...service, [key]: value } : service,
      ),
    );
    setSaved(false);
    setMessage("");
  }

  async function saveProfile() {
    setSaving(true);
    setError("");
    setMessage("");
    const session = await getStableBrowserSession();
    if (!session) {
      setError(
        t(
          "admin.onboarding.prepared.sessionError",
          "Sign in again before saving.",
        ),
      );
      setSaving(false);
      return;
    }
    const response = await fetch("/api/admin/onboarding-profile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "save", caseId, profile, services }),
    });
    const payload = (await response.json()) as {
      draft?: PreparedProfileDraft;
      error?: string;
    };
    if (!response.ok) {
      setError(
        payload.error ||
          t(
            "admin.onboarding.prepared.saveError",
            "The prepared profile could not be saved.",
          ),
      );
    } else {
      setSaved(true);
      setMessage(
        t(
          "admin.onboarding.prepared.saved",
          "Prepared profile saved privately.",
        ),
      );
    }
    setSaving(false);
  }

  async function issueHandoff() {
    setIssuing(true);
    setError("");
    setMessage("");
    const session = await getStableBrowserSession();
    if (!session) {
      setError(
        t(
          "admin.onboarding.prepared.sessionError",
          "Sign in again before saving.",
        ),
      );
      setIssuing(false);
      return;
    }
    const response = await fetch("/api/admin/onboarding-profile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "issue", caseId, ownerEmail }),
    });
    const payload = (await response.json()) as {
      handoffUrl?: string;
      draft?: PreparedProfileDraft;
      error?: string;
    };
    if (!response.ok || !payload.handoffUrl) {
      setError(
        payload.error ||
          t(
            "admin.onboarding.prepared.linkError",
            "The secure link could not be created.",
          ),
      );
    } else {
      setHandoffUrl(payload.handoffUrl);
      setHandoffIssuedAt(
        payload.draft?.handoffIssuedAt || new Date().toISOString(),
      );
      setMessage(
        t(
          "admin.onboarding.prepared.linkReady",
          "Secure owner link created. Copy it now.",
        ),
      );
    }
    setIssuing(false);
  }

  async function copyLink() {
    if (!handoffUrl) return;
    try {
      await navigator.clipboard.writeText(handoffUrl);
    } catch {
      linkRef.current?.focus();
      linkRef.current?.select();
    }
    setMessage(t("admin.onboarding.prepared.linkCopied", "Owner link copied."));
  }

  if (loading) {
    return (
      <section className="prepared-panel prepared-state" role="status">
        {t("admin.onboarding.prepared.loading", "Loading prepared profile...")}
      </section>
    );
  }

  if (!storageAvailable) {
    return (
      <section className="prepared-panel prepared-state warning">
        <strong>
          {t(
            "admin.onboarding.prepared.sqlTitle",
            "Prepared handoff is not enabled",
          )}
        </strong>
        <p>
          {t(
            "admin.onboarding.prepared.sqlBody",
            "Run SQL 43 and SQL 44 before preparing services or creating an owner link.",
          )}
        </p>
      </section>
    );
  }

  return (
    <section className="prepared-panel">
      <header className="prepared-heading">
        <div>
          <span>
            <ShieldCheck aria-hidden="true" />
            {t("admin.onboarding.prepared.kicker", "Private setup draft")}
          </span>
          <h3>
            {t("admin.onboarding.prepared.title", "Prepared owner profile")}
          </h3>
          <p>
            {t(
              "admin.onboarding.prepared.body",
              "Prefill the useful details now. Imported services stay hidden until the verified owner reviews them.",
            )}
          </p>
        </div>
        {adoptedBusinessId ? (
          <span className="adopted-badge">
            <Check aria-hidden="true" />
            {t("admin.onboarding.prepared.connected", "Owner connected")}
          </span>
        ) : null}
      </header>

      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice success" role="status">
          {message}
        </div>
      )}

      <div className="profile-grid">
        <label>
          <span>
            {t("admin.onboarding.prepared.businessName", "Business name")}
          </span>
          <input
            value={profile.name}
            onChange={(event) => updateProfile("name", event.target.value)}
          />
        </label>
        <label>
          <span>{t("admin.onboarding.prepared.category", "Category")}</span>
          <input
            value={profile.category}
            onChange={(event) => updateProfile("category", event.target.value)}
          />
        </label>
        <label>
          <span>{t("admin.onboarding.prepared.city", "City")}</span>
          <input
            value={profile.city}
            onChange={(event) => updateProfile("city", event.target.value)}
          />
        </label>
        <label>
          <span>{t("admin.onboarding.prepared.phone", "Business phone")}</span>
          <input
            value={profile.phone}
            onChange={(event) => updateProfile("phone", event.target.value)}
          />
        </label>
        <label className="wide-field">
          <span>{t("admin.onboarding.prepared.address", "Address")}</span>
          <input
            value={profile.address}
            onChange={(event) => updateProfile("address", event.target.value)}
          />
        </label>
        <label>
          <span>{t("admin.onboarding.prepared.currency", "Currency")}</span>
          <select
            value={profile.currency}
            onChange={(event) =>
              updateProfile(
                "currency",
                event.target.value as PreparedBusinessProfile["currency"],
              )
            }
          >
            {CURRENCIES.map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t("admin.onboarding.prepared.timezone", "Timezone")}</span>
          <input
            value={profile.timezone}
            onChange={(event) => updateProfile("timezone", event.target.value)}
          />
        </label>
        <label className="wide-field">
          <span>
            {t(
              "admin.onboarding.prepared.description",
              "Owner-review description",
            )}
          </span>
          <textarea
            rows={3}
            value={profile.description}
            onChange={(event) =>
              updateProfile("description", event.target.value)
            }
          />
        </label>
        <label className="owner-toggle wide-field">
          <input
            type="checkbox"
            checked={profile.ownerTakesBookings}
            onChange={(event) =>
              updateProfile("ownerTakesBookings", event.target.checked)
            }
          />
          <span>
            <strong>
              {t(
                "admin.onboarding.prepared.ownerProvider",
                "Prepare the owner as a provider",
              )}
            </strong>
            <small>
              {t(
                "admin.onboarding.prepared.ownerProviderBody",
                "Useful for solo appointment businesses. It does not activate services or working hours.",
              )}
            </small>
          </span>
        </label>
      </div>

      <section className="prepared-services">
        <header>
          <div>
            <h4>
              {t("admin.onboarding.prepared.services", "Prepared services")}
            </h4>
            <p>
              {t(
                "admin.onboarding.prepared.servicesBody",
                "Use confirmed values where available and mark unknown prices clearly.",
              )}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setServices((current) => [...current, newPreparedService()]);
              setSaved(false);
            }}
          >
            <Plus aria-hidden="true" />
            {t("admin.onboarding.prepared.addService", "Add service draft")}
          </button>
        </header>
        <div className="prepared-service-list">
          {services.length === 0 && (
            <p className="empty-services">
              {t(
                "admin.onboarding.prepared.noServices",
                "No service drafts added yet.",
              )}
            </p>
          )}
          {services.map((service, index) => (
            <article key={service.id}>
              <header>
                <strong>
                  {t("admin.onboarding.prepared.serviceNumber", "Service")}{" "}
                  {index + 1}
                </strong>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t(
                    "admin.onboarding.prepared.removeService",
                    "Remove service draft",
                  )}
                  onClick={() => {
                    setServices((current) =>
                      current.filter((item) => item.id !== service.id),
                    );
                    setSaved(false);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </header>
              <div className="service-grid">
                <label className="wide-field">
                  <span>
                    {t("admin.onboarding.prepared.serviceName", "Service name")}
                  </span>
                  <input
                    value={service.name}
                    onChange={(event) =>
                      updateService(service.id, "name", event.target.value)
                    }
                  />
                </label>
                <label>
                  <span>
                    {t("dashboardServices.create.duration", "Duration")}
                  </span>
                  <input
                    type="number"
                    min={5}
                    value={service.durationMinutes}
                    onChange={(event) =>
                      updateService(
                        service.id,
                        "durationMinutes",
                        Number(event.target.value),
                      )
                    }
                  />
                </label>
                <label>
                  <span>
                    {t("dashboardServices.create.pricePlaceholder", "Price")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={service.price}
                    onChange={(event) =>
                      updateService(
                        service.id,
                        "price",
                        Number(event.target.value),
                      )
                    }
                  />
                </label>
                <label>
                  <span>
                    {t("admin.onboarding.prepared.bookingType", "Booking type")}
                  </span>
                  <select
                    value={service.bookingType}
                    onChange={(event) => {
                      const value = event.target
                        .value as PreparedServiceDraft["bookingType"];
                      updateService(service.id, "bookingType", value);
                      updateService(
                        service.id,
                        "groupCapacity",
                        value === "group" ? service.groupCapacity || 12 : null,
                      );
                    }}
                  >
                    <option value="appointment">
                      {t(
                        "admin.onboarding.prepared.appointment",
                        "Appointment",
                      )}
                    </option>
                    <option value="group">
                      {t(
                        "admin.onboarding.prepared.group",
                        "Departure with seats",
                      )}
                    </option>
                  </select>
                </label>
                {service.bookingType === "group" && (
                  <label>
                    <span>
                      {t("dashboardServices.group.capacity", "Default seats")}
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={service.groupCapacity || 1}
                      onChange={(event) =>
                        updateService(
                          service.id,
                          "groupCapacity",
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                )}
                <label className="confirm-toggle">
                  <input
                    type="checkbox"
                    checked={service.priceKnown}
                    onChange={(event) =>
                      updateService(
                        service.id,
                        "priceKnown",
                        event.target.checked,
                      )
                    }
                  />
                  <span>
                    {t(
                      "admin.onboarding.prepared.priceConfirmed",
                      "Owner-confirmed price",
                    )}
                  </span>
                </label>
                {!service.priceKnown && service.price > 0 && (
                  <p className="estimate-note">
                    {t(
                      "admin.onboarding.prepared.estimateNote",
                      "This will be shown privately as an editable starter estimate until the owner saves it.",
                    )}
                  </p>
                )}
                {service.bookingType === "group" && (
                  <label className="confirm-toggle">
                    <input
                      type="checkbox"
                      checked={service.privateBookingEnabled}
                      onChange={(event) =>
                        updateService(
                          service.id,
                          "privateBookingEnabled",
                          event.target.checked,
                        )
                      }
                    />
                    <span>
                      {t(
                        "dashboardServices.group.privateEnabled",
                        "Allow private trip booking",
                      )}
                    </span>
                  </label>
                )}
                {service.bookingType === "group" &&
                  service.privateBookingEnabled && (
                    <label>
                      <span>
                        {t(
                          "dashboardServices.group.privatePrice",
                          "Private trip price",
                        )}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={service.privatePrice || 0}
                        onChange={(event) =>
                          updateService(
                            service.id,
                            "privatePrice",
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                  )}
                <label className="wide-field">
                  <span>
                    {t(
                      "admin.onboarding.prepared.serviceNote",
                      "Owner-review note",
                    )}
                  </span>
                  <textarea
                    rows={2}
                    value={service.description}
                    onChange={(event) =>
                      updateService(
                        service.id,
                        "description",
                        event.target.value,
                      )
                    }
                  />
                </label>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="owner-binding">
        <label>
          <span>
            {t(
              "admin.onboarding.prepared.ownerEmail",
              "Owner's verified email",
            )}
          </span>
          <input
            type="email"
            autoComplete="off"
            inputMode="email"
            value={ownerEmail}
            disabled={Boolean(adoptedBusinessId)}
            aria-invalid={
              ownerEmail.length > 0 && !EMAIL_PATTERN.test(ownerEmail)
            }
            onChange={(event) => {
              setOwnerEmail(event.target.value.trim().toLowerCase());
              setHandoffUrl("");
              setMessage("");
            }}
          />
          <small>
            {t(
              "admin.onboarding.prepared.ownerEmailBody",
              "Only a verified Business account using this exact email can connect the profile.",
            )}
          </small>
        </label>
      </section>

      <footer className="prepared-actions">
        <button
          type="button"
          className="btn btn-accent"
          disabled={saving || Boolean(adoptedBusinessId)}
          onClick={() => void saveProfile()}
        >
          <Save aria-hidden="true" />
          {saving
            ? t("account.saving", "Saving...")
            : t("admin.onboarding.prepared.save", "Save prepared profile")}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={
            !saved ||
            issuing ||
            !EMAIL_PATTERN.test(ownerEmail) ||
            Boolean(adoptedBusinessId)
          }
          onClick={() => void issueHandoff()}
        >
          <Link2 aria-hidden="true" />
          {issuing
            ? t("admin.onboarding.prepared.issuing", "Creating link...")
            : handoffIssuedAt
              ? t(
                  "admin.onboarding.prepared.replaceLink",
                  "Create a new secure link",
                )
              : t(
                  "admin.onboarding.prepared.issueLink",
                  "Create secure owner link",
                )}
        </button>
      </footer>

      {handoffUrl && (
        <div className="handoff-output">
          <label>
            <span>
              {t(
                "admin.onboarding.prepared.ownerLink",
                "Owner connection link",
              )}
            </span>
            <input ref={linkRef} readOnly value={handoffUrl} />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void copyLink()}
          >
            <Clipboard aria-hidden="true" />
            {t("admin.onboarding.prepared.copyLink", "Copy owner link")}
          </button>
          <small>
            {t(
              "admin.onboarding.prepared.linkWarning",
              "The raw link is shown only now. Creating a new link invalidates the previous one.",
            )}
          </small>
        </div>
      )}

      <style jsx>{`
        .prepared-panel {
          display: grid;
          gap: 1rem;
          border-top: 1px solid var(--border);
          padding: 1rem;
        }
        .prepared-state {
          color: var(--text-muted);
        }
        .prepared-state.warning {
          border: 1px solid rgba(255, 190, 11, 0.35);
          background: rgba(255, 190, 11, 0.08);
        }
        .prepared-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }
        .prepared-heading > div {
          display: grid;
          gap: 0.25rem;
          min-width: 0;
        }
        .prepared-heading > div > span {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: var(--accent);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
        }
        .prepared-heading :global(svg),
        .prepared-actions :global(svg),
        .handoff-output :global(svg) {
          width: 17px;
          height: 17px;
        }
        .prepared-heading h3,
        .prepared-services h4 {
          font-size: 1rem;
        }
        .prepared-heading p,
        .prepared-services header p {
          color: var(--text-muted);
          font-size: 0.84rem;
        }
        .adopted-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.45rem 0.65rem;
          border-radius: 999px;
          background: rgba(20, 184, 166, 0.12);
          color: var(--success);
          font-size: 0.76rem;
          font-weight: 800;
          white-space: nowrap;
        }
        .profile-grid,
        .service-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }
        label {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
          font-size: 0.8rem;
          font-weight: 750;
        }
        input,
        select,
        textarea {
          width: 100%;
        }
        .wide-field {
          grid-column: 1 / -1;
        }
        .owner-toggle,
        .confirm-toggle {
          display: flex;
          align-items: flex-start;
          gap: 0.55rem;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface-2);
        }
        .owner-toggle input,
        .confirm-toggle input {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
        }
        .owner-toggle span {
          display: grid;
          gap: 0.2rem;
        }
        .owner-toggle small {
          color: var(--text-muted);
          font-weight: 500;
        }
        .estimate-note {
          align-self: center;
          margin: 0;
          color: var(--text-muted);
          font-size: 0.76rem;
          line-height: 1.45;
        }
        .prepared-services {
          display: grid;
          gap: 0.75rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .prepared-services > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .prepared-services > header > div {
          min-width: 0;
        }
        .prepared-service-list {
          display: grid;
          gap: 0.75rem;
        }
        .prepared-service-list article {
          display: grid;
          gap: 0.75rem;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--surface-2);
        }
        .prepared-service-list article > header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }
        .icon-button {
          display: grid;
          place-items: center;
          width: 44px;
          height: 44px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface);
          color: var(--danger);
        }
        .icon-button :global(svg) {
          width: 18px;
          height: 18px;
        }
        .empty-services {
          padding: 1rem;
          border: 1px dashed var(--border);
          border-radius: 7px;
          color: var(--text-muted);
          text-align: center;
        }
        .prepared-actions,
        .handoff-output {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }
        .owner-binding {
          padding: 0.85rem;
          border: 1px solid rgba(20, 184, 166, 0.28);
          border-radius: 7px;
          background: rgba(20, 184, 166, 0.05);
        }
        .owner-binding small {
          color: var(--text-muted);
          font-weight: 500;
          line-height: 1.45;
        }
        .handoff-output {
          padding: 0.85rem;
          border: 1px solid rgba(20, 184, 166, 0.32);
          border-radius: 7px;
          background: rgba(20, 184, 166, 0.06);
        }
        .handoff-output label {
          flex: 1 1 360px;
        }
        .handoff-output small {
          flex-basis: 100%;
          color: var(--text-muted);
        }
        @media (max-width: 700px) {
          .prepared-heading,
          .prepared-services > header {
            align-items: stretch;
            flex-direction: column;
          }
          .profile-grid,
          .service-grid {
            grid-template-columns: 1fr;
          }
          .wide-field {
            grid-column: auto;
          }
          .prepared-actions,
          .handoff-output {
            display: grid;
          }
          .prepared-actions :global(.btn),
          .handoff-output :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}
