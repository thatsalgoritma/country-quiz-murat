import { readFile, writeFile } from "node:fs/promises";
import worldCountries from "world-countries";

const INPUT_PATH = new URL("../worldcities.csv", import.meta.url);
const OUTPUT_PATH = new URL("../src/cities.ts", import.meta.url);
const playableCountryCodes = new Set(
  worldCountries
    .filter((country) => country.independent && country.capital?.length > 0 && country.latlng)
    .map((country) => country.cca3)
);

function parseCsvLine(line) {
  const values = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

const csv = await readFile(INPUT_PATH, "utf8");
const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
const headers = parseCsvLine(headerLine);
const column = Object.fromEntries(headers.map((name, index) => [name, index]));

const requiredColumns = ["city", "iso3", "lat", "lng", "capital", "population"];
for (const name of requiredColumns) {
  if (column[name] === undefined) throw new Error(`Eksik CSV sütunu: ${name}`);
}

const cityRows = lines
  .map(parseCsvLine)
  .map((row) => ({
    city: row[column.city],
    cca3: row[column.iso3],
    lat: Number(row[column.lat]),
    lng: Number(row[column.lng]),
    capital: row[column.capital],
    population: Number(row[column.population]),
  }))
  .filter(
    (city) =>
      city.city &&
      city.cca3 &&
      Number.isFinite(city.lat) &&
      Number.isFinite(city.lng) &&
      playableCountryCodes.has(city.cca3)
  )
  .sort((a, b) => b.population - a.population || a.city.localeCompare(b.city));

const cityClues = cityRows.map(({ city, cca3, lat, lng, population }) => ({ city, cca3, lat, lng, population }));

const generatedFile = `// Generated from worldcities.csv by scripts/generate-city-clues.mjs.\n// Includes every city associated with a playable country.\n\nexport interface CityClue {\n  city: string;\n  cca3: string;\n  lat: number;\n  lng: number;\n  population: number;\n}\n\nexport const CITY_CLUES: CityClue[] = ${JSON.stringify(
  cityClues,
  null,
  2
)};\n`;

await writeFile(OUTPUT_PATH, generatedFile);
console.log(`${cityClues.length} şehir src/cities.ts dosyasına yazıldı.`);
