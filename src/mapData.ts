import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import worldTopology from "world-atlas/countries-110m.json";

export interface WorldFeature {
  type: "Feature";
  id: string;
  properties: { name: string };
  geometry: unknown;
}

const topology = worldTopology as unknown as Topology;
const countriesObject = topology.objects.countries as GeometryCollection;

// topojson's feature() typing is loose about the return shape; the runtime
// result for a GeometryCollection is always a FeatureCollection.
export const worldFeatures = feature(topology, countriesObject) as unknown as {
  type: "FeatureCollection";
  features: WorldFeature[];
};

// ccn3 codes that actually have a drawable shape at this map resolution —
// some small island nations are omitted from the 110m topology entirely.
export const worldFeatureIds = new Set(worldFeatures.features.map((f) => f.id));
