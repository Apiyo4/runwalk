// src/audio/voice.ts
//
// Thin JS facade over the native RunWalkAudio module. Every call is safe to
// make without the native module (Expo Go, web, Jest): it logs instead.

import { RunWalkAudio, type AudioEvent } from '../../modules/runwalk-audio';

export const voiceAvailable = RunWalkAudio != null;

export async function startAudioSession(): Promise<void> {
  try {
    await RunWalkAudio?.startSession();
  } catch (e) {
    console.warn('[voice] startSession failed', e);
  }
}

export async function stopAudioSession(): Promise<void> {
  try {
    await RunWalkAudio?.stopSession();
  } catch (e) {
    console.warn('[voice] stopSession failed', e);
  }
}

/** Resolves when the cue has finished (or failed). Never rejects. */
export function speak(text: string): Promise<void> {
  if (!RunWalkAudio) {
    console.log('[voice]', text);
    return Promise.resolve();
  }
  return RunWalkAudio.speak(text).catch((e) => console.warn('[voice] speak failed', e));
}

export function addAudioEventListener(fn: (e: AudioEvent) => void): { remove(): void } {
  if (!RunWalkAudio) return { remove() {} };
  return RunWalkAudio.addListener('onAudioEvent', fn);
}
