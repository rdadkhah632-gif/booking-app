import { useEffect, useRef, useState } from "react";
import { Check, Share2 } from "lucide-react";
import { useI18n } from "@/lib/useI18n";

type ShareStatus = "" | "shared" | "copied" | "manual";

type PlaceShareActionProps = {
  name: string;
  description?: string | null;
  url: string;
};

export default function PlaceShareAction({
  name,
  description,
  url,
}: PlaceShareActionProps) {
  const { t } = useI18n();
  const [status, setStatus] = useState<ShareStatus>("");
  const [requiresManualCopy, setRequiresManualCopy] = useState(false);
  const fallbackRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStatus("");
  }, [url]);

  useEffect(() => {
    setRequiresManualCopy(
      typeof window.navigator.share !== "function" &&
        typeof window.navigator.clipboard?.writeText !== "function",
    );
  }, []);

  useEffect(() => {
    if (status !== "manual") return;
    const fallback = fallbackRef.current;
    fallback?.focus();
    fallback?.select();
    if (fallback) fallback.scrollLeft = 0;
  }, [status]);

  async function sharePlace() {
    // Keep a usable link visible while browser-native sharing is pending or
    // unavailable. Successful native share/copy replaces this state.
    setStatus("manual");

    const text =
      description?.trim() ||
      t(
        "directory.profile.shareText",
        "Take a closer look at this local place on Mirëbook.",
      );

    if (typeof window.navigator.share === "function") {
      try {
        await window.navigator.share({ title: name, text, url });
        setStatus("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("");
          return;
        }
      }
    }

    if (typeof window.navigator.clipboard?.writeText !== "function") {
      setStatus("manual");
      return;
    }

    try {
      await window.navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus("manual");
    }
  }

  const completed = status === "shared" || status === "copied";

  return (
    <div className="place-share">
      <button type="button" className="btn btn-ghost" onClick={sharePlace}>
        {completed ? (
          <Check size={17} aria-hidden="true" />
        ) : (
          <Share2 size={17} aria-hidden="true" />
        )}
        {status === "shared"
          ? t("directory.profile.shared", "Shared")
          : status === "copied"
            ? t("directory.profile.linkCopied", "Link copied")
            : t("directory.profile.share", "Share")}
      </button>

      <span className="sr-only" role="status" aria-live="polite">
        {status === "shared"
          ? t("directory.profile.sharedStatus", "Place shared.")
          : status === "copied"
            ? t("directory.profile.linkCopiedStatus", "Place link copied.")
            : ""}
      </span>

      {(status === "manual" || requiresManualCopy) && (
        <label className="place-share-fallback">
          <span>
            {t("directory.profile.copyFallback", "Copy this place link")}
          </span>
          <input ref={fallbackRef} readOnly value={url} />
        </label>
      )}

      <style jsx>{`
        .place-share {
          min-width: 0;
          display: contents;
        }

        .place-share :global(.btn) {
          display: inline-flex;
          min-height: 44px;
          align-items: center;
          gap: 0.45rem;
        }

        .place-share-fallback {
          width: 100%;
          display: grid;
          gap: 0.35rem;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 750;
        }

        .place-share-fallback input {
          width: 100%;
          min-height: 44px;
        }
      `}</style>
    </div>
  );
}
