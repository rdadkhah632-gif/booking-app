import { useI18n } from "@/lib/useI18n";

type Props = {
  loading: boolean;
  filteredCount: number;
  hasFilters: boolean;
  onClearFilters: () => void;
};

export default function ExploreResultsHeader({
  loading,
  filteredCount,
  hasFilters,
  onClearFilters,
}: Props) {
  const { t } = useI18n();

  if (!loading && !hasFilters) return null;

  return (
    <div className="explore-results-header">
      <div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {loading
            ? t("explore.results.loading")
            : `${filteredCount} ${t("explore.results.title").toLowerCase()}`}
        </p>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="btn btn-ghost"
        >
          {t("explore.results.clearCurrent")}
        </button>
      )}
    </div>
  );
}
