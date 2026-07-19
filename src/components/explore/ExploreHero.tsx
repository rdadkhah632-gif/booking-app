import { MarketplaceStats } from "./exploreTypes";
import { useI18n } from "@/lib/useI18n";

type Props = {
  marketplaceStats: MarketplaceStats;
};

export default function ExploreHero({ marketplaceStats }: Props) {
  const { t } = useI18n();
  return (
    <header className="explore-hero-compact">
      <div>
        <h1 className="page-title">
          {t("explore.discovery.title", "Explore Albania")}
        </h1>
        <p className="page-sub">
          {t(
            "explore.discovery.subtitle",
            "Find services, activities and places around you.",
          )}
        </p>
      </div>
      {marketplaceStats.visible > 0 && (
        <p className="small muted">
          {marketplaceStats.visible}{" "}
          {t("explore.discovery.resultLabel", "results")}
        </p>
      )}
      <style jsx>{`
        .explore-hero-compact {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: end;
          margin-bottom: 0.85rem;
        }

        .explore-hero-compact h1,
        .explore-hero-compact p {
          margin-top: 0;
        }

        @media (max-width: 700px) {
          .explore-hero-compact {
            display: grid;
            gap: 0.35rem;
            margin-bottom: 0.7rem;
          }
        }
      `}</style>
    </header>
  );
}
