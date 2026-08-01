import { useI18n } from "@/lib/useI18n";

type Props = {
  loading: boolean;
  filteredCount: number;
  hasFilters: boolean;
};

export default function ExploreResultsHeader({
  loading,
  filteredCount,
  hasFilters,
}: Props) {
  const { t } = useI18n();

  if (!loading && !hasFilters) return null;

  return (
    <div className="explore-results-header">
      <div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {loading
            ? t("explore.results.loading")
            : filteredCount === 1
              ? t("explore.discovery.oneResult", "1 result")
              : t("explore.discovery.resultCount", "{count} results").replace(
                  "{count}",
                  String(filteredCount),
                )}
        </p>
      </div>
    </div>
  );
}
