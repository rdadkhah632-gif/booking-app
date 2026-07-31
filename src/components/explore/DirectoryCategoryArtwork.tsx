import {
  Activity,
  BedDouble,
  Bike,
  Building2,
  Dumbbell,
  GraduationCap,
  Landmark,
  Scissors,
  Stethoscope,
  Ticket,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import type { DirectoryCategoryKey } from "./exploreTypes";

type Props = {
  category: DirectoryCategoryKey;
  size?: number;
};

const CATEGORY_ICONS: Record<DirectoryCategoryKey, LucideIcon> = {
  beauty_grooming: Scissors,
  dental_health: Stethoscope,
  wellness_fitness: Dumbbell,
  events: Ticket,
  learning_lessons: GraduationCap,
  tours_activities: Bike,
  rentals: Building2,
  attractions: Landmark,
  food_drink: Utensils,
  lodging: BedDouble,
};

export default function DirectoryCategoryArtwork({
  category,
  size = 34,
}: Props) {
  const CategoryIcon = CATEGORY_ICONS[category] || Activity;

  return (
    <div
      className={`directory-category-artwork is-${category}`}
      aria-hidden="true"
    >
      <span>
        <CategoryIcon size={size} strokeWidth={1.7} />
      </span>

      <style jsx>{`
        .directory-category-artwork {
          --art-color: #2dd4bf;
          --art-surface: rgba(45, 212, 191, 0.13);
          width: 100%;
          height: 100%;
          min-height: inherit;
          display: grid;
          place-items: center;
          color: var(--art-color);
          background: var(--art-surface);
          box-shadow:
            inset 0 -5px 0 color-mix(in srgb, var(--art-color) 42%, transparent),
            inset 0 0 0 1px color-mix(in srgb, var(--art-color) 12%, transparent);
        }

        .directory-category-artwork span {
          display: grid;
          width: 4rem;
          height: 4rem;
          place-items: center;
          border: 1px solid color-mix(in srgb, var(--art-color) 32%, transparent);
          border-radius: 50%;
          background: color-mix(in srgb, var(--surface) 82%, transparent);
          box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.16);
        }

        .is-beauty_grooming {
          --art-color: #fb7185;
          --art-surface: rgba(251, 113, 133, 0.13);
        }

        .is-dental_health {
          --art-color: #2dd4bf;
          --art-surface: rgba(45, 212, 191, 0.13);
        }

        .is-wellness_fitness {
          --art-color: #4ade80;
          --art-surface: rgba(74, 222, 128, 0.12);
        }

        .is-events {
          --art-color: #f472b6;
          --art-surface: rgba(244, 114, 182, 0.12);
        }

        .is-learning_lessons {
          --art-color: #fbbf24;
          --art-surface: rgba(251, 191, 36, 0.12);
        }

        .is-tours_activities {
          --art-color: #60a5fa;
          --art-surface: rgba(96, 165, 250, 0.13);
        }

        .is-rentals {
          --art-color: #22d3ee;
          --art-surface: rgba(34, 211, 238, 0.12);
        }

        .is-attractions {
          --art-color: #f59e0b;
          --art-surface: rgba(245, 158, 11, 0.12);
        }

        .is-food_drink {
          --art-color: #f97316;
          --art-surface: rgba(249, 115, 22, 0.12);
        }

        .is-lodging {
          --art-color: #a78bfa;
          --art-surface: rgba(167, 139, 250, 0.12);
        }
      `}</style>
    </div>
  );
}
