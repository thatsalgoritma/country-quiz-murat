import { useCallback, useEffect, useMemo, useState } from "react";
import type { Country } from "./countries";
import { buildCountryTargets, type Target } from "./targets";
import { countryStats } from "./data/countryStats";
import { answersMatch } from "./answerMatch";
import { useTimer } from "./useTimer";

export type CompareMetric = "population" | "area" | "gdp" | "gdpPerCapita";
export type CompareDirection = "higher" | "lower";
export type ComparePlayer = 1 | 2;
export type CompareMode = "solo" | "versus";

export interface CompareCandidate { target: Target; value: number }
export interface CompareChallenge { metric: CompareMetric; direction: CompareDirection; current: CompareCandidate }
export const COMPARE_METRICS: CompareMetric[] = ["population", "area", "gdp", "gdpPerCapita"];
export const COMPARE_DIRECTIONS: CompareDirection[] = ["higher", "lower"];

export function compareCandidates(pool: Country[], metric: CompareMetric): CompareCandidate[] {
  const targets = buildCountryTargets(pool);
  const byCode = new Map(pool.map((country) => [country.cca3, country]));
  return targets.flatMap((target) => {
    const country = byCode.get(target.cca3);
    if (!country) return [];
    const value = metric === "area" ? country.area : countryStats[target.cca3]?.[metric]?.value;
    return typeof value === "number" && Number.isFinite(value) ? [{ target, value }] : [];
  });
}

export function canCompare(current: CompareCandidate, candidates: CompareCandidate[], direction: CompareDirection, used: Set<string>) {
  return candidates.some((candidate) => !used.has(candidate.target.key) &&
    (direction === "higher" ? candidate.value > current.value : candidate.value < current.value));
}

function pick<T>(items: T[]): T | null { return items.length ? items[Math.floor(Math.random() * items.length)] : null; }

function randomChallenge(current: CompareCandidate, all: Record<CompareMetric, CompareCandidate[]>, used: Set<string>): CompareChallenge | null {
  const options = COMPARE_METRICS.flatMap((metric) => {
    const reference = all[metric].find((candidate) => candidate.target.key === current.target.key);
    if (!reference) return [];
    return COMPARE_DIRECTIONS
      .filter((direction) => canCompare(reference, all[metric], direction, used))
      .map((direction) => ({ metric, direction, current: reference }));
  });
  return pick(options);
}

function initialState(pool: Country[]) {
  const all = Object.fromEntries(COMPARE_METRICS.map((metric) => [metric, compareCandidates(pool, metric)])) as Record<CompareMetric, CompareCandidate[]>;
  const starts = COMPARE_METRICS.flatMap((metric) => all[metric].flatMap((candidate) => {
    const used = new Set([candidate.target.key]);
    const challenge = randomChallenge(candidate, all, used);
    return challenge ? [{ candidate, challenge }] : [];
  }));
  const start = pick(starts);
  return { all, start };
}

export function useCountryCompareGame(pool: Country[], mode: CompareMode = "solo") {
  const timer = useTimer();
  const { start: startTimer } = timer;
  const initial = useMemo(() => initialState(pool), [pool]);
  const [current, setCurrent] = useState<CompareCandidate | null>(() => initial.start?.challenge.current ?? null);
  const [metric, setMetric] = useState<CompareMetric>(() => initial.start?.challenge.metric ?? "population");
  const [direction, setDirection] = useState<CompareDirection>(() => initial.start?.challenge.direction ?? "higher");
  const [used, setUsed] = useState<Set<string>>(() => new Set(initial.start ? [initial.start.candidate.target.key] : []));
  const [answerOwners, setAnswerOwners] = useState<Map<string, ComparePlayer>>(() => new Map());
  const [activePlayer, setActivePlayer] = useState<ComparePlayer>(1);
  const [finished, setFinished] = useState(false);
  const [winner, setWinner] = useState<ComparePlayer | null>(null);
  const [shakeToken, setShakeToken] = useState(0);

  useEffect(() => { startTimer(); }, [startTimer]);

  const submit = useCallback((text: string) => {
    if (!text.trim() || !current || finished) return false;
    const match = initial.all[metric].find((candidate) => !used.has(candidate.target.key) &&
      answersMatch(text, candidate.target.countryName) &&
      (direction === "higher" ? candidate.value > current.value : candidate.value < current.value));
    if (!match) {
      setShakeToken((n) => n + 1);
      if (mode === "versus") setActivePlayer((player) => player === 1 ? 2 : 1);
      return false;
    }
    const nextUsed = new Set(used).add(match.target.key);
    setUsed(nextUsed);
    setAnswerOwners((owners) => new Map(owners).set(match.target.key, mode === "versus" ? activePlayer : 1));
    setCurrent(match);
    if (mode === "versus") setActivePlayer((player) => player === 1 ? 2 : 1);
    const nextChallenge = randomChallenge(match, initial.all, nextUsed);
    if (!nextChallenge) {
      setFinished(true);
      if (mode === "versus") setWinner(activePlayer);
      timer.pause();
    } else {
    setCurrent(nextChallenge.current);
    setMetric(nextChallenge.metric);
      setDirection(nextChallenge.direction);
    }
    return true;
  }, [activePlayer, current, direction, finished, initial.all, metric, mode, timer, used]);

  const finish = useCallback(() => { setFinished(true); timer.pause(); }, [timer]);
  const restart = useCallback(() => {
    const next = initialState(pool);
    setCurrent(next.start?.challenge.current ?? null);
    setMetric(next.start?.challenge.metric ?? "population");
    setDirection(next.start?.challenge.direction ?? "higher");
    setUsed(new Set(next.start ? [next.start.candidate.target.key] : []));
    setAnswerOwners(new Map()); setActivePlayer(1); setFinished(false); setWinner(null); setShakeToken(0);
    timer.reset(); timer.start();
  }, [pool, timer]);

  const countryOwnerById = useMemo(() => {
    const map = new Map<string, "blue" | "red">();
    const targets = buildCountryTargets(pool);
    for (const key of used) {
      const target = targets.find((item) => item.key === key);
      if (target) map.set(target.mapId, answerOwners.get(key) === 2 ? "red" : "blue");
    }
    return map;
  }, [answerOwners, pool, used]);

  return { current: current?.target ?? null, currentValue: current?.value ?? null, metric, direction, used, answerOwners, activePlayer, finished, winner, shakeToken, countryOwnerById, submit, finish, restart, timer, total: initial.all[metric].length, doneCount: used.size - (current ? 1 : 0), ready: current !== null };
}
