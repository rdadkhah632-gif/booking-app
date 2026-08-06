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
  const fallbackRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStatus("");
  }, [url]);

  useEffect(() => {
    if (status !== "manual") return;
    fallbackRef.current?.focus();
    fallbackRef.current?.select();
  }, [status]);

  async function sharePlace() {
    const text =
      description?.trim() ||
      t(
        "directory.profile.shareText",
        "Take a closer look at this local place on Mirëbook.",
      );

    if (navigator.share) {
      try {
        await navigator.share({ title: name, text, url });
        setStatus("shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }

    try {
      if (!navigator.clipboard) throw new Error("clipboard_unavailable");
      await navigator.clipboard.writeText(url);
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

      {status === "manual" && (
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
