// src/hooks/useWorkout.ts
//
// Glue between the pure engine/announcer and the device:
//   * a 250 ms UI tick while running (only for display; timing comes from timestamps)
//   * an immediate recompute whenever the app returns to the foreground
//   * keep-awake on while running, off otherwise
//   * the native audio session on while running, off on pause/end/after the final cue

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { WorkoutSession } from '../config/c25kSchedule';
import { computeAnnouncements, initialAnnouncerState } from '../engine/announcer';
import {
  end, getProgress, initialEngineState, pause, resume, skipInterval, start, tick,
  type EngineState, type Progress,
} from '../engine/workoutEngine';
import { speak, startAudioSession, stopAudioSession } from '../audio/voice';

const KEEP_AWAKE_TAG = 'runwalk-workout';
const UI_TICK_MS = 250;

export interface UseWorkout {
  progress: Progress;
  status: EngineState['status'];
  keepAwake: boolean;
  start(): Promise<void>;
  pause(): void;
  resume(): Promise<void>;
  skip(): void;
  restart(): Promise<void>;
  end(): void;
}

export function useWorkout(session: WorkoutSession, onComplete: (sessionId: string) => void): UseWorkout {
  const [engine, setEngine] = useState<EngineState>(initialEngineState);
  const [now, setNow] = useState(() => Date.now());
  const engineRef = useRef(engine);
  const announcerRef = useRef(initialAnnouncerState);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  /** Single place where state changes land: updates UI, speaks cues, handles completion. */
  const commit = useCallback(
    (next: EngineState, t: number) => {
      engineRef.current = next;
      setEngine(next);
      setNow(t);

      // While paused, stay quiet. A skip made while paused is announced on
      // resume, because the announcer still sees that interval as unannounced.
      let spoken: Promise<void>[] = [];
      if (next.status !== 'paused') {
        const p = getProgress(session, next, t);
        const r = computeAnnouncements(session, p, announcerRef.current);
        announcerRef.current = r.state;
        spoken = r.cues.map((c) => speak(c));
      }

      if (next.status === 'completed' && !completedRef.current) {
        completedRef.current = true;
        onCompleteRef.current(session.id);
        // Release the audio session only after "Workout complete" has been spoken.
        Promise.all(spoken).finally(() => {
          if (engineRef.current.status !== 'running') stopAudioSession();
        });
      }
    },
    [session],
  );

  const step = useCallback(() => {
    const t = Date.now();
    const next = tick(session, engineRef.current, t);
    commit(next, t);
  }, [session, commit]);

  // UI tick while running.
  useEffect(() => {
    if (engine.status !== 'running') return;
    const id = setInterval(step, UI_TICK_MS);
    return () => clearInterval(id);
  }, [engine.status, step]);

  // Recompute immediately on returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && engineRef.current.status === 'running') step();
    });
    return () => sub.remove();
  }, [step]);

  // Keep-awake follows the Running state exactly.
  useEffect(() => {
    if (engine.status === 'running') {
      activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    } else {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    }
    if (engine.status === 'paused' || engine.status === 'idle') {
      stopAudioSession();
    }
  }, [engine.status]);

  // Clean up if the screen unmounts mid-workout.
  useEffect(
    () => () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
      stopAudioSession();
    },
    [],
  );

  const doStart = useCallback(async () => {
    // Session first, so the first cue is spoken on the configured session.
    await startAudioSession();
    announcerRef.current = initialAnnouncerState;
    completedRef.current = false;
    const t = Date.now();
    commit(start(engineRef.current, t), t);
  }, [commit]);

  const doPause = useCallback(() => {
    const t = Date.now();
    commit(pause(tick(session, engineRef.current, t), t), t);
  }, [session, commit]);

  const doResume = useCallback(async () => {
    await startAudioSession();
    const t = Date.now();
    commit(resume(engineRef.current, t), t);
  }, [commit]);

  const doSkip = useCallback(() => {
    const t = Date.now();
    commit(skipInterval(session, engineRef.current, t), t);
  }, [session, commit]);

  const doEnd = useCallback(() => {
    announcerRef.current = initialAnnouncerState;
    completedRef.current = false;
    commit(end(engineRef.current), Date.now());
  }, [commit]);

  // Restart goes straight from running/paused/completed to a fresh run.
  // It deliberately does not pass through idle: the idle effect would stop
  // the audio session right after doStart started it.
  const doRestart = doStart;

  return {
    progress: getProgress(session, engine, now),
    status: engine.status,
    keepAwake: engine.status === 'running',
    start: doStart,
    pause: doPause,
    resume: doResume,
    skip: doSkip,
    restart: doRestart,
    end: doEnd,
  };
}
