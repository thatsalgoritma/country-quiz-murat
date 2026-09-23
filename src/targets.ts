import type { Country } from "./countries";
import { CAPITAL_COORDS } from "./capitals";
import { CITY_CLUES } from "./cities";

export interface Target {
  key: string;
  cca3: string;
  mapId: string;
  countryName: string;
  region: string;
  subregion: string;
  answer: string;
  flag?: string;
  population?: number;
  lat: number;
  lng: number;
}

export function buildCapitalTargets(pool: Country[]): Target[] {
  const coordByCca3 = new Map(CAPITAL_COORDS.map((c) => [c.cca3, c]));
  const targets: Target[] = [];
  for (const c of pool) {
    const coord = coordByCca3.get(c.cca3);
    if (!coord) continue;
    targets.push({
      key: c.cca3,
      cca3: c.cca3,
      mapId: c.ccn3,
      countryName: c.name,
      region: c.region,
      subregion: c.subregion,
      answer: c.capital,
      lat: coord.lat,
      lng: coord.lng,
    });
  }
  return targets.sort((a, b) => a.countryName.localeCompare(b.countryName));
}

export function buildCountryTargets(pool: Country[]): Target[] {
  return pool
    .map((c) => ({
      key: c.cca3,
      cca3: c.cca3,
      mapId: c.ccn3,
      countryName: c.name,
      region: c.region,
      subregion: c.subregion,
      answer: c.name,
      flag: c.flag,
      lat: c.latlng[0],
      lng: c.latlng[1],
    }))
    .sort((a, b) => a.countryName.localeCompare(b.countryName));
}

export function buildCityTargets(pool: Country[]): Target[] {
  const byCca3 = new Map(pool.map((c) => [c.cca3, c]));
  const targets: Target[] = [];
  for (const clue of CITY_CLUES) {
    const country = byCca3.get(clue.cca3);
    if (!country) continue;
    targets.push({
      key: `${clue.cca3}-${clue.city}`,
      cca3: clue.cca3,
      mapId: country.ccn3,
      countryName: country.name,
      region: country.region,
      subregion: country.subregion,
      answer: clue.city,
      lat: clue.lat,
      lng: clue.lng,
      population: clue.population,
    });
  }
  return targets;
}
