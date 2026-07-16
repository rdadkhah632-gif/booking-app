import Image from "next/image";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useI18n } from "@/lib/useI18n";

type LocationStatus = {
  verificationStatus: "not_configured" | "verified" | "stale" | "needs_review";
  formattedAddress: string | null;
  provider: string | null;
  precision: string | null;
  verifiedAt: string | null;
  updatedAt: string | null;
};

type LocationCandidate = {
  providerPlaceId: string;
  formattedAddress: string;
  precision: string;
};

type Props = {
  businessId: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  refreshKey: number;
};

function fingerprint(...values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim().toLowerCase() || "").join("|");
}

export default function BusinessLocationVerification({
  businessId,
  address,
  city,
  country,
  refreshKey,
}: Props) {
  const { t } = useI18n();
  const addressFingerprint = fingerprint(address, city, country);
  const [savedFingerprint, setSavedFingerprint] = useState(addressFingerprint);
  const [status, setStatus] = useState<LocationStatus | null>(null);
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [finding, setFinding] = useState(false);
  const [previewingMap, setPreviewingMap] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [mapImageDataUrl, setMapImageDataUrl] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [success, setSuccess] = useState(false);

  const hasCompleteAddress = Boolean(
    address?.trim() && city?.trim() && country?.trim(),
  );
  const hasUnsavedAddressChanges = addressFingerprint !== savedFingerprint;

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      setLoadingStatus(true);
      setStatus(null);
      setErrorCode("");
      setSuccess(false);
      setCandidates([]);
      setSelectedPlaceId("");
      setMapImageDataUrl("");
      setSavedFingerprint(addressFingerprint);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;
      if (!session) {
        setErrorCode("auth_required");
        setLoadingStatus(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/dashboard/business-location?businessId=${encodeURIComponent(businessId)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        const payload = await response.json();

        if (!active) return;
        if (!response.ok) {
          setErrorCode(payload.code || "status_unavailable");
          return;
        }

        setStatus(payload.location as LocationStatus);
      } catch {
        if (active) setErrorCode("status_unavailable");
      } finally {
        if (active) setLoadingStatus(false);
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, [businessId, refreshKey]);

  useEffect(() => {
    setCandidates([]);
    setSelectedPlaceId("");
    setMapImageDataUrl("");
    setSuccess(false);
  }, [addressFingerprint]);

  function errorMessage(code: string) {
    if (code === "address_incomplete") {
      return t(
        "dashboardBusinesses.location.error.addressIncomplete",
        "Add and save an address, city and country first.",
      );
    }
    if (code === "location_not_found") {
      return t(
        "dashboardBusinesses.location.error.notFound",
        "No matching map location was found. Check the saved address and try again.",
      );
    }
    if (code === "geocoding_not_configured") {
      return t(
        "dashboardBusinesses.location.error.notConfigured",
        "Map verification is not available yet. Contact Mirëbook support.",
      );
    }
    if (code === "candidate_changed") {
      return t(
        "dashboardBusinesses.location.error.changed",
        "The address results changed. Search again and choose the correct location.",
      );
    }
    if (code === "candidate_required") {
      return t(
        "dashboardBusinesses.location.error.choose",
        "Choose a location before confirming.",
      );
    }
    if (code === "auth_required" || code === "invalid_session") {
      return t(
        "dashboardBusinesses.location.error.session",
        "Sign in again to verify this location.",
      );
    }
    return t(
      "dashboardBusinesses.location.error.unavailable",
      "The map location could not be verified. Try again shortly.",
    );
  }

  function precisionLabel(precision?: string | null) {
    if (precision === "exact") {
      return t("dashboardBusinesses.location.precision.exact", "Exact address");
    }
    if (precision === "street") {
      return t("dashboardBusinesses.location.precision.street", "Street level");
    }
    if (precision === "postcode") {
      return t(
        "dashboardBusinesses.location.precision.postcode",
        "Postcode area",
      );
    }
    if (precision === "city") {
      return t("dashboardBusinesses.location.precision.city", "City area");
    }
    return t(
      "dashboardBusinesses.location.precision.approximate",
      "Approximate",
    );
  }

  async function locationRequest(body: Record<string, string>) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("auth_required");

    const response = await fetch("/api/dashboard/business-location", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ businessId, ...body }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.code || "unavailable");
    return payload;
  }

  async function findLocation() {
    if (!hasCompleteAddress) {
      setErrorCode("address_incomplete");
      return;
    }
    if (hasUnsavedAddressChanges) {
      setErrorCode("unsaved_address");
      return;
    }

    setFinding(true);
    setErrorCode("");
    setSuccess(false);

    try {
      const payload = await locationRequest({ action: "preview" });
      const nextCandidates = payload.candidates as LocationCandidate[];
      setCandidates(nextCandidates);
      setSelectedPlaceId(nextCandidates[0]?.providerPlaceId || "");
      setMapImageDataUrl("");
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "unavailable");
    } finally {
      setFinding(false);
    }
  }

  async function previewMap() {
    if (!selectedPlaceId) {
      setErrorCode("candidate_required");
      return;
    }

    setPreviewingMap(true);
    setErrorCode("");
    setSuccess(false);

    try {
      const payload = await locationRequest({
        action: "map_preview",
        providerPlaceId: selectedPlaceId,
      });
      setMapImageDataUrl(payload.mapImageDataUrl as string);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "unavailable");
    } finally {
      setPreviewingMap(false);
    }
  }

  async function confirmLocation() {
    if (!selectedPlaceId) {
      setErrorCode("candidate_required");
      return;
    }

    setConfirming(true);
    setErrorCode("");
    setSuccess(false);

    try {
      const payload = await locationRequest({
        action: "confirm",
        providerPlaceId: selectedPlaceId,
      });
      setStatus(payload.location as LocationStatus);
      setCandidates([]);
      setSelectedPlaceId("");
      setMapImageDataUrl("");
      setSuccess(true);
    } catch (error) {
      setErrorCode(error instanceof Error ? error.message : "unavailable");
    } finally {
      setConfirming(false);
    }
  }

  const statusLabel = hasUnsavedAddressChanges
    ? t("dashboardBusinesses.location.status.unsaved", "Save address changes")
    : status?.verificationStatus === "verified"
      ? t("dashboardBusinesses.location.status.verified", "Verified")
      : status?.verificationStatus === "stale"
        ? t("dashboardBusinesses.location.status.stale", "Verify again")
        : t("dashboardBusinesses.location.status.pending", "Not verified");
  const statusTone =
    !hasUnsavedAddressChanges && status?.verificationStatus === "verified"
      ? "verified"
      : "pending";

  return (
    <section
      className="location-verification"
      aria-labelledby={`location-${businessId}`}
    >
      <div className="location-heading">
        <div>
          <h4 id={`location-${businessId}`}>
            {t("dashboardBusinesses.location.title", "Map location")}
          </h4>
          <p className="small muted">
            {t(
              "dashboardBusinesses.location.body",
              "Confirm where customers should find this business.",
            )}
          </p>
        </div>
        {!loadingStatus && (
          <span className={`location-status ${statusTone}`}>{statusLabel}</span>
        )}
      </div>

      {loadingStatus ? (
        <p className="small muted">
          {t(
            "dashboardBusinesses.location.loading",
            "Checking map location...",
          )}
        </p>
      ) : (
        <>
          {!hasCompleteAddress && (
            <p className="small muted">
              {t(
                "dashboardBusinesses.location.missingAddress",
                "Add and save an address, city and country first.",
              )}
            </p>
          )}

          {hasUnsavedAddressChanges && (
            <p className="small location-note">
              {t(
                "dashboardBusinesses.location.unsavedAddress",
                "Save the profile before checking the updated address.",
              )}
            </p>
          )}

          {!hasUnsavedAddressChanges &&
            status?.verificationStatus === "verified" && (
              <div className="verified-location">
                <strong>{status.formattedAddress}</strong>
                <span className="small muted">
                  {precisionLabel(status.precision)}
                </span>
              </div>
            )}

          {!hasUnsavedAddressChanges &&
            status?.verificationStatus === "stale" && (
              <p className="small location-note">
                {t(
                  "dashboardBusinesses.location.staleBody",
                  "The saved address changed. Verify its map location again.",
                )}
              </p>
            )}

          {candidates.length > 0 && (
            <fieldset className="location-candidates">
              <legend>
                {t(
                  "dashboardBusinesses.location.chooseTitle",
                  "Choose the correct location",
                )}
              </legend>
              {candidates.map((candidate) => (
                <label
                  className="location-candidate"
                  key={candidate.providerPlaceId}
                >
                  <input
                    type="radio"
                    name={`business-location-${businessId}`}
                    value={candidate.providerPlaceId}
                    checked={selectedPlaceId === candidate.providerPlaceId}
                    onChange={() => {
                      setSelectedPlaceId(candidate.providerPlaceId);
                      setMapImageDataUrl("");
                    }}
                  />
                  <span>
                    <strong>{candidate.formattedAddress}</strong>
                    <small>{precisionLabel(candidate.precision)}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {mapImageDataUrl && (
            <div className="location-map-preview">
              <Image
                src={mapImageDataUrl}
                alt={t(
                  "dashboardBusinesses.location.mapPreviewAlt",
                  "Map preview of the selected business location",
                )}
                width={640}
                height={240}
                sizes="(max-width: 640px) calc(100vw - 64px), 640px"
                unoptimized
              />
            </div>
          )}

          {errorCode && (
            <p className="small location-error" role="alert">
              {errorCode === "unsaved_address"
                ? t(
                    "dashboardBusinesses.location.error.unsaved",
                    "Save the profile before verifying this address.",
                  )
                : errorMessage(errorCode)}
            </p>
          )}

          {success && (
            <p className="small location-success" role="status">
              {t(
                "dashboardBusinesses.location.success",
                "Map location confirmed.",
              )}
            </p>
          )}

          <div className="location-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={findLocation}
              disabled={
                finding ||
                previewingMap ||
                confirming ||
                !hasCompleteAddress ||
                hasUnsavedAddressChanges
              }
            >
              {finding
                ? t(
                    "dashboardBusinesses.location.finding",
                    "Finding location...",
                  )
                : status?.verificationStatus === "verified"
                  ? t(
                      "dashboardBusinesses.location.findAgain",
                      "Check another match",
                    )
                  : t("dashboardBusinesses.location.find", "Find location")}
            </button>
            {candidates.length > 0 && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={previewMap}
                  disabled={previewingMap || confirming || !selectedPlaceId}
                >
                  {previewingMap
                    ? t(
                        "dashboardBusinesses.location.previewingMap",
                        "Loading map...",
                      )
                    : t(
                        "dashboardBusinesses.location.previewMap",
                        "Preview map",
                      )}
                </button>
                <button
                  type="button"
                  className="btn btn-accent"
                  onClick={confirmLocation}
                  disabled={previewingMap || confirming || !selectedPlaceId}
                >
                  {confirming
                    ? t(
                        "dashboardBusinesses.location.confirming",
                        "Confirming...",
                      )
                    : t(
                        "dashboardBusinesses.location.confirm",
                        "Confirm location",
                      )}
                </button>
              </>
            )}
          </div>
        </>
      )}

      <style jsx>{`
        .location-verification {
          display: grid;
          gap: 0.75rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }

        .location-heading,
        .location-actions,
        .verified-location {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .location-heading h4,
        .location-heading p {
          margin: 0;
        }

        .location-heading p {
          margin-top: 0.25rem;
        }

        .location-status {
          padding: 0.28rem 0.6rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
        }

        .location-status.verified {
          color: var(--success);
          background: rgba(45, 212, 191, 0.12);
        }

        .location-status.pending {
          color: var(--warning);
          background: rgba(255, 190, 11, 0.12);
        }

        .verified-location {
          justify-content: flex-start;
          padding: 0.7rem 0.8rem;
          border: 1px solid rgba(45, 212, 191, 0.25);
          border-radius: 8px;
          background: rgba(45, 212, 191, 0.05);
        }

        .location-candidates {
          display: grid;
          gap: 0.5rem;
          margin: 0;
          padding: 0;
          border: 0;
        }

        .location-candidates legend {
          margin-bottom: 0.5rem;
          font-size: 0.85rem;
          font-weight: 700;
        }

        .location-candidate {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.65rem;
          align-items: start;
          padding: 0.7rem 0.8rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          cursor: pointer;
        }

        .location-candidate input {
          margin-top: 0.2rem;
        }

        .location-candidate span,
        .location-candidate small {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
        }

        .location-candidate strong {
          overflow-wrap: anywhere;
        }

        .location-candidate small {
          color: var(--text-muted);
        }

        .location-map-preview {
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .location-map-preview :global(img) {
          display: block;
          width: 100%;
          height: auto;
        }

        .location-note {
          color: var(--warning);
        }

        .location-error {
          color: var(--danger);
        }

        .location-success {
          color: var(--success);
        }

        .location-actions {
          justify-content: flex-start;
        }

        @media (max-width: 640px) {
          .location-actions,
          .location-actions :global(.btn) {
            width: 100%;
          }

          .location-actions :global(.btn) {
            justify-content: center;
          }
        }
      `}</style>
    </section>
  );
}
