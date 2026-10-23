/** Minimal shape of the speech recognition object we use (not every TS lib ships these types). */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

/** Web Speech API recognition constructor, or undefined when the browser lacks it. */
export function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => SpeechRecognitionLike) | undefined;
}

/** Joins the final transcripts from a recognition result event. Interim text is ignored. */
export function finalTranscript(event: { resultIndex: number; results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }): string {
  let out = '';
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const r = event.results[i];
    if (r.isFinal) out += r[0].transcript;
  }
  return out.trim();
}

export function speechSynthesisAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
