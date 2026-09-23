import { useCallback, useEffect, useMemo, useState } from "react";
import type { Target } from "./targets";
import { answersMatch } from "./answerMatch";
import { passOnlineTurn, subscribeToRoom, submitOnlineAnswer, type OnlineAnswer, type OnlineRoom } from "./onlineRooms";
import { supabase } from "./supabase";

export function useOnlineFreeTypeGame(targets: Target[], initialRoom: OnlineRoom, playerNumber: 1 | 2) {
  const [room, setRoom] = useState(initialRoom);
  const [answers, setAnswers] = useState<Map<string, 1 | 2>>(new Map());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [shakeToken, setShakeToken] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;

    const [{ data: roomData, error: roomError }, { data: answerData, error: answerError }] = await Promise.all([
      supabase.from("game_rooms").select("*").eq("id", initialRoom.id).single(),
      supabase.from("game_room_answers").select("room_id,target_key,player_number").eq("room_id", initialRoom.id),
    ]);

    if (roomError || answerError) {
      setError(roomError?.message ?? answerError?.message ?? "Oda verisi alınamadı.");
      setLoading(false);
      return;
    }

    setRoom(roomData as OnlineRoom);
    setAnswers(new Map((answerData as OnlineAnswer[]).map((answer) => [answer.target_key, answer.player_number])));
    setLoading(false);
  }, [initialRoom.id]);

  useEffect(() => {
    void refresh();
    const channel = subscribeToRoom(initialRoom.id, () => void refresh());
    return () => {
      void channel.unsubscribe();
    };
  }, [initialRoom.id, refresh]);

  const submit = useCallback(
    async (text: string) => {
      if (!text.trim() || room.status !== "playing" || room.active_player !== playerNumber || submitting) return false;

      const match = targets.find((target) => !answers.has(target.key) && answersMatch(text, target.answer));
      if (!match) {
        setShakeToken((token) => token + 1);
        setSubmitting(true);
        try {
          await passOnlineTurn(room.id);
          await refresh();
        } catch (submissionError) {
          setError(submissionError instanceof Error ? submissionError.message : "Tur devredilemedi.");
        } finally {
          setSubmitting(false);
        }
        return false;
      }

      setSubmitting(true);
      setError(null);
      try {
        const accepted = await submitOnlineAnswer(room.id, match.key);
        if (!accepted) setError("Bu cevap az önce diğer oyuncu tarafından yazıldı.");
        await refresh();
        return accepted;
      } catch (submissionError) {
        setError(submissionError instanceof Error ? submissionError.message : "Cevap gönderilemedi.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [answers, playerNumber, refresh, room.active_player, room.id, room.status, submitting, targets]
  );

  const markers = useMemo(
    () =>
      targets
        .filter((target) => answers.has(target.key))
        .map((target) => ({
          key: target.key,
          lat: target.lat,
          lng: target.lng,
          color: answers.get(target.key) === 2 ? ("red" as const) : ("blue" as const),
        })),
    [answers, targets]
  );

  const countryOwnerById = useMemo(() => {
    const owners = new Map<string, "blue" | "red">();
    for (const target of targets) {
      const owner = answers.get(target.key);
      if (owner && !owners.has(target.mapId)) owners.set(target.mapId, owner === 1 ? "blue" : "red");
    }
    return owners;
  }, [answers, targets]);

  return { room, answers, loading, submitting, shakeToken, error, markers, countryOwnerById, submit };
}
