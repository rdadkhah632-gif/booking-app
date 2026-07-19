import { DirectoryCategoryKey } from "./exploreTypes";

export const DIRECTORY_CATEGORIES: DirectoryCategoryKey[] = [
  "beauty_grooming",
  "dental_health",
  "wellness_fitness",
  "events",
  "learning_lessons",
  "tours_activities",
  "rentals",
  "attractions",
  "food_drink",
  "lodging",
];

const CATEGORY_ALIASES: Record<DirectoryCategoryKey, string[]> = {
  beauty_grooming: ["beauty and grooming", "bukuri dhe kujdes personal"],
  dental_health: ["dental health", "shëndet dentar", "shendet dentar"],
  wellness_fitness: [
    "wellness and fitness",
    "mirëqenie dhe palestër",
    "mireqenie dhe palester",
  ],
  events: ["events", "evente"],
  learning_lessons: ["learning and lessons", "mësim dhe kurse", "mesim dhe kurse"],
  tours_activities: ["tours and activities", "ture dhe aktivitete"],
  rentals: ["rentals", "shërbime me qira", "sherbime me qira"],
  attractions: ["attractions", "atraksione"],
  food_drink: ["food and drink", "ushqim dhe pije"],
  lodging: ["accommodation", "akomodim"],
};

const BUSINESS_CATEGORY_KEYWORDS: Record<DirectoryCategoryKey, string[]> = {
  beauty_grooming: [
    "barber",
    "hair",
    "nail",
    "beauty",
    "grooming",
    "tattoo",
    "salon",
  ],
  dental_health: ["dental", "dentist", "clinic", "medical", "health"],
  wellness_fitness: [
    "fitness",
    "gym",
    "wellness",
    "physio",
    "yoga",
    "pilates",
    "massage",
  ],
  events: ["event", "venue", "party", "wedding"],
  learning_lessons: [
    "lesson",
    "class",
    "course",
    "school",
    "language",
    "tutor",
    "training",
  ],
  tours_activities: ["tour", "activity", "experience", "guide", "excursion"],
  rentals: ["rental", "hire", "jet ski", "bike", "boat", "car"],
  attractions: ["attraction", "museum", "landmark", "park", "gallery"],
  food_drink: ["restaurant", "cafe", "coffee", "food", "drink", "bar"],
  lodging: [
    "hotel",
    "hostel",
    "accommodation",
    "guesthouse",
    "apartment",
    "resort",
  ],
};

export function businessMatchesDirectoryCategory(
  value: string | null | undefined,
  category: DirectoryCategoryKey,
) {
  const normalized = (value || "").trim().toLocaleLowerCase();
  return BUSINESS_CATEGORY_KEYWORDS[category].some((keyword) =>
    normalized.includes(keyword),
  );
}

export function directoryCategoryLabel(
  category: DirectoryCategoryKey,
  t: (key: string, fallback?: string) => string,
) {
  const fallbacks: Record<DirectoryCategoryKey, string> = {
    beauty_grooming: "Beauty and grooming",
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
  return t(`directory.category.${category}`, fallbacks[category]);
}

export function directoryCategoryFromLabel(
  value: string,
  t: (key: string, fallback?: string) => string,
) {
  const normalized = value.trim().toLocaleLowerCase();
  return (
    DIRECTORY_CATEGORIES.find(
      (category) =>
        category.toLocaleLowerCase() === normalized ||
        directoryCategoryLabel(category, t).toLocaleLowerCase() === normalized ||
        CATEGORY_ALIASES[category].includes(normalized),
    ) || null
  );
}
