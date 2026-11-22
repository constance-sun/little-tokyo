/* Optional bridge to the host runtime the original site ran inside (Claude artifacts):
   window.claude.use("db" | "user" | "sample" | "dictation"). On a normal web host these are
   all absent and every feature falls back (device-only storage, offline planner, browser speech). */

/* eslint-disable @typescript-eslint/no-explicit-any */
export type ClaudeDB = any;
export type ClaudeUser = any;
export type ClaudeSample = { json: (turns: { role: string; content: string }[], opts?: any) => Promise<any> };

export interface Dictation {
  start(): Promise<void>;
  stop(): Promise<void>;
  onPartial(f: (e: { text: string }) => void): void;
  onFinal(f: (e: { text: string }) => void): void;
  onState(f: (e: { state: string; reason?: string }) => void): void;
}

const host = () => (typeof window !== "undefined" ? (window as any).claude : undefined);

export async function getHost<T = any>(name: string): Promise<T | null> {
  try {
    const c = host();
    return c ? ((await c.use(name)) as T) : null;
  } catch {
    return null;
  }
}

/** Browser speech recognition (Chrome, Safari, Edge) with the same interface as the host dictation. */
export function browserDictation(): Dictation | null {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  let rec: any = null;
  let state = "idle";
  const H = { p: [] as ((e: { text: string }) => void)[], f: [] as ((e: { text: string }) => void)[], s: [] as ((e: { state: string; reason?: string }) => void)[] };
  const setState = (st: string, reason?: string) => {
    state = st;
    H.s.forEach((f) => f({ state: st, reason }));
  };
  return {
    start() {
      return new Promise<void>((res, rej) => {
        try {
          rec = new SR();
          rec.lang = navigator.language || "en-US";
          rec.interimResults = true;
          rec.continuous = true;
          rec.onstart = () => { setState("listening"); res(); };
          rec.onresult = (e: any) => {
            let interim = "";
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const r = e.results[i];
              if (r.isFinal) H.f.forEach((f) => f({ text: r[0].transcript }));
              else interim += r[0].transcript;
            }
            H.p.forEach((f) => f({ text: interim }));
          };
          rec.onerror = (ev: any) => { setState("idle", ev.error); rej({ code: ev.error === "not-allowed" ? "not_granted" : "stopped" }); };
          rec.onend = () => setState("idle", "stopped");
          setState("starting");
          rec.start();
        } catch {
          rej({ code: "unavailable" });
        }
      });
    },
    stop() {
      return new Promise<void>((res) => {
        if (!rec || state === "idle") { res(); return; }
        setState("finishing");
        rec.onend = () => { setState("idle", "stopped"); res(); };
        rec.stop();
      });
    },
    onPartial(f) { H.p.push(f); },
    onFinal(f) { H.f.push(f); },
    onState(f) { H.s.push(f); },
  };
}
