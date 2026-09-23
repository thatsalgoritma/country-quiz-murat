import { useCallback, useEffect, useMemo, useState } from "react";
import type { Target } from "./targets";
import { answersMatch } from "./answerMatch";
import { useTimer } from "./useTimer";
import type { PlayerId } from "./useFreeTypeGame";

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface ChoiceResult {
  picked: string;
  correct: boolean;
}

export function useClueGame(targets: Target[], withChoices: boolean, multiplayer = false) {
  const timer = useTimer();
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [answerOwners, setAnswerOwners] = useState<Map<string, PlayerId>>(new Map());
  const [activePlayer, setActivePlayer] = useState<PlayerId>(1);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [finished, setFinished] = useState(false);
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [choiceResult, setChoiceResult] = useState<ChoiceResult | null>(null);
  const [shakeToken, setShakeToken] = useState(0);

  useEffect(() => {
    timer.start();
    if (targets.length > 0) setCurrentKey(pickRandom(targets).key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useMemo(() => targets.find((t) => t.key === currentKey) ?? null, [targets, currentKey]);

  const choiceOptions = useMemo(() => {
    if (!withChoices || !current) return [];
    const distractors = shuffle(targets.filter((t) => t.key !== current.key))
      .slice(0, 3)
      .map((t) => t.answer);
    return shuffle([current.answer, ...distractors]);
  }, [withChoices, current, targets]);

  const resolveCurrentAndAdvance = useCallback(
    (key: string, wasCorrect: boolean) => {
      const nextResolved = new Set(resolved);
      nextResolved.add(key);
      setResolved(nextResolved);
      if (wasCorrect) {
        setGuessed((g) => new Set(g).add(key));
        if (multiplayer) setAnswerOwners((owners) => new Map(owners).set(key, activePlayer));
      }
      if (multiplayer) setActivePlayer((player) => (player === 1 ? 2 : 1));

      const pool = targets.filter((t) => !nextResolved.has(t.key));
      if (pool.length === 0) {
        setFinished(true);
        timer.pause();
        setCurrentKey(null);
      } else {
        setCurrentKey(pickRandom(pool).key);
      }
      setChoiceResult(null);
    },
    [resolved, targets, timer, multiplayer, activePlayer]
  );

  const submitTyped = useCallback(
    (text: string) => {
      if (!current || finished || !text.trim()) return false;
      if (answersMatch(text, current.answer)) {
        resolveCurrentAndAdvance(current.key, true);
        return true;
      }
      setShakeToken((n) => n + 1);
      if (multiplayer) setActivePlayer((player) => (player === 1 ? 2 : 1));
      return false;
    },
    [current, finished, resolveCurrentAndAdvance, multiplayer]
  );

  const skip = useCallback(() => {
    if (!current || finished) return;
    resolveCurrentAndAdvance(current.key, false);
  }, [current, finished, resolveCurrentAndAdvance]);

  const submitChoice = useCallback(
    (option: string) => {
      if (!current || finished || choiceResult) return;
      setChoiceResult({ picked: option, correct: option === current.answer });
    },
    [current, finished, choiceResult]
  );

  const confirmChoiceAndAdvance = useCallback(() => {
    if (!current || !choiceResult) return;
    resolveCurrentAndAdvance(current.key, choiceResult.correct);
  }, [current, choiceResult, resolveCurrentAndAdvance]);

  const finish = useCallback(() => {
    setFinished(true);
    setCurrentKey(null);
    timer.pause();
  }, [timer]);

  const restart = useCallback(() => {
    setGuessed(new Set());
    setAnswerOwners(new Map());
    setActivePlayer(1);
    setResolved(new Set());
    setFinished(false);
    setChoiceResult(null);
    setCurrentKey(targets.length > 0 ? pickRandom(targets).key : null);
    timer.reset();
    timer.start();
  }, [targets, timer]);

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
    current,
    choiceOptions,
    choiceResult,
    guessed,
    answerOwners,
    activePlayer,
    multiplayer,
    resolved,
    markers,
    finished,
    shakeToken,
    submitTyped,
    submitChoice,
    confirmChoiceAndAdvance,
    skip,
    finish,
    restart,
    timer,
    total: targets.length,
    doneCount: resolved.size,
    correctCount: guessed.size,
  };
}
