import { useCallback, useEffect, useRef, useState } from "react";

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? [hours, minutes, seconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":")
    : [minutes, seconds]
        .map((value) => String(value).padStart(2, "0"))
        .join(":");
}

export function usePracticeTimer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = window.setInterval(() => {
      setSeconds((value) => value + 1);
    }, 1000);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  const toggle = useCallback(() => setIsRunning((value) => !value), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(0);
  }, []);

  return {
    seconds,
    formatted: formatDuration(seconds),
    isRunning,
    toggle,
    reset,
  };
}
