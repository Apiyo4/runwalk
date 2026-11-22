import { NativeModule, requireOptionalNativeModule } from 'expo';

export type AudioEvent =
  | { type: 'interruptionBegan' }
  | { type: 'interruptionEnded' }
  | { type: 'routeChange' }
  | { type: 'error'; message: string };

type RunWalkAudioEvents = {
  onAudioEvent: (event: AudioEvent) => void;
};

declare class RunWalkAudioNative extends NativeModule<RunWalkAudioEvents> {
  startSession(): Promise<void>;
  stopSession(): Promise<void>;
  speak(text: string): Promise<void>;
  isSessionActive(): Promise<boolean>;
}

/**
 * Null in Expo Go, on web, and in Jest. The app runs without voice in that
 * case and shows a warning; build a development build to get the module.
 */
export const RunWalkAudio = requireOptionalNativeModule<RunWalkAudioNative>('RunWalkAudio');
