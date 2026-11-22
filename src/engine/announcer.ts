// src/engine/announcer.ts
//
// Decides what to say, given the latest Progress. Pure and deterministic.
//
// Rules:
//  * At most ONE interval cue per call, even if several intervals passed while
//    the JS thread was asleep. No batched backlog of stale cues.
//  * A cue is "fresh" if the interval started less than `staleMs` ago. Fresh
//    intervals get their configured cue ("Walk for 90 seconds.").
//  * If we arrive late (app was suspended, phone call, etc.), we speak a single
//    resync cue instead: "Walk. 52 seconds left."
//  * Halfway is spoken once, only if fresh. Completion is spoken once.

import type { IntervalType, WorkoutSession } from '../config/c25kSchedule';
import type { Progress } from './workoutEngine';

export interface AnnouncerState {
  /** Highest interval index already announced. -1 before start. */
  lastIndex: number;
  halfwayHandled: boolean;
  completeHandled: boolean;
}

export const initialAnnouncerState: AnnouncerState = {
  lastIndex: -1,
  halfwayHandled: false,
  completeHandled: false,
};

export const DEFAULT_STALE_MS = 4000;

export const HALFWAY_CUE = 'Halfway there.';
export const COMPLETE_CUE = 'Workout complete. Great job.';

const LABEL: Record<IntervalType, string> = {
  warmup: 'Warm-up walk',
  run: 'Run',
  walk: 'Walk',
  cooldown: 'Cool-down walk',
};

export function spokenRemaining(ms: number): string {
  const sec = Math.max(1, Math.round(ms / 1000));
  if (sec < 60) return `${sec} ${sec === 1 ? 'second' : 'seconds'}`;
  const m = Math.floor(sec / 60);
  const r = sec % 60;
  const mins = `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  return r === 0 ? mins : `${mins} ${r} seconds`;
}

export function resyncCue(type: IntervalType, remainingMs: number): string {
  return `${LABEL[type]}. ${spokenRemaining(remainingMs)} left.`;
}

export interface AnnounceResult {
  cues: string[];
  state: AnnouncerState;
}

export function computeAnnouncements(
  session: WorkoutSession,
  p: Progress,
  a: AnnouncerState,
  staleMs = DEFAULT_STALE_MS,
): AnnounceResult {
  const cues: string[] = [];
  let next = a;

  if (p.status === 'idle') return { cues, state: initialAnnouncerState };

  if (p.status === 'completed' || p.index >= session.intervals.length) {
    if (!a.completeHandled) {
      cues.push(COMPLETE_CUE);
      next = { lastIndex: session.intervals.length, halfwayHandled: true, completeHandled: true };
    }
    return { cues, state: next };
  }

  // Interval cue
  if (p.index > a.lastIndex && p.current) {
    const fresh = p.intervalElapsedMs <= staleMs;
    cues.push(fresh ? p.current.cue : resyncCue(p.current.type, p.intervalRemainingMs));
    next = { ...next, lastIndex: p.index };
  }

  // Halfway cue. Spoken after any interval cue from the same tick (Week 1's
  // halfway point lands exactly on a run start). Skipped for sessions under a
  // minute, where it would crowd out interval cues.
  const half = p.totalMs / 2;
  if (!next.halfwayHandled && p.elapsedMs >= half) {
    const fresh = p.elapsedMs - half <= staleMs;
    if (fresh && p.totalMs >= 60_000) cues.push(HALFWAY_CUE);
    next = { ...next, halfwayHandled: true };
  }

  return { cues, state: next };
}
