import worldCountries from "world-countries";

export interface Country {
  name: string;
  capital: string;
  region: string;
  subregion: string;
  flag: string; // emoji flag
  latlng: [number, number];
  ccn3: string; // ISO numeric code, matches world-atlas topojson feature id
  cca3: string; // ISO alpha-3 code, used as a stable key (e.g. for the city list)
}

let cache: Country[] | null = null;

export async function fetchCountries(): Promise<Country[]> {
  if (cache) return cache;

  const countries = worldCountries
    .filter((c) => c.capital && c.capital.length > 0 && c.latlng && c.independent)
    .map<Country>((c) => ({
      name: c.name.common,
      capital: c.capital[0],
      region: c.region,
      subregion: c.subregion ?? c.region,
      flag: c.flag,
      latlng: c.latlng as [number, number],
      ccn3: c.ccn3,
      cca3: c.cca3,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  cache = countries;
  return countries;
}
