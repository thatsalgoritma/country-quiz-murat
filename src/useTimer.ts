import { useCallback, useEffect, useRef, useState } from "react";

export function useTimer() {
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(0);
  const accumulatedRef = useRef(0);

  const start = useCallback(() => {
    startRef.current = Date.now();
    setRunning(true);
  }, []);

  const pause = useCallback(() => {
    setRunning((wasRunning) => {
      if (wasRunning) {
        accumulatedRef.current += Date.now() - startRef.current;
      }
      return false;
    });
  }, []);

  const reset = useCallback(() => {
    accumulatedRef.current = 0;
    startRef.current = Date.now();
    setElapsedMs(0);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setElapsedMs(accumulatedRef.current + (Date.now() - startRef.current));
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  return { running, elapsedMs, start, pause, reset };
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}