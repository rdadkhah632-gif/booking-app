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
          {marketplaceStats.visible === 1
            ? t("explore.discovery.oneResult", "1 result")
            : t("explore.discovery.resultCount", "{count} results").replace(
                "{count}",
                String(marketplaceStats.visible),
              )}
        </p>
      )}
      <style jsx>{`
        .explore-hero-compact {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: end;
          margin-bottom: 1.1rem;
        }

        .explore-hero-compact h1,
        .explore-hero-compact p {
          margin-top: 0;
        }

        .explore-hero-compact :global(.page-title) {
          margin-bottom: 0.2rem;
          font-family: var(--font-body);
          font-size: 2.25rem;
          font-weight: 700;
          letter-spacing: 0;
        }

        .explore-hero-compact :global(.page-sub) {
          font-weight: 400;
        }

        @media (max-width: 700px) {
          .explore-hero-compact {
            display: grid;
            gap: 0.35rem;
            margin-bottom: 0.9rem;
          }

          .explore-hero-compact :global(.page-title) {
            font-size: 1.75rem;
          }
        }
      `}</style>
    </header>
  );
}
