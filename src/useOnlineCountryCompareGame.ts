import { useCallback, useEffect, useMemo, useState } from "react";
import type { Country } from "./countries";
import {
  canCompare, compareCandidates, COMPARE_DIRECTIONS, COMPARE_METRICS,
  type CompareCandidate, type CompareDirection, type CompareMetric,
} from "./useCountryCompareGame";
import { answersMatch } from "./answerMatch";
import { passOnlineTurn, subscribeToRoom, submitOnlineAnswer, type OnlineAnswer, type OnlineRoom } from "./onlineRooms";
import { supabase } from "./supabase";

type AnswerRow = OnlineAnswer & { answered_at: string };
type Challenge = { metric: CompareMetric; direction: CompareDirection; current: CompareCandidate };
const seedOf = (text: string) => [...text].reduce((seed, char) => Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0, 2166136261);
function seededIndex(seed: number, length: number) {
  let value = (seed + 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) % length;
}

function candidatesByMetric(pool: Country[]) {
  return Object.fromEntries(COMPARE_METRICS.map((metric) => [metric, compareCandidates(pool, metric)])) as Record<CompareMetric, CompareCandidate[]>;
}
function challengeOptions(reference: CompareCandidate, all: ReturnType<typeof candidatesByMetric>, used: Set<string>) {
  return COMPARE_METRICS.flatMap((metric) => {
    const current = all[metric].find((candidate) => candidate.target.key === reference.target.key);
    if (!current) return [];
    return COMPARE_DIRECTIONS.filter((direction) => canCompare(current, all[metric], direction, used))
      .map((direction) => ({ metric, direction, current }));
  });
}
function initialChallenge(all: ReturnType<typeof candidatesByMetric>, roomId: string): Challenge | null {
  const options = COMPARE_METRICS.flatMap((metric) => all[metric].flatMap((candidate) =>
    challengeOptions(candidate, all, new Set([candidate.target.key]))));
  return options[seededIndex(seedOf(`${roomId}:start`), options.length)] ?? null;
}

export function useOnlineCountryCompareGame(pool: Country[], initialRoom: OnlineRoom, playerNumber: 1 | 2) {
  const all = useMemo(() => candidatesByMetric(pool), [pool]);
  const [room, setRoom] = useState(initialRoom);
  const [answers, setAnswers] = useState<Map<string, 1 | 2>>(new Map());
  const [answerOrder, setAnswerOrder] = useState<string[]>([]);
  const [playerNames, setPlayerNames] = useState<Record<1 | 2, string>>({ 1: "Oyuncu 1", 2: "Oyuncu 2" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shakeToken, setShakeToken] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const [roomResult, answerResult, playerResult] = await Promise.all([
      supabase.from("game_rooms").select("*").eq("id", initialRoom.id).single(),
      supabase.from("game_room_answers").select("room_id,target_key,player_number,answered_at").eq("room_id", initialRoom.id).order("answered_at"),
      supabase.from("game_room_players").select("player_number,display_name").eq("room_id", initialRoom.id),
    ]);
    if (roomResult.error || answerResult.error || playerResult.error) {
      setError(roomResult.error?.message ?? answerResult.error?.message ?? playerResult.error?.message ?? "Oda verisi alınamadı.");
      setLoading(false); return;
    }
    const rows = (answerResult.data ?? []) as AnswerRow[];
    setRoom(roomResult.data as OnlineRoom);
    setAnswers(new Map(rows.map((answer) => [answer.target_key, answer.player_number])));
    setAnswerOrder(rows.map((answer) => answer.target_key));
    const names: Record<1 | 2, string> = { 1: "Oyuncu 1", 2: "Oyuncu 2" };
    const players = (playerResult.data ?? []) as Array<{ player_number: number; display_name: string }>;
    for (const player of players) if (player.player_number === 1 || player.player_number === 2) names[player.player_number] = player.display_name;
    setPlayerNames(names); setLoading(false);
  }, [initialRoom.id]);

  useEffect(() => {
    void refresh();
    const channel = subscribeToRoom(initialRoom.id, () => void refresh());
    return () => { void channel.unsubscribe(); };
  }, [initialRoom.id, refresh]);

  const used = useMemo(() => new Set(answerOrder), [answerOrder]);
  const challenge = useMemo(() => {
    if (!answerOrder.length) return initialChallenge(all, initialRoom.id);
    const lastKey = answerOrder[answerOrder.length - 1];
    const reference = Object.values(all).flat().find((candidate) => candidate.target.key === lastKey);
    if (!reference) return null;
    const options = challengeOptions(reference, all, used);
    const index = seededIndex(seedOf(`${initialRoom.id}:${answerOrder.join(",")}`), options.length);
    return options[index] ?? null;
  }, [all, answerOrder, initialRoom.id, used]);

  const submit = useCallback(async (text: string) => {
    if (!text.trim() || !challenge || room.status !== "playing" || room.active_player !== playerNumber || submitting) return false;
    const match = all[challenge.metric].find((candidate) => !used.has(candidate.target.key) &&
      answersMatch(text, candidate.target.countryName) &&
      (challenge.direction === "higher" ? candidate.value > challenge.current.value : candidate.value < challenge.current.value));
    setSubmitting(true); setError(null);
    try {
      if (!match) { setShakeToken((n) => n + 1); await passOnlineTurn(room.id); await refresh(); return false; }
      const accepted = await submitOnlineAnswer(room.id, match.target.key);
      await refresh();
      if (!accepted) setError("Bu ülke az önce diğer oyuncu tarafından yazıldı.");
      return accepted;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Cevap gönderilemedi."); return false;
    } finally { setSubmitting(false); }
  }, [all, challenge, playerNumber, refresh, room.active_player, room.id, room.status, submitting, used]);

  const countryOwnerById = useMemo(() => {
    const owners = new Map<string, "blue" | "red">();
    for (const [key, player] of answers) {
      const country = pool.find((item) => item.cca3 === key);
      if (country) owners.set(country.ccn3, player === 2 ? "red" : "blue");
    }
    return owners;
  }, [answers, pool]);
  return { room, answers, answerOrder, playerNames, loading, submitting, shakeToken, error, challenge, used, countryOwnerById, submit, finished: room.status === "finished" || (room.status === "playing" && !loading && challenge === null) };
}
