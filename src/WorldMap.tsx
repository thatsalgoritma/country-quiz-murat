import { useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup, Marker } from "react-simple-maps";
import { worldFeatures } from "./mapData";

export interface MapMarker {
  key: string;
  lat: number;
  lng: number;
  color?: "blue" | "red";
}

interface WorldMapProps {
  markers: MapMarker[];
  correctCountryIds?: Set<string>;
  countryOwnerById?: Map<string, "blue" | "red">;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

export function WorldMap({ markers, correctCountryIds = new Set(), countryOwnerById = new Map() }: WorldMapProps) {
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([10, 20]);

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, z * 1.5));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, z / 1.5));
  const resetView = () => {
    setZoom(1);
    setCenter([10, 20]);
  };

  return (
    <div className="world-map-wrap">
      <ComposableMap
        projection="geoNaturalEarth1"
        className="world-map"
        role="img"
        aria-label="Dünya haritası"
      >
        <ZoomableGroup
          zoom={zoom}
          center={center}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onMoveEnd={(pos) => {
            setZoom(pos.zoom ?? zoom);
            if (pos.coordinates) setCenter(pos.coordinates);
          }}
        >
          <Geographies geography={worldFeatures}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  className={
                    "map-land" +
                    (geo.id !== undefined && correctCountryIds.has(String(geo.id)) ? " map-land--correct" : "") +
                    (geo.id !== undefined && countryOwnerById.get(String(geo.id)) === "blue" ? " map-land--blue" : "") +
                    (geo.id !== undefined && countryOwnerById.get(String(geo.id)) === "red" ? " map-land--red" : "")
                  }
                  style={{ outline: "none" }}
                />
              ))
            }
          </Geographies>
          {markers.map((m) => (
            <Marker key={m.key} coordinates={[m.lng, m.lat]}>
              <circle r={3.2 / zoom} className={"map-marker map-marker--" + (m.color ?? "blue")} />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
      <div className="map-controls">
        <button type="button" className="map-btn" onClick={zoomIn} aria-label="Yakınlaştır">
          +
        </button>
        <button type="button" className="map-btn" onClick={zoomOut} aria-label="Uzaklaştır">
          −
        </button>
        <button type="button" className="map-btn map-btn--reset" onClick={resetView} aria-label="Görünümü sıfırla">
          ⟲
        </button>
      </div>
    </div>
  );
}
