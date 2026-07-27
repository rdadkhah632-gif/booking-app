import { useEffect, useMemo, useRef, useState } from "react";
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
const MARKER_COLLISION_DISTANCE = 38;

type DiscoveryMarker = {
  id: string;
  marker: MapboxMarker;
  button: HTMLButtonElement;
  longitude: number;
  latitude: number;
};

function spreadOverlappingMarkers(
  map: MapboxMap,
  markers: DiscoveryMarker[],
) {
  const projected = markers.map((entry) => ({
    entry,
    point: map.project([entry.longitude, entry.latitude]),
  }));
  const grouped = new Set<number>();

  projected.forEach((current, startIndex) => {
    if (grouped.has(startIndex)) return;

    const group = [startIndex];
    grouped.add(startIndex);

    for (let cursor = 0; cursor < group.length; cursor += 1) {
      const currentIndex = group[cursor];
      const currentPoint = projected[currentIndex].point;

      projected.forEach((candidate, candidateIndex) => {
        if (grouped.has(candidateIndex)) return;
        const distance = Math.hypot(
          candidate.point.x - currentPoint.x,
          candidate.point.y - currentPoint.y,
        );
        if (distance <= MARKER_COLLISION_DISTANCE) {
          grouped.add(candidateIndex);
          group.push(candidateIndex);
        }
      });
    }

    if (group.length === 1) {
      current.entry.marker.setOffset([0, 0]);
      return;
    }

    const radius = Math.min(52, 22 + group.length * 4);
    group.forEach((markerIndex, index) => {
      const angle = (Math.PI * 2 * index) / group.length - Math.PI / 2;
      projected[markerIndex].entry.marker.setOffset([
        Math.round(Math.cos(angle) * radius),
        Math.round(Math.sin(angle) * radius),
      ]);
    });
  });
}

export default function ExploreDiscoveryMap({
  items,
  selectedId,
  userLocation,
  onSelect,
}: Props) {
  const { locale, t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRefs = useRef<DiscoveryMarker[]>([]);
  const userMarkerRef = useRef<MapboxMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || "";
  const mapLocale = useMemo(
    () => ({
      "AttributionControl.ToggleAttribution": t(
        "explore.map.control.toggleAttribution",
        "Toggle attribution",
      ),
      "FullscreenControl.Enter": t(
        "explore.map.control.enterFullscreen",
        "Enter fullscreen",
      ),
      "FullscreenControl.Exit": t(
        "explore.map.control.exitFullscreen",
        "Exit fullscreen",
      ),
      "GeolocateControl.FindMyLocation": t(
        "explore.map.control.findLocation",
        "Find my location",
      ),
      "GeolocateControl.LocationNotAvailable": t(
        "explore.map.control.locationUnavailable",
        "Location not available",
      ),
      "LogoControl.Title": t(
        "explore.map.control.mapboxHomepage",
        "Mapbox homepage",
      ),
      "Map.Title": t("explore.map.control.mapTitle", "Map"),
      "NavigationControl.ResetBearing": t(
        "explore.map.control.resetBearing",
        "Reset bearing to north",
      ),
      "NavigationControl.ZoomIn": t(
        "explore.map.control.zoomIn",
        "Zoom in",
      ),
      "NavigationControl.ZoomOut": t(
        "explore.map.control.zoomOut",
        "Zoom out",
      ),
      "ScrollZoomBlocker.CtrlMessage": t(
        "explore.map.control.ctrlZoom",
        "Use ctrl + scroll to zoom the map",
      ),
      "ScrollZoomBlocker.CmdMessage": t(
        "explore.map.control.commandZoom",
        "Use ⌘ + scroll to zoom the map",
      ),
      "TouchPanBlocker.Message": t(
        "explore.map.control.touchPan",
        "Use two fingers to move the map",
      ),
    }),
    [t],
  );

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!containerRef.current || !accessToken || mapRef.current) return;
    let cancelled = false;
    setReady(false);
    setMapError(false);

    async function startMap() {
      try {
        const mapboxModule = await import("mapbox-gl");
        if (cancelled || !containerRef.current) return;

        const mapboxgl = mapboxModule.default;
        mapboxgl.accessToken = accessToken;
        containerRef.current.replaceChildren();
        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center: ALBANIA_CENTER,
          zoom: 6.35,
          attributionControl: true,
          cooperativeGestures: true,
          language: locale === "sq" ? "sq" : "en",
          locale: mapLocale,
        });
        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: false }),
          "top-right",
        );
        const updateMarkerOffsets = () =>
          spreadOverlappingMarkers(map, markerRefs.current);
        const localizeProviderLinks = () => {
          const improveMapLink =
            containerRef.current?.querySelector<HTMLAnchorElement>(
              ".mapbox-improve-map",
            );
          if (improveMapLink) {
            improveMapLink.textContent = t(
              "explore.map.control.improveMap",
              "Improve this map",
            );
          }
        };
        map.on("moveend", updateMarkerOffsets);
        map.on("resize", updateMarkerOffsets);
        map.on("styledata", localizeProviderLinks);
        map.on("load", () => {
          if (!cancelled) {
            localizeProviderLinks();
            setReady(true);
          }
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
      containerRef.current?.replaceChildren();
    };
  }, [accessToken, locale, mapLocale]);

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
        const markerElement = document.createElement("div");
        markerElement.className = [
          "discovery-map-marker-shell",
          item.resultType === "business" ? "is-business" : "is-directory",
          selectedIdRef.current === item.id ? "is-selected" : "",
        ]
          .filter(Boolean)
          .join(" ");
        markerElement.dataset.markerId = item.id;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "discovery-map-marker-button";
        button.dataset.markerId = item.id;
        button.setAttribute(
          "aria-label",
          `${item.name}, ${item.category}, ${item.locationLabel}`,
        );
        button.setAttribute(
          "aria-pressed",
          String(selectedIdRef.current === item.id),
        );
        const pin = document.createElement("span");
        pin.className = "discovery-map-marker-pin";
        pin.setAttribute("aria-hidden", "true");
        button.append(pin);
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          onSelectRef.current(item.id);
        });
        markerElement.append(button);

        const marker = new mapboxgl.Marker({
          element: markerElement,
          anchor: "bottom",
        })
          .setLngLat([item.longitude, item.latitude])
          .addTo(map);
        markerElement.setAttribute("role", "presentation");
        markerElement.removeAttribute("aria-label");
        markerRefs.current.push({
          id: item.id,
          marker,
          button,
          longitude: item.longitude,
          latitude: item.latitude,
        });
        bounds.extend([item.longitude, item.latitude]);
      });
      spreadOverlappingMarkers(map, markerRefs.current);

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
    markerRefs.current.forEach(({ id, marker, button }) => {
      marker.getElement().classList.toggle("is-selected", id === selectedId);
      button.setAttribute("aria-pressed", String(id === selectedId));
    });
  }, [selectedId]);

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

        :global(.discovery-map-marker-shell) {
          width: 44px;
          height: 44px;
          z-index: 1;
        }

        :global(.discovery-map-marker-button) {
          position: relative;
          width: 44px;
          height: 44px;
          min-height: 44px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          cursor: pointer;
        }

        :global(.discovery-map-marker-pin) {
          position: absolute;
          top: 10px;
          left: 8px;
          width: 28px;
          height: 28px;
          border: 3px solid #ffffff;
          border-radius: 50% 50% 50% 4px;
          box-shadow: 0 3px 12px rgba(11, 18, 32, 0.3);
          transform: rotate(-45deg);
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        :global(.discovery-map-marker-shell.is-business .discovery-map-marker-pin) {
          background: #ff6b35;
        }

        :global(.discovery-map-marker-shell.is-directory .discovery-map-marker-pin) {
          background: #14b8a6;
        }

        :global(.discovery-map-marker-shell:hover),
        :global(.discovery-map-marker-shell:focus-within),
        :global(.discovery-map-marker-shell.is-selected) {
          z-index: 3;
        }

        :global(.discovery-map-marker-shell:hover .discovery-map-marker-pin),
        :global(.discovery-map-marker-shell:focus-within .discovery-map-marker-pin),
        :global(.discovery-map-marker-shell.is-selected .discovery-map-marker-pin) {
          transform: rotate(-45deg) scale(1.2);
          box-shadow: 0 4px 18px rgba(11, 18, 32, 0.42);
        }

        :global(.discovery-map-marker-button:focus-visible) {
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
