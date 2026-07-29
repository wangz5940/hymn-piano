import { useCallback, useEffect, useRef, useState } from "react";

export interface MidiState {
  supported: boolean;
  permission: "idle" | "requesting" | "granted" | "denied";
  devices: Array<{ id: string; name: string }>;
  active_notes: number[];
}

export function useMidi() {
  const supported = typeof navigator.requestMIDIAccess === "function";
  const [state, setState] = useState<MidiState>({
    supported,
    permission: "idle",
    devices: [],
    active_notes: [],
  });
  const accessRef = useRef<MIDIAccess | null>(null);

  const refreshDevices = useCallback(() => {
    const access = accessRef.current;
    if (!access) return;
    const inputs = Array.from(access.inputs.values());
    setState((current) => ({
      ...current,
      devices: inputs.map((input) => ({
        id: input.id,
        name: input.name?.trim() || "未命名 MIDI 设备",
      })),
    }));
  }, []);

  const connect = useCallback(async () => {
    if (!supported) return;
    setState((current) => ({ ...current, permission: "requesting" }));
    try {
      const access = await navigator.requestMIDIAccess();
      accessRef.current = access;
      access.onstatechange = refreshDevices;
      for (const input of access.inputs.values()) {
        input.onmidimessage = (event: MIDIMessageEvent) => {
          if (!event.data) return;
          const [status = 0, note = 0, velocity = 0] = event.data;
          const command = status & 0xf0;
          setState((current) => {
            const notes = new Set(current.active_notes);
            if (command === 0x90 && velocity > 0) notes.add(note);
            if (command === 0x80 || (command === 0x90 && velocity === 0)) {
              notes.delete(note);
            }
            return { ...current, active_notes: [...notes].sort((a, b) => a - b) };
          });
        };
      }
      setState((current) => ({ ...current, permission: "granted" }));
      refreshDevices();
    } catch {
      setState((current) => ({ ...current, permission: "denied" }));
    }
  }, [refreshDevices, supported]);

  useEffect(
    () => () => {
      const access = accessRef.current;
      if (!access) return;
      access.onstatechange = null;
      for (const input of access.inputs.values()) {
        input.onmidimessage = null;
      }
    },
    [],
  );

  return { ...state, connect };
}
