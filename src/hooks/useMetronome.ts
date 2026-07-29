import { useCallback, useEffect, useRef, useState } from "react";

const clampBpm = (value: number): number =>
  Math.min(160, Math.max(40, Math.round(value)));

export function useMetronome() {
  const [bpm, setBpmState] = useState(72);
  const [beatsPerMeasure, setBeatsPerMeasureState] = useState(4);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<number | null>(null);
  const beatTimeoutsRef = useRef<number[]>([]);
  const nextNoteTimeRef = useRef(0);
  const nextBeatRef = useRef(0);
  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beatsPerMeasure);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    beatsRef.current = beatsPerMeasure;
  }, [beatsPerMeasure]);

  const scheduleClick = useCallback((time: number, beat: number) => {
    const context = audioContextRef.current;
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = beat === 0 ? 1200 : 800;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.2, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(time);
    oscillator.stop(time + 0.05);

    const delay = Math.max(0, (time - context.currentTime) * 1000);
    const timeout = window.setTimeout(() => setCurrentBeat(beat), delay);
    beatTimeoutsRef.current.push(timeout);
  }, []);

  const stop = useCallback(() => {
    if (schedulerRef.current !== null) {
      window.clearInterval(schedulerRef.current);
      schedulerRef.current = null;
    }
    beatTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    beatTimeoutsRef.current = [];
    setCurrentBeat(0);
    setIsRunning(false);
  }, []);

  const start = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    const context = audioContextRef.current;
    await context.resume();
    nextNoteTimeRef.current = context.currentTime + 0.06;
    nextBeatRef.current = 0;
    setIsRunning(true);

    schedulerRef.current = window.setInterval(() => {
      const activeContext = audioContextRef.current;
      if (!activeContext) return;
      while (nextNoteTimeRef.current < activeContext.currentTime + 0.1) {
        scheduleClick(nextNoteTimeRef.current, nextBeatRef.current);
        nextNoteTimeRef.current += 60 / bpmRef.current;
        nextBeatRef.current =
          (nextBeatRef.current + 1) % beatsRef.current;
      }
    }, 25);
  }, [scheduleClick]);

  const toggle = useCallback(() => {
    if (isRunning) {
      stop();
    } else {
      void start();
    }
  }, [isRunning, start, stop]);

  const setBpm = useCallback((value: number) => {
    setBpmState(clampBpm(value));
  }, []);

  const setBeatsPerMeasure = useCallback((value: number) => {
    if (![2, 3, 4, 6].includes(value)) return;
    setBeatsPerMeasureState(value);
    nextBeatRef.current = 0;
    setCurrentBeat(0);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stop();
      void audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [stop]);

  return {
    bpm,
    setBpm,
    beatsPerMeasure,
    setBeatsPerMeasure,
    currentBeat,
    isRunning,
    toggle,
  };
}
