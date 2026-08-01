import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Map as MapboxMap, Marker as MapboxMarker } from "mapbox-gl";
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
const MARKER_CLUSTER_DISTANCE = 52;
const MARKER_EXPANDED_SPACING = 52;
const MARKER_EDGE_PADDING = 28;

type DiscoveryMarker = {
  id: string;
  marker: MapboxMarker;
  button: HTMLButtonElement;
  clusterCount: HTMLSpanElement;
  label: string;
  longitude: number;
  latitude: number;
};

function markerClusterKey(markers: DiscoveryMarker[]) {
  return markers
    .map(({ id }) => id)
    .sort()
    .join("|");
}

function layoutMapMarkers(
  map: MapboxMap,
  markers: DiscoveryMarker[],
  selectedId: string,
  expandedClusterKey: string,
  getClusterLabel: (count: number) => string,
) {
  const projected = markers.map((entry) => ({
    entry,
    point: map.project([entry.longitude, entry.latitude]),
  }));
  const container = map.getContainer();
  const grouped = new Set<number>();
  const groups: (typeof projected)[] = [];

  markers.forEach((entry) => {
    const element = entry.marker.getElement();
    element.style.display = "";
    element.classList.remove("is-cluster");
    element.classList.toggle("is-selected", entry.id === selectedId);
    entry.marker.setOffset([0, 0]);
    entry.button.dataset.clusterIds = "";
    entry.button.setAttribute("aria-label", entry.label);
    entry.button.setAttribute("aria-pressed", String(entry.id === selectedId));
    entry.clusterCount.textContent = "";
  });

  projected.forEach((current, startIndex) => {
    if (grouped.has(startIndex)) return;
    const group = [current];
    const queue = [startIndex];
    grouped.add(startIndex);

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const currentIndex = queue[cursor];
      const currentPoint = projected[currentIndex].point;

      projected.forEach((candidate, candidateIndex) => {
        if (grouped.has(candidateIndex)) return;
        if (
          Math.abs(candidate.point.x - currentPoint.x) <
            MARKER_CLUSTER_DISTANCE &&
          Math.abs(candidate.point.y - currentPoint.y) < MARKER_CLUSTER_DISTANCE
        ) {
          grouped.add(candidateIndex);
          queue.push(candidateIndex);
          group.push(candidate);
        }
      });
    }

    groups.push(group);
  });

  groups.forEach((group) => {
    if (group.length === 1) return;

    const entries = group.map(({ entry }) => entry);
    const clusterKey = markerClusterKey(entries);
    const center = {
      x: group.reduce((total, { point }) => total + point.x, 0) / group.length,
      y: group.reduce((total, { point }) => total + point.y, 0) / group.length,
    };

    if (clusterKey === expandedClusterKey) {
      const ordered = [...group].sort((left, right) =>
        left.entry.id.localeCompare(right.entry.id),
      );
      const columns = Math.ceil(Math.sqrt(ordered.length));
      const rows = Math.ceil(ordered.length / columns);
      const halfWidth = ((columns - 1) * MARKER_EXPANDED_SPACING) / 2;
      const halfHeight = ((rows - 1) * MARKER_EXPANDED_SPACING) / 2;
      const centerX = Math.min(
        container.clientWidth - MARKER_EDGE_PADDING - halfWidth,
        Math.max(MARKER_EDGE_PADDING + halfWidth, center.x),
      );
      const centerY = Math.min(
        container.clientHeight - MARKER_EDGE_PADDING - halfHeight,
        Math.max(MARKER_EDGE_PADDING + halfHeight, center.y),
      );

      ordered.forEach(({ entry, point }, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const targetX =
          centerX + (column - (columns - 1) / 2) * MARKER_EXPANDED_SPACING;
        const targetY =
          centerY + (row - (rows - 1) / 2) * MARKER_EXPANDED_SPACING;
        entry.marker.setOffset([
          Math.round(targetX - point.x),
          Math.round(targetY - point.y),
        ]);
      });
      return;
    }

    const representative =
      group.find(({ entry }) => entry.id === selectedId) ||
      [...group].sort(
        (left, right) =>
          Math.hypot(left.point.x - center.x, left.point.y - center.y) -
            Math.hypot(right.point.x - center.x, right.point.y - center.y) ||
          left.entry.id.localeCompare(right.entry.id),
      )[0];
    const containsSelection = entries.some(({ id }) => id === selectedId);
    const representativeElement = representative.entry.marker.getElement();
    representativeElement.classList.add("is-cluster");
    representativeElement.classList.toggle("is-selected", containsSelection);
    representative.entry.marker.setOffset([
      Math.round(center.x - representative.point.x),
      Math.round(center.y - representative.point.y),
    ]);
    representative.entry.button.dataset.clusterIds = clusterKey;
    representative.entry.button.setAttribute(
      "aria-label",
      getClusterLabel(group.length),
    );
    representative.entry.button.setAttribute(
      "aria-pressed",
      String(containsSelection),
    );
    representative.entry.clusterCount.textContent = String(group.length);

    group.forEach(({ entry }) => {
      if (entry.id !== representative.entry.id) {
        entry.marker.getElement().style.display = "none";
      }
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
  const expandedClusterKeyRef = useRef("");
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || "";
  const clusterLabelTemplate = t(
    "explore.map.clusterLabel",
    "{count} nearby places. Activate to separate them.",
  );
  const getClusterLabel = useCallback(
    (count: number) => clusterLabelTemplate.replace("{count}", String(count)),
    [clusterLabelTemplate],
  );
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
      "NavigationControl.ZoomIn": t("explore.map.control.zoomIn", "Zoom in"),
      "NavigationControl.ZoomOut": t("explore.map.control.zoomOut", "Zoom out"),
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
          style: "mapbox://styles/mapbox/light-v11",
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
          layoutMapMarkers(
            map,
            markerRefs.current,
            selectedIdRef.current,
            expandedClusterKeyRef.current,
            getClusterLabel,
          );
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
      expandedClusterKeyRef.current = "";
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      containerRef.current?.replaceChildren();
    };
  }, [accessToken, getClusterLabel, locale, mapLocale, t]);

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
      expandedClusterKeyRef.current = "";

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
        const markerLabel = `${item.name}, ${item.category}, ${item.locationLabel}`;
        button.setAttribute("aria-label", markerLabel);
        button.setAttribute(
          "aria-pressed",
          String(selectedIdRef.current === item.id),
        );
        const pin = document.createElement("span");
        pin.className = "discovery-map-marker-pin";
        pin.setAttribute("aria-hidden", "true");
        const clusterCount = document.createElement("span");
        clusterCount.className = "discovery-map-marker-count";
        clusterCount.setAttribute("aria-hidden", "true");
        button.append(pin, clusterCount);
        const activateMarker = () => {
          const clusterIds = (button.dataset.clusterIds || "")
            .split("|")
            .filter(Boolean);
          if (clusterIds.length > 1) {
            const clusterEntries = markerRefs.current.filter(({ id }) =>
              clusterIds.includes(id),
            );
            const clusterKey = markerClusterKey(clusterEntries);
            const expandCluster = () => {
              expandedClusterKeyRef.current = clusterKey;
              layoutMapMarkers(
                map,
                markerRefs.current,
                selectedIdRef.current,
                expandedClusterKeyRef.current,
                getClusterLabel,
              );
              const focusTarget = clusterEntries.find(
                ({ marker }) => marker.getElement().style.display !== "none",
              );
              focusTarget?.button.focus({ preventScroll: true });
            };

            if (map.getZoom() < 10.5) {
              const clusterBounds = new mapboxgl.LngLatBounds();
              clusterEntries.forEach(({ longitude, latitude }) =>
                clusterBounds.extend([longitude, latitude]),
              );
              expandedClusterKeyRef.current = "";
              map.once("moveend", expandCluster);
              map.fitBounds(clusterBounds, {
                padding: { top: 72, right: 72, bottom: 72, left: 72 },
                maxZoom: 12,
                duration: 400,
              });
            } else {
              expandCluster();
            }
            return;
          }
          onSelectRef.current(item.id);
        };
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          activateMarker();
        });
        button.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          event.stopPropagation();
          activateMarker();
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
          clusterCount,
          label: markerLabel,
          longitude: item.longitude,
          latitude: item.latitude,
        });
        bounds.extend([item.longitude, item.latitude]);
      });
      layoutMapMarkers(
        map,
        markerRefs.current,
        selectedIdRef.current,
        expandedClusterKeyRef.current,
        getClusterLabel,
      );

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
  }, [getClusterLabel, items, ready, t, userLocation]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    layoutMapMarkers(
      map,
      markerRefs.current,
      selectedId,
      expandedClusterKeyRef.current,
      getClusterLabel,
    );
  }, [getClusterLabel, ready, selectedId]);

  if (!accessToken || mapError) {
    return (
      <div className="discovery-map-fallback">
        <MapPin size={26} aria-hidden="true" />
        <strong>
          {t("explore.map.unavailableTitle", "Map view is unavailable")}
        </strong>
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
      <div
        ref={containerRef}
        className="discovery-map"
        aria-label={t("explore.map.label", "Discovery map")}
      />
      {!ready && (
        <div className="discovery-map-loading" role="status">
          <MapPin size={28} aria-hidden="true" />
          <strong>
            {t("explore.map.loadingTitle", "Preparing the Albania map")}
          </strong>
          <span>
            {items.length > 0
              ? t(
                  "explore.map.loadingCount",
                  "Positioning {count} reviewed places and businesses...",
                ).replace("{count}", String(items.length))
              : t(
                  "explore.map.loadingBody",
                  "Loading cities, places and map controls...",
                )}
          </span>
        </div>
      )}
      {ready && items.length === 0 && (
        <div className="discovery-map-empty" role="status">
          {t("explore.map.empty", "No mapped places match these filters yet.")}
        </div>
      )}

      <style jsx>{`
        .discovery-map-shell {
          position: relative;
          min-height: 540px;
          height: min(70vh, 740px);
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: #eef1f2;
        }

        .discovery-map {
          position: absolute;
          inset: 0;
        }

        .discovery-map-loading {
          position: absolute;
          inset: 0;
          display: grid;
          place-content: center;
          justify-items: center;
          gap: 0.45rem;
          background: var(--surface);
          color: var(--text-muted);
          padding: 1.25rem;
          text-align: center;
        }

        .discovery-map-loading strong {
          color: var(--text);
        }

        .discovery-map-loading span {
          max-width: 28rem;
          font-size: 0.82rem;
          line-height: 1.5;
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
          top: 8px;
          left: 8px;
          width: 28px;
          height: 28px;
          border: 3px solid #ffffff;
          border-radius: 50%;
          box-shadow: 0 3px 12px rgba(11, 18, 32, 0.3);
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        :global(.discovery-map-marker-pin::after) {
          position: absolute;
          inset: 7px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.92);
          content: "";
        }

        :global(.discovery-map-marker-count) {
          display: none;
        }

        :global(
          .discovery-map-marker-shell.is-cluster .discovery-map-marker-pin
        ) {
          display: none;
        }

        :global(
          .discovery-map-marker-shell.is-cluster .discovery-map-marker-count
        ) {
          position: absolute;
          inset: 3px;
          display: grid;
          place-items: center;
          border: 3px solid #ffffff;
          border-radius: 50%;
          background: #111827;
          box-shadow: 0 3px 12px rgba(11, 18, 32, 0.3);
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 800;
          line-height: 1;
          transition:
            transform 0.15s ease,
            box-shadow 0.15s ease;
        }

        :global(
          .discovery-map-marker-shell.is-business .discovery-map-marker-pin
        ) {
          background: #ff6b35;
        }

        :global(
          .discovery-map-marker-shell.is-directory .discovery-map-marker-pin
        ) {
          background: #14b8a6;
        }

        :global(.discovery-map-marker-shell:hover),
        :global(.discovery-map-marker-shell:focus-within),
        :global(.discovery-map-marker-shell.is-selected) {
          z-index: 3;
        }

        :global(.discovery-map-marker-shell:hover .discovery-map-marker-pin),
        :global(
          .discovery-map-marker-shell:focus-within .discovery-map-marker-pin
        ),
        :global(
          .discovery-map-marker-shell.is-selected .discovery-map-marker-pin
        ) {
          transform: scale(1.18);
          box-shadow: 0 4px 18px rgba(11, 18, 32, 0.42);
        }

        :global(
          .discovery-map-marker-shell.is-cluster:hover
            .discovery-map-marker-count
        ),
        :global(
          .discovery-map-marker-shell.is-cluster:focus-within
            .discovery-map-marker-count
        ),
        :global(
          .discovery-map-marker-shell.is-cluster.is-selected
            .discovery-map-marker-count
        ) {
          transform: scale(1.12);
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
            min-height: 480px;
            height: 62dvh;
            border-radius: 8px;
            margin-inline: 0;
          }

          :global(.discovery-map .mapboxgl-scroll-zoom-blocker) {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
