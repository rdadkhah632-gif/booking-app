import { useEffect, useRef, useState } from "react";
import type {
  Map as MapboxMap,
  Marker as MapboxMarker,
} from "mapbox-gl";
import { MapPin } from "lucide-react";
import { useI18n } from "@/lib/useI18n";
import { DiscoveryMapItem } from "./exploreTypes";

type Props = {
  items: DiscoveryMapItem[];
  selectedId: string;
  userLocation: { latitude: number; longitude: number } | null;
  onSelect: (itemId: string) => void;
};

const ALBANIA_CENTER: [number, number] = [20.05, 41.15];

export default function ExploreDiscoveryMap({
  items,
  selectedId,
  userLocation,
  onSelect,
}: Props) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRefs = useRef<Array<{ id: string; marker: MapboxMarker }>>([]);
  const userMarkerRef = useRef<MapboxMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || "";

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!containerRef.current || !accessToken || mapRef.current) return;
    let cancelled = false;

    async function startMap() {
      try {
        const mapboxModule = await import("mapbox-gl");
        if (cancelled || !containerRef.current) return;

        const mapboxgl = mapboxModule.default;
        mapboxgl.accessToken = accessToken;
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: ALBANIA_CENTER,
          zoom: 6.35,
          attributionControl: true,
          cooperativeGestures: true,
        });
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          if (!cancelled) setReady(true);
        });
        map.on("error", () => {
          if (!cancelled) setMapError(true);
        });
        mapRef.current = map;
      } catch {
        if (!cancelled) setMapError(true);
      }
    }

    void startMap();
    return () => {
      cancelled = true;
      markerRefs.current.forEach(({ marker }) => marker.remove());
      markerRefs.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    let active = true;

    async function renderMarkers() {
      const mapboxModule = await import("mapbox-gl");
      if (!active || !mapRef.current) return;
      const mapboxgl = mapboxModule.default;

      markerRefs.current.forEach(({ marker }) => marker.remove());
      markerRefs.current = [];

      const bounds = new mapboxgl.LngLatBounds();
      items.slice(0, 200).forEach((item) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = [
          "discovery-map-marker",
          item.resultType === "business" ? "is-business" : "is-directory",
          selectedIdRef.current === item.id ? "is-selected" : "",
        ]
          .filter(Boolean)
          .join(" ");
        element.setAttribute(
          "aria-label",
          `${item.name}, ${item.category}, ${item.locationLabel}`,
        );
        element.addEventListener("click", () => onSelectRef.current(item.id));

        const marker = new mapboxgl.Marker({ element, anchor: "bottom" })
          .setLngLat([item.longitude, item.latitude])
          .addTo(map);
        markerRefs.current.push({ id: item.id, marker });
        bounds.extend([item.longitude, item.latitude]);
      });

      if (userLocation) {
        const userElement = document.createElement("div");
        userElement.className = "discovery-user-marker";
        userElement.setAttribute(
          "aria-label",
          t("explore.map.yourLocation", "Your approximate location"),
        );
        userMarkerRef.current?.remove();
        userMarkerRef.current = new mapboxgl.Marker({
          element: userElement,
          anchor: "center",
        })
          .setLngLat([userLocation.longitude, userLocation.latitude])
          .addTo(map);
        bounds.extend([userLocation.longitude, userLocation.latitude]);
      } else {
        userMarkerRef.current?.remove();
        userMarkerRef.current = null;
      }

      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 56, right: 56, bottom: 56, left: 56 },
          maxZoom: 13,
          duration: 450,
        });
      }
    }

    void renderMarkers();
    return () => {
      active = false;
    };
  }, [items, ready, t, userLocation]);

  useEffect(() => {
    markerRefs.current.forEach(({ id, marker }) => {
      marker.getElement().classList.toggle("is-selected", id === selectedId);
    });

    if (!selectedId) return;
    const selected = items.find((item) => item.id === selectedId);
    if (selected && mapRef.current) {
      mapRef.current.easeTo({
        center: [selected.longitude, selected.latitude],
        duration: 350,
      });
    }
  }, [items, selectedId]);

  if (!accessToken || mapError) {
    return (
      <div className="discovery-map-fallback">
        <MapPin size={26} aria-hidden="true" />
        <strong>{t("explore.map.unavailableTitle", "Map view is unavailable")}</strong>
        <span>
          {t(
            "explore.map.unavailableBody",
            "Use the list and city filters while the map is being prepared.",
          )}
        </span>
        <style jsx>{`
          .discovery-map-fallback {
            min-height: 420px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--surface);
            color: var(--text-muted);
            display: grid;
            place-content: center;
            justify-items: center;
            gap: 0.5rem;
            text-align: center;
            padding: 1.25rem;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="discovery-map-shell">
      <div ref={containerRef} className="discovery-map" aria-label={t("explore.map.label", "Discovery map")} />
      {!ready && (
        <div className="discovery-map-loading">
          {t("explore.map.loading", "Loading map...")}
        </div>
      )}
      {ready && items.length === 0 && (
        <div className="discovery-map-empty" role="status">
          {t(
            "explore.map.empty",
            "No mapped places match these filters yet.",
          )}
        </div>
      )}

      <style jsx>{`
        .discovery-map-shell {
          position: relative;
          min-height: 520px;
          height: min(68vh, 720px);
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface-2);
        }

        .discovery-map {
          position: absolute;
          inset: 0;
        }

        .discovery-map-loading {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: var(--surface);
          color: var(--text-muted);
        }

        .discovery-map-empty {
          position: absolute;
          left: 50%;
          bottom: 1rem;
          width: min(90%, 360px);
          transform: translateX(-50%);
          padding: 0.65rem 0.8rem;
          border: 1px solid rgba(11, 18, 32, 0.12);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 0.4rem 1.2rem rgba(11, 18, 32, 0.14);
          color: #111827;
          font-size: 0.82rem;
          text-align: center;
        }

        :global(.discovery-map-marker) {
          width: 28px;
          height: 28px;
          padding: 0;
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 4px;
          box-shadow: 0 3px 12px rgba(11, 18, 32, 0.3);
          transform: rotate(-45deg);
          cursor: pointer;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        :global(.discovery-map-marker.is-business) {
          background: #ff6b35;
        }

        :global(.discovery-map-marker.is-directory) {
          background: #14b8a6;
        }

        :global(.discovery-map-marker:hover),
        :global(.discovery-map-marker:focus-visible),
        :global(.discovery-map-marker.is-selected) {
          z-index: 3;
          transform: rotate(-45deg) scale(1.2);
          box-shadow: 0 4px 18px rgba(11, 18, 32, 0.42);
          outline: 2px solid rgba(255, 107, 53, 0.4);
          outline-offset: 2px;
        }

        :global(.discovery-user-marker) {
          width: 18px;
          height: 18px;
          border: 4px solid #ffffff;
          border-radius: 50%;
          background: #2563eb;
          box-shadow:
            0 0 0 6px rgba(37, 99, 235, 0.22),
            0 2px 8px rgba(11, 18, 32, 0.35);
        }

        @media (max-width: 700px) {
          .discovery-map-shell {
            min-height: 440px;
            height: 58vh;
            border-radius: 0;
            margin-inline: -24px;
            border-inline: 0;
          }
        }
      `}</style>
    </div>
  );
}
