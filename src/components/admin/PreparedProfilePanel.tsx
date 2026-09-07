import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clipboard,
  ImagePlus,
  Link2,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { getStableBrowserSession } from "@/lib/auth/getStableBrowserSession";
import {
  onboardingRequest,
  OnboardingResponseError,
} from "@/lib/onboardingRequest";
import { uploadMirebookImage } from "@/lib/imageUpload";
import {
  EMPTY_PREPARED_PROFILE,
  newPreparedService,
  type PreparedBusinessProfile,
  type PreparedProfileDraft,
  type PreparedServiceDraft,
} from "@/lib/onboardingPreparedProfile";
import { type Locale, translate } from "@/lib/i18n";

type Props = {
  caseId: string;
  prospectName: string;
  categoryKey: string;
  city: string;
  address: string;
  phone: string;
  ownerEmail: string;
  preferredLanguage: Locale;
  uiLocale: Locale;
  profileMediaPermission: boolean;
  t: (key: string, fallback?: string) => string;
};

const CURRENCIES = ["ALL", "EUR", "GBP", "USD"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function interpolate(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] || "");
}

function formatHandoffDate(value: string | null, locale: Locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "sq" ? "sq-AL" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

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
  preferredLanguage,
  uiLocale,
  profileMediaPermission,
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
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [uploadingImageKey, setUploadingImageKey] = useState<string | null>(
    null,
  );
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [mediaHandoffAvailable, setMediaHandoffAvailable] = useState(true);
  const [saved, setSaved] = useState(false);
  const [handoffUrl, setHandoffUrl] = useState("");
  const [ownerEmail, setOwnerEmail] = useState(
    initialOwnerEmail.trim().toLowerCase(),
  );
  const [handoffIssuedAt, setHandoffIssuedAt] = useState<string | null>(null);
  const [handoffExpiresAt, setHandoffExpiresAt] = useState<string | null>(null);
  const [boundOwnerEmail, setBoundOwnerEmail] = useState("");
  const [adoptedAt, setAdoptedAt] = useState<string | null>(null);
  const [adoptedBusinessId, setAdoptedBusinessId] = useState<string | null>(
    null,
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [handoffUncertain, setHandoffUncertain] = useState(false);
  const [now, setNow] = useState(Date.now);
  const linkRef = useRef<HTMLInputElement>(null);
  const ownerMessageRef = useRef<HTMLTextAreaElement>(null);
  const operationRef = useRef(false);
  const copyingRef = useRef(false);
  const outputVersionRef = useRef(0);
  const requestScopeRef = useRef<AbortController | null>(null);
  const loadDefaultsRef = useRef({ profile, initialOwnerEmail, t });
  loadDefaultsRef.current = {
    profile: {
      ...EMPTY_PREPARED_PROFILE,
      name: prospectName,
      category: preparedBusinessCategory(categoryKey),
      city,
      address,
      phone,
    },
    initialOwnerEmail,
    t,
  };
  const busy = saving || issuing || Boolean(uploadingImageKey);
  const controlsDisabled = busy || Boolean(adoptedBusinessId || adoptedAt);

  function applyDraft(draft: PreparedProfileDraft) {
    setProfile(draft.profile);
    setServices(draft.services || []);
    setSaved(true);
    setHandoffIssuedAt(draft.handoffIssuedAt || null);
    setHandoffExpiresAt(draft.handoffExpiresAt || null);
    setBoundOwnerEmail(draft.intendedOwnerEmail || "");
    setAdoptedAt(draft.adoptedAt || null);
    setAdoptedBusinessId(draft.adoptedBusinessId || null);
    setHandoffUncertain(false);
  }

  useEffect(() => {
    const controller = new AbortController();
    requestScopeRef.current = controller;
    const defaults = loadDefaultsRef.current;
    const t = defaults.t;
    async function load() {
      setLoading(true);
      setLoadFailed(false);
      setError("");
      setHandoffUrl("");
      setMessage("");
      try {
        const { response, payload } = await onboardingRequest(
          async (signal) => {
            const session = await getStableBrowserSession();
            if (!session)
              throw new OnboardingResponseError(
                t(
                  "admin.onboarding.prepared.sessionError",
                  "Sign in again before saving.",
                ),
              );
            const response = await fetch(
              `/api/admin/onboarding-profile?caseId=${encodeURIComponent(caseId)}`,
              {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
                cache: "no-store",
                signal,
              },
            );
            const payload = (await response.json()) as {
              storageAvailable?: boolean;
              mediaHandoffAvailable?: boolean;
              draft?: PreparedProfileDraft | null;
              error?: string;
            };
            return { response, payload };
          },
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (!response.ok || !payload || !("draft" in payload)) {
          throw new OnboardingResponseError(
            payload?.error ||
              t(
                "admin.onboarding.prepared.loadError",
                "The prepared profile could not be loaded.",
              ),
          );
        }
        setStorageAvailable(payload.storageAvailable !== false);
        setMediaHandoffAvailable(payload.mediaHandoffAvailable !== false);
        if (payload.draft) {
          applyDraft(payload.draft);
          setOwnerEmail(
            payload.draft.intendedOwnerEmail ||
              defaults.initialOwnerEmail.trim().toLowerCase(),
          );
        } else {
          setProfile(defaults.profile);
          setServices([]);
          setOwnerEmail(defaults.initialOwnerEmail.trim().toLowerCase());
          setSaved(false);
          setHandoffIssuedAt(null);
          setHandoffExpiresAt(null);
          setBoundOwnerEmail("");
          setAdoptedAt(null);
          setAdoptedBusinessId(null);
          setHandoffUncertain(false);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
          setError(
            (error instanceof OnboardingResponseError && error.message) ||
              t(
                "admin.onboarding.prepared.loadError",
                "The prepared profile could not be loaded.",
              ),
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => {
      controller.abort();
    };
  }, [caseId, loadAttempt]);

  useEffect(() => {
    setNow(Date.now());
    if (!handoffExpiresAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [handoffExpiresAt]);

  function clearOutput() {
    outputVersionRef.current += 1;
    setHandoffUrl("");
    setMessage("");
    setError("");
  }

  function markEdited() {
    setSaved(false);
    clearOutput();
  }

  function canMutate() {
    return (
      !loading &&
      !loadFailed &&
      storageAvailable &&
      !controlsDisabled &&
      !operationRef.current
    );
  }

  async function postProfile(body: Record<string, unknown>) {
    return onboardingRequest(async (signal) => {
      const session = await getStableBrowserSession();
      if (!session) {
        throw new OnboardingResponseError(
          t(
            "admin.onboarding.prepared.sessionError",
            "Sign in again before saving.",
          ),
        );
      }
      const response = await fetch("/api/admin/onboarding-profile", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...body, caseId }),
        signal,
      });
      const payload = (await response.json()) as {
        handoffUrl?: string;
        draft?: PreparedProfileDraft;
        error?: string;
      };
      if (!response.ok) {
        throw new OnboardingResponseError(payload?.error || "");
      }
      return payload;
    }, requestScopeRef.current?.signal);
  }

  function updateProfile<K extends keyof PreparedBusinessProfile>(
    key: K,
    value: PreparedBusinessProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
    markEdited();
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
    markEdited();
  }

  async function uploadPreparedImage(
    file: File | null,
    target: { type: "profile" } | { type: "service"; serviceId: string },
  ) {
    if (!file || !canMutate()) return;
    if (!mediaHandoffAvailable) {
      setError(
        t(
          "admin.onboarding.prepared.mediaHandoffUnavailable",
          "Prepared photo handoff is not enabled in this environment yet.",
        ),
      );
      return;
    }
    if (!profileMediaPermission) {
      setError(
        t(
          "admin.onboarding.prepared.mediaPermissionRequired",
          "Record profile-media permission on the onboarding case before uploading photos.",
        ),
      );
      return;
    }

    const imageKey =
      target.type === "profile" ? "profile" : `service:${target.serviceId}`;
    operationRef.current = true;
    const scope = requestScopeRef.current;
    setUploadingImageKey(imageKey);
    setError("");
    setMessage("");
    try {
      const uploaded = await uploadMirebookImage({
        file,
        folder: target.type === "profile" ? "businesses" : "services",
        recordId:
          target.type === "profile"
            ? `onboarding-${caseId}`
            : `onboarding-${caseId}-${target.serviceId}`,
      });
      if (scope?.signal.aborted) return;
      if (target.type === "profile") {
        updateProfile("imageUrl", uploaded.publicUrl);
      } else {
        updateService(target.serviceId, "imageUrl", uploaded.publicUrl);
      }
      setMessage(
        t(
          "admin.onboarding.prepared.mediaUploaded",
          "Photo uploaded. Save the prepared profile to include it in the owner handoff.",
        ),
      );
    } catch {
      if (scope?.signal.aborted) return;
      setError(
        t(
          "admin.onboarding.prepared.mediaUploadError",
          "The prepared photo could not be uploaded.",
        ),
      );
    } finally {
      operationRef.current = false;
      setUploadingImageKey(null);
    }
  }

  async function saveProfile() {
    if (!canMutate()) return;
    operationRef.current = true;
    const scope = requestScopeRef.current;
    setSaving(true);
    clearOutput();
    try {
      const payload = await postProfile({
        action: "save",
        profile,
        services,
      });
      if (scope?.signal.aborted) return;
      if (!payload?.draft) throw new Error("");
      applyDraft(payload.draft);
      setMessage(
        t(
          "admin.onboarding.prepared.saved",
          "Prepared profile saved privately.",
        ),
      );
    } catch (error) {
      if (!scope?.signal.aborted) {
        setSaved(false);
        setError(
          (error instanceof OnboardingResponseError && error.message) ||
            t(
              "admin.onboarding.prepared.saveError",
              "The prepared profile could not be saved.",
            ),
        );
      }
    } finally {
      operationRef.current = false;
      setSaving(false);
    }
  }

  async function issueHandoff() {
    if (!canMutate() || !saved || !EMAIL_PATTERN.test(ownerEmail)) return;
    operationRef.current = true;
    const scope = requestScopeRef.current;
    setIssuing(true);
    clearOutput();
    // A lost response may still have replaced the previous token on the server.
    setHandoffUncertain(true);
    try {
      const payload = await postProfile({ action: "issue", ownerEmail });
      if (scope?.signal.aborted) return;
      if (
        !payload?.handoffUrl ||
        !payload.draft?.intendedOwnerEmail ||
        !payload.draft.handoffIssuedAt ||
        !payload.draft.handoffExpiresAt
      ) {
        throw new Error("");
      }
      applyDraft(payload.draft);
      setOwnerEmail(payload.draft.intendedOwnerEmail);
      setHandoffUrl(payload.handoffUrl);
      setMessage(
        t(
          "admin.onboarding.prepared.linkReady",
          "Secure owner link created. Copy it now.",
        ),
      );
    } catch (error) {
      if (!scope?.signal.aborted) {
        setError(
          (error instanceof OnboardingResponseError && error.message) ||
            t(
              "admin.onboarding.prepared.linkError",
              "The secure link could not be created.",
            ),
        );
      }
    } finally {
      operationRef.current = false;
      setIssuing(false);
    }
  }

  async function copyLink() {
    if (!canShare || copyingRef.current) return;
    copyingRef.current = true;
    const version = outputVersionRef.current;
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(handoffUrl);
      if (
        version !== outputVersionRef.current ||
        requestScopeRef.current?.signal.aborted
      )
        return;
      setMessage(
        t("admin.onboarding.prepared.linkCopied", "Owner link copied."),
      );
    } catch {
      if (
        version !== outputVersionRef.current ||
        requestScopeRef.current?.signal.aborted
      )
        return;
      linkRef.current?.focus();
      linkRef.current?.select();
      setError(
        t(
          "admin.onboarding.prepared.copyManual",
          "Automatic copying was unavailable. Select and copy the text manually.",
        ),
      );
    } finally {
      copyingRef.current = false;
    }
  }

  const ownerMessage = handoffUrl
    ? interpolate(
        translate(
          preferredLanguage,
          "admin.onboarding.prepared.ownerMessageTemplate",
          "Hello! Your private Mirëbook profile for {businessName} is ready to review. Open this secure link, then create or sign in to Mirëbook Business with {ownerEmail}: {handoffUrl}\n\nYour profile and services stay hidden until you review them and choose to publish. Mirëbook will never ask for your password.",
        ),
        {
          businessName: profile.name || prospectName,
          ownerEmail: boundOwnerEmail,
          handoffUrl,
        },
      )
    : "";

  async function copyOwnerMessage() {
    if (!canShare || !ownerMessage || copyingRef.current) return;
    copyingRef.current = true;
    const version = outputVersionRef.current;
    setMessage("");
    setError("");
    try {
      await navigator.clipboard.writeText(ownerMessage);
      if (
        version !== outputVersionRef.current ||
        requestScopeRef.current?.signal.aborted
      )
        return;
      setMessage(
        t(
          "admin.onboarding.prepared.ownerMessageCopied",
          "Owner message copied.",
        ),
      );
    } catch {
      if (
        version !== outputVersionRef.current ||
        requestScopeRef.current?.signal.aborted
      )
        return;
      ownerMessageRef.current?.focus();
      ownerMessageRef.current?.select();
      setError(
        t(
          "admin.onboarding.prepared.copyManual",
          "Automatic copying was unavailable. Select and copy the text manually.",
        ),
      );
    } finally {
      copyingRef.current = false;
    }
  }

  const expiresAtTime = handoffExpiresAt
    ? new Date(handoffExpiresAt).getTime()
    : Number.NaN;
  const handoffExpired = Number.isFinite(expiresAtTime)
    ? expiresAtTime <= now
    : false;
  const ownerEmailChanged = Boolean(
    boundOwnerEmail &&
    ownerEmail.trim().toLowerCase() !== boundOwnerEmail.trim().toLowerCase(),
  );
  const canShare = Boolean(
    handoffUrl &&
    saved &&
    !controlsDisabled &&
    !handoffUncertain &&
    !ownerEmailChanged &&
    !handoffExpired &&
    Number.isFinite(expiresAtTime),
  );
  const formattedExpiry = formatHandoffDate(handoffExpiresAt, uiLocale);
  const formattedAdoption = formatHandoffDate(adoptedAt, uiLocale);

  let handoffStatus = t(
    "admin.onboarding.prepared.statusDraft",
    "Save the prepared profile before creating a secure link.",
  );
  if (adoptedBusinessId || adoptedAt) {
    handoffStatus = formattedAdoption
      ? interpolate(
          t(
            "admin.onboarding.prepared.statusConnected",
            "The verified owner connected this profile on {date}.",
          ),
          { date: formattedAdoption },
        )
      : t(
          "admin.onboarding.prepared.statusConnectedNoDate",
          "The verified owner connected this profile.",
        );
  } else if (issuing) {
    handoffStatus = t("admin.onboarding.prepared.issuing", "Creating link...");
  } else if (handoffUncertain) {
    handoffStatus = t(
      "admin.onboarding.prepared.statusUncertain",
      "The latest link status could not be confirmed. Create a new secure link before sharing.",
    );
  } else if (!saved) {
    if (handoffIssuedAt) {
      handoffStatus = t(
        "admin.onboarding.prepared.statusUnsaved",
        "Save your changes before sharing or creating an owner link. A previously issued link still opens the last saved profile.",
      );
    }
  } else if (!EMAIL_PATTERN.test(ownerEmail)) {
    handoffStatus = t(
      "admin.onboarding.prepared.statusEmailNeeded",
      "Add the owner-provided email before creating a secure link.",
    );
  } else if (ownerEmailChanged) {
    handoffStatus = interpolate(
      t(
        "admin.onboarding.prepared.statusEmailChanged",
        "The last link remains bound to {email}. Create a new link to use the edited address.",
      ),
      { email: boundOwnerEmail },
    );
  } else if (handoffExpired) {
    handoffStatus = interpolate(
      t(
        "admin.onboarding.prepared.statusExpired",
        "The last secure link for {email} expired on {expires}. Create a new link before contacting the owner.",
      ),
      { email: boundOwnerEmail || ownerEmail, expires: formattedExpiry },
    );
  } else if (
    handoffIssuedAt &&
    boundOwnerEmail &&
    Number.isFinite(expiresAtTime)
  ) {
    handoffStatus = formattedExpiry
      ? interpolate(
          t(
            "admin.onboarding.prepared.statusIssued",
            "A secure link is active for {email} until {expires}. Create a new link if you need the raw URL again.",
          ),
          {
            email: boundOwnerEmail || ownerEmail,
            expires: formattedExpiry,
          },
        )
      : interpolate(
          t(
            "admin.onboarding.prepared.statusIssuedNoExpiry",
            "A secure link is active for {email}. Create a new link if you need the raw URL again.",
          ),
          { email: boundOwnerEmail || ownerEmail },
        );
  } else if (saved) {
    handoffStatus = t(
      "admin.onboarding.prepared.statusReady",
      "Ready to create an email-bound owner link.",
    );
  }

  if (loading) {
    return (
      <section className="prepared-panel prepared-state" role="status">
        {t("admin.onboarding.prepared.loading", "Loading prepared profile...")}
      </section>
    );
  }

  if (loadFailed) {
    return (
      <section className="prepared-panel prepared-state">
        <p role="alert">{error}</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setLoadAttempt((attempt) => attempt + 1)}
        >
          <RefreshCw aria-hidden="true" />
          {t("common.retry", "Try again")}
        </button>
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

      <fieldset className="profile-grid" disabled={controlsDisabled}>
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
        <section className="prepared-media wide-field">
          <div className="media-copy">
            <span>
              {t(
                "admin.onboarding.prepared.businessPhoto",
                "Prepared business photo",
              )}
            </span>
            <small>
              {profileMediaPermission
                ? mediaHandoffAvailable
                  ? t(
                      "admin.onboarding.prepared.mediaPermissionReady",
                      "Profile-use permission is recorded. This photo remains outside public discovery until the owner publishes.",
                    )
                  : t(
                      "admin.onboarding.prepared.mediaHandoffUnavailable",
                      "Prepared photo handoff is not enabled in this environment yet.",
                    )
                : t(
                    "admin.onboarding.prepared.mediaPermissionMissing",
                    "Record profile-media permission on the private case before adding a photo.",
                  )}
            </small>
          </div>
          {profile.imageUrl && (
            <img
              src={profile.imageUrl}
              alt={profile.name || prospectName}
              className="profile-media-preview"
              decoding="async"
            />
          )}
          <div className="media-actions">
            <input
              id={`prepared-profile-photo-${caseId}`}
              className="visually-hidden-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={
                !profileMediaPermission ||
                !mediaHandoffAvailable ||
                uploadingImageKey === "profile"
              }
              onChange={(event) => {
                void uploadPreparedImage(event.target.files?.[0] || null, {
                  type: "profile",
                });
                event.target.value = "";
              }}
            />
            <label
              htmlFor={`prepared-profile-photo-${caseId}`}
              className={`btn btn-ghost media-picker ${
                !profileMediaPermission ||
                !mediaHandoffAvailable ||
                uploadingImageKey === "profile"
                  ? "disabled"
                  : ""
              }`}
              aria-disabled={
                !profileMediaPermission ||
                !mediaHandoffAvailable ||
                uploadingImageKey === "profile"
              }
            >
              <ImagePlus aria-hidden="true" />
              {uploadingImageKey === "profile"
                ? t("admin.onboarding.prepared.mediaUploading", "Uploading...")
                : profile.imageUrl
                  ? t("admin.onboarding.prepared.replacePhoto", "Replace photo")
                  : t("admin.onboarding.prepared.addPhoto", "Add photo")}
            </label>
            {profile.imageUrl && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => updateProfile("imageUrl", "")}
              >
                <X aria-hidden="true" />
                {t("admin.onboarding.prepared.removePhoto", "Remove photo")}
              </button>
            )}
          </div>
        </section>
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
      </fieldset>

      <fieldset className="prepared-services" disabled={controlsDisabled}>
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
              markEdited();
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
                    markEdited();
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
                <section className="service-media wide-field">
                  <div className="media-copy">
                    <span>
                      {t(
                        "admin.onboarding.prepared.servicePhoto",
                        "Prepared service photo",
                      )}
                    </span>
                    <small>
                      {profileMediaPermission
                        ? mediaHandoffAvailable
                          ? t(
                              "admin.onboarding.prepared.servicePhotoBody",
                              "Optional. It will remain hidden with the service until the owner reviews and activates it.",
                            )
                          : t(
                              "admin.onboarding.prepared.mediaHandoffUnavailable",
                              "Prepared photo handoff is not enabled in this environment yet.",
                            )
                        : t(
                            "admin.onboarding.prepared.mediaPermissionMissing",
                            "Record profile-media permission on the private case before adding a photo.",
                          )}
                    </small>
                  </div>
                  {service.imageUrl && (
                    <img
                      src={service.imageUrl}
                      alt={service.name}
                      className="service-media-preview"
                      loading="lazy"
                      decoding="async"
                    />
                  )}
                  <div className="media-actions">
                    <input
                      id={`prepared-service-photo-${caseId}-${service.id}`}
                      className="visually-hidden-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={
                        !profileMediaPermission ||
                        !mediaHandoffAvailable ||
                        uploadingImageKey === `service:${service.id}`
                      }
                      onChange={(event) => {
                        void uploadPreparedImage(
                          event.target.files?.[0] || null,
                          { type: "service", serviceId: service.id },
                        );
                        event.target.value = "";
                      }}
                    />
                    <label
                      htmlFor={`prepared-service-photo-${caseId}-${service.id}`}
                      className={`btn btn-ghost media-picker ${
                        !profileMediaPermission ||
                        !mediaHandoffAvailable ||
                        uploadingImageKey === `service:${service.id}`
                          ? "disabled"
                          : ""
                      }`}
                      aria-disabled={
                        !profileMediaPermission ||
                        !mediaHandoffAvailable ||
                        uploadingImageKey === `service:${service.id}`
                      }
                    >
                      <ImagePlus aria-hidden="true" />
                      {uploadingImageKey === `service:${service.id}`
                        ? t(
                            "admin.onboarding.prepared.mediaUploading",
                            "Uploading...",
                          )
                        : service.imageUrl
                          ? t(
                              "admin.onboarding.prepared.replacePhoto",
                              "Replace photo",
                            )
                          : t(
                              "admin.onboarding.prepared.addPhoto",
                              "Add photo",
                            )}
                    </label>
                    {service.imageUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() =>
                          updateService(service.id, "imageUrl", "")
                        }
                      >
                        <X aria-hidden="true" />
                        {t(
                          "admin.onboarding.prepared.removePhoto",
                          "Remove photo",
                        )}
                      </button>
                    )}
                  </div>
                </section>
                <label>
                  <span>
                    {t(
                      "admin.onboarding.prepared.durationMinutes",
                      "Duration (minutes)",
                    )}
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
                    {service.bookingType === "group"
                      ? t(
                          "admin.onboarding.prepared.pricePerGuest",
                          "Price per guest",
                        )
                      : t("dashboardServices.create.pricePlaceholder", "Price")}
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
                        "One-at-a-time appointment",
                      )}
                    </option>
                    <option value="group">
                      {t(
                        "admin.onboarding.prepared.group",
                        "Shared departure with seats",
                      )}
                    </option>
                  </select>
                </label>
                <p className="booking-type-guidance">
                  {service.bookingType === "group"
                    ? t(
                        "admin.onboarding.prepared.groupHint",
                        "Use only when different customers share one fixed start time and seat capacity.",
                      )
                    : t(
                        "admin.onboarding.prepared.appointmentHint",
                        "Use for haircuts, consultations and other private time slots.",
                      )}
                </p>
                {service.bookingType === "group" && (
                  <label>
                    <span>
                      {t(
                        "dashboardServices.group.capacity",
                        "Seats on each departure",
                      )}
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
                      <strong>
                        {t(
                          "dashboardServices.group.privateEnabled",
                          "Allow private trip booking",
                        )}
                      </strong>
                      <small>
                        {t(
                          "dashboardServices.group.privateHint",
                          "One customer reserves the whole departure while every seat is still free.",
                        )}
                      </small>
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
      </fieldset>

      <fieldset className="owner-binding" disabled={controlsDisabled}>
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
              clearOutput();
            }}
          />
          <small>
            {t(
              "admin.onboarding.prepared.ownerEmailBody",
              "Only a verified Business account using this exact email can connect the profile.",
            )}
          </small>
        </label>
      </fieldset>

      <section className="handoff-status" aria-live="polite">
        <strong>
          {t("admin.onboarding.prepared.statusTitle", "Owner handoff status")}
        </strong>
        <p>{handoffStatus}</p>
      </section>

      <footer className="prepared-actions">
        <button
          type="button"
          className="btn btn-accent"
          disabled={controlsDisabled}
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
            controlsDisabled ||
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

      {canShare && (
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
          <label className="owner-message-field">
            <span>
              {interpolate(
                t(
                  "admin.onboarding.prepared.ownerMessage",
                  "Ready-to-send owner message ({language})",
                ),
                {
                  language:
                    preferredLanguage === "sq"
                      ? t("language.albanian", "Albanian")
                      : t("language.english", "English"),
                },
              )}
            </span>
            <textarea
              ref={ownerMessageRef}
              readOnly
              rows={7}
              value={ownerMessage}
            />
          </label>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void copyOwnerMessage()}
          >
            <Clipboard aria-hidden="true" />
            {t("admin.onboarding.prepared.copyMessage", "Copy owner message")}
          </button>
        </div>
      )}

      <style jsx>{`
        fieldset {
          min-width: 0;
          margin: 0;
          padding: 0;
          border: 0;
        }
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
        .prepared-media,
        .service-media {
          display: grid;
          gap: 0.75rem;
          padding: 0.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--surface-2);
        }
        .service-media {
          background: var(--surface);
        }
        .media-copy {
          display: grid;
          gap: 0.2rem;
        }
        .media-copy > span {
          font-size: 0.8rem;
          font-weight: 750;
        }
        .media-copy small {
          color: var(--text-muted);
          font-weight: 500;
          line-height: 1.45;
        }
        .profile-media-preview,
        .service-media-preview {
          display: block;
          width: 100%;
          border: 1px solid var(--border);
          border-radius: 6px;
          object-fit: cover;
          background: var(--surface);
        }
        .profile-media-preview {
          max-width: 440px;
          aspect-ratio: 16 / 9;
        }
        .service-media-preview {
          width: 132px;
          aspect-ratio: 4 / 3;
        }
        .media-actions {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }
        .visually-hidden-file {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .media-picker {
          cursor: pointer;
        }
        .media-picker.disabled {
          pointer-events: none;
          opacity: 0.55;
        }
        .media-actions :global(svg) {
          width: 17px;
          height: 17px;
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
        .owner-toggle span,
        .prepared-service-list .confirm-toggle span {
          display: grid;
          gap: 0.2rem;
        }
        .owner-toggle small,
        .prepared-service-list .confirm-toggle small {
          color: var(--text-muted);
          font-weight: 500;
        }
        .estimate-note,
        .booking-type-guidance {
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
        .handoff-status {
          display: grid;
          gap: 0.25rem;
          padding: 0.85rem;
          border: 1px solid var(--border);
          border-radius: 7px;
          background: var(--surface-2);
        }
        .handoff-status strong {
          font-size: 0.8rem;
        }
        .handoff-status p {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.8rem;
          line-height: 1.5;
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
        .handoff-output .owner-message-field {
          flex-basis: 100%;
        }
        .owner-message-field textarea {
          min-height: 9rem;
          resize: vertical;
          font-weight: 500;
          line-height: 1.5;
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
          .handoff-output :global(.btn),
          .media-actions :global(.btn) {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}
