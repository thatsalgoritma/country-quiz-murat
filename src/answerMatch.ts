// Typed answers are compared loosely: case, Turkish characters, accents and
// stray punctuation shouldn't cost the player a point.
export function normalizeAnswer(input: string): string {
  return input
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .replace(/ı/g, "i")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip remaining accents (é -> e, ç -> c, ö -> o, ...)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function answersMatch(input: string, expected: string): boolean {
  const a = normalizeAnswer(input);
  if (!a) return false;
  return a === normalizeAnswer(expected);
}