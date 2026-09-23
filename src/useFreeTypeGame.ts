import { useCallback, useEffect, useMemo, useState } from "react";
import type { Target } from "./targets";
import { answersMatch } from "./answerMatch";
import { useTimer } from "./useTimer";

export type PlayerId = 1 | 2;

export function useFreeTypeGame(targets: Target[], multiplayer = false) {
  const timer = useTimer();
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [answerOwners, setAnswerOwners] = useState<Map<string, PlayerId>>(new Map());
  const [activePlayer, setActivePlayer] = useState<PlayerId>(1);
  const [finished, setFinished] = useState(false);
  const [shakeToken, setShakeToken] = useState(0);

  useEffect(() => {
    timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(
    (text: string) => {
      if (!text.trim() || finished) return false;
      const match = targets.find((t) => !guessed.has(t.key) && answersMatch(text, t.answer));
      if (!match) {
        setShakeToken((n) => n + 1);
        if (multiplayer) setActivePlayer((player) => (player === 1 ? 2 : 1));
        return false;
      }
      const next = new Set(guessed);
      next.add(match.key);
      setGuessed(next);
      if (multiplayer) {
        setAnswerOwners((owners) => new Map(owners).set(match.key, activePlayer));
        setActivePlayer((player) => (player === 1 ? 2 : 1));
      }
      if (next.size === targets.length) {
        setFinished(true);
        timer.pause();
      }
      return true;
    },
    [targets, guessed, finished, timer, multiplayer, activePlayer]
  );

  const finish = useCallback(() => {
    setFinished(true);
    timer.pause();
  }, [timer]);

  const restart = useCallback(() => {
    setGuessed(new Set());
    setAnswerOwners(new Map());
    setActivePlayer(1);
    setFinished(false);
    timer.reset();
    timer.start();
  }, [timer]);

  const markers = useMemo(
    () =>
      targets
        .filter((t) => guessed.has(t.key))
        .map((t) => ({
          key: t.key,
          lat: t.lat,
          lng: t.lng,
          color: answerOwners.get(t.key) === 2 ? ("red" as const) : ("blue" as const),
        })),
    [targets, guessed, answerOwners]
  );

  return {
    guessed,
    answerOwners,
    activePlayer,
    multiplayer,
    markers,
    finished,
    shakeToken,
    submit,
    finish,
    restart,
    timer,
    total: targets.length,
    doneCount: guessed.size,
  };
}
