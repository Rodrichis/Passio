import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./leaflet-passio.css";

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

type Props = {
  value: GeoPoint | null;
  onChange: (point: GeoPoint) => void;
  disabled?: boolean;
  height?: number | string;
};

const DEFAULT_CENTER: [number, number] = [-33.4489, -70.6693];
const LEAFLET_STYLE_ID = "passio-leaflet-runtime-styles";
const LEAFLET_RUNTIME_CSS = `
.leaflet-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #eaf5fb;
  outline: 0;
  font-family: inherit;
  touch-action: none;
}
.leaflet-pane,
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow,
.leaflet-tile-container,
.leaflet-pane > svg,
.leaflet-pane > canvas,
.leaflet-zoom-box,
.leaflet-image-layer,
.leaflet-layer {
  position: absolute;
  left: 0;
  top: 0;
}
.leaflet-tile,
.leaflet-marker-icon,
.leaflet-marker-shadow {
  user-select: none;
  -webkit-user-drag: none;
}
.leaflet-tile {
  filter: inherit;
  visibility: hidden;
  border: 0;
}
.leaflet-container img.leaflet-tile {
  max-width: none !important;
  max-height: none !important;
}
.leaflet-tile-loaded {
  visibility: inherit;
}
.leaflet-map-pane {
  z-index: 400;
}
.leaflet-tile-pane {
  z-index: 200;
}
.leaflet-overlay-pane {
  z-index: 400;
}
.leaflet-marker-pane {
  z-index: 600;
}
.leaflet-tooltip-pane {
  z-index: 650;
}
.leaflet-popup-pane {
  z-index: 700;
}
.leaflet-control {
  position: relative;
  z-index: 800;
  pointer-events: auto;
  float: left;
  clear: both;
}
.leaflet-top,
.leaflet-bottom {
  position: absolute;
  z-index: 1000;
  pointer-events: none;
}
.leaflet-top {
  top: 0;
}
.leaflet-right {
  right: 0;
}
.leaflet-bottom {
  bottom: 0;
}
.leaflet-left {
  left: 0;
}
.leaflet-top .leaflet-control {
  margin-top: 10px;
}
.leaflet-bottom .leaflet-control {
  margin-bottom: 10px;
}
.leaflet-left .leaflet-control {
  margin-left: 10px;
}
.leaflet-right .leaflet-control {
  margin-right: 10px;
  float: right;
}
.leaflet-control-zoom {
  border: 1px solid rgba(2, 48, 71, 0.16);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 18px rgba(2, 48, 71, 0.12);
}
.leaflet-control-zoom a {
  display: block;
  width: 32px;
  height: 32px;
  line-height: 31px;
  background: #ffffff;
  color: #023047;
  text-align: center;
  text-decoration: none;
  font-size: 20px;
  font-weight: 800;
  border-bottom: 1px solid #d6e4ed;
}
.leaflet-control-zoom a:last-child {
  border-bottom: 0;
}
.leaflet-control-zoom a:hover {
  background: #f3f9fd;
}
.leaflet-control-attribution {
  margin: 0;
  padding: 3px 7px;
  border-radius: 10px 0 0 0;
  background: rgba(255, 255, 255, 0.82);
  color: #607d8b;
  font-size: 10px;
}
.leaflet-control-attribution a {
  color: #023047;
  text-decoration: none;
}
.leaflet-grab {
  cursor: grab;
}
.leaflet-dragging .leaflet-grab {
  cursor: move;
}
.leaflet-interactive {
  cursor: pointer;
}
`;

function ensureLeafletStyles() {
  if (typeof document === "undefined") return;
  if (document.getElementById(LEAFLET_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = LEAFLET_STYLE_ID;
  style.textContent = LEAFLET_RUNTIME_CSS;
  document.head.appendChild(style);
}

function createMarkerIcon() {
  const markerSize = 22;
  const markerCenter = markerSize / 2;

  return L.divIcon({
    className: "",
    html:
      '<div style="width:22px;height:22px;box-sizing:border-box;border-radius:999px;background:#2196F3;border:4px solid #fff;box-shadow:0 8px 18px rgba(2,48,71,.28);"></div>',
    iconSize: [markerSize, markerSize],
    iconAnchor: [markerCenter, markerCenter],
  });
}

export default function GeoMapPicker({ value, onChange, disabled, height = 360 }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    ensureLeafletStyles();

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      wheelPxPerZoomLevel: 120,
      wheelDebounceTime: 28,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    }).addTo(map);

    map.on("click", (event) => {
      if (disabledRef.current) return;
      const point = {
        latitude: Number(event.latlng.lat.toFixed(7)),
        longitude: Number(event.latlng.lng.toFixed(7)),
      };
      onChangeRef.current(point);
    });

    mapRef.current = map;

    window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !value) return;

    const latLng = L.latLng(value.latitude, value.longitude);
    if (!circleRef.current) {
      circleRef.current = L.circle(latLng, {
        radius: 160,
        color: "#2196F3",
        weight: 1.5,
        opacity: 0.4,
        fillColor: "#2196F3",
        fillOpacity: 0.14,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latLng);
    }

    if (!markerRef.current) {
      markerRef.current = L.marker(latLng, {
        icon: createMarkerIcon(),
        draggable: !disabledRef.current,
      })
        .on("dragend", (event) => {
          if (disabledRef.current) return;
          const nextLatLng = (event.target as L.Marker).getLatLng();
          onChangeRef.current({
            latitude: Number(nextLatLng.lat.toFixed(7)),
            longitude: Number(nextLatLng.lng.toFixed(7)),
          });
        })
        .addTo(map);
    } else {
      markerRef.current.setLatLng(latLng);
    }
    map.setView(latLng, Math.max(map.getZoom(), 15));
  }, [value]);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    if (disabled) {
      marker.dragging?.disable();
    } else {
      marker.dragging?.enable();
    }
  }, [disabled]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    window.setTimeout(() => map.invalidateSize(), 80);
  }, [height]);

  const resolvedHeight = typeof height === "number" ? height : "100%";
  const minHeight = typeof height === "number" ? height : 180;

  return (
    <div style={{ position: "relative", width: "100%", height: resolvedHeight, minHeight }}>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight,
          borderRadius: 22,
          overflow: "hidden",
          border: "1px solid #D6E4ED",
          opacity: disabled ? 0.72 : 1,
          background: "#EAF5FB",
        }}
      />
    </div>
  );
}
