// src/engine/workoutEngine.ts
//
// Pure, framework-free workout state machine.
//
// Design rule: the engine never counts ticks. It stores a few timestamps and
// derives everything (current interval, countdown, remaining) from "now".
// A tick that arrives late, or a JS thread that was paused for 40 seconds,
// cannot cause drift: the next computation simply sees a later "now".

import type { WorkoutInterval, WorkoutSession } from '../config/c25kSchedule';

export type WorkoutStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface EngineState {
  status: WorkoutStatus;
  /** Clock time when Start was pressed. */
  startedAtMs: number | null;
  /** Clock time when the current pause began (only while paused). */
  pausedAtMs: number | null;
  /** Sum of all finished pauses. */
  totalPausedMs: number;
  /** Time credited by Skip Interval. */
  skippedMs: number;
}

export interface Progress {
  status: WorkoutStatus;
  totalMs: number;
  elapsedMs: number;
  remainingMs: number;
  /** Index of the current interval. -1 when idle. intervals.length when completed. */
  index: number;
  current: WorkoutInterval | null;
  next: WorkoutInterval | null;
  intervalElapsedMs: number;
  intervalRemainingMs: number;
}

export const initialEngineState: EngineState = {
  status: 'idle',
  startedAtMs: null,
  pausedAtMs: null,
  totalPausedMs: 0,
  skippedMs: 0,
};

/** Start offsets of every interval, plus the total at the end. Length = intervals + 1. */
export function intervalOffsetsMs(session: WorkoutSession): number[] {
  const out = [0];
  for (const i of session.intervals) out.push(out[out.length - 1] + i.durationSeconds * 1000);
  return out;
}

export function totalMs(session: WorkoutSession): number {
  const o = intervalOffsetsMs(session);
  return o[o.length - 1];
}

/** Raw elapsed workout time, clamped to [0, total]. */
export function elapsedMs(session: WorkoutSession, s: EngineState, now: number): number {
  if (s.status === 'idle' || s.startedAtMs === null) return 0;
  const total = totalMs(session);
  if (s.status === 'completed') return total;
  const reference = s.status === 'paused' && s.pausedAtMs !== null ? s.pausedAtMs : now;
  const raw = reference - s.startedAtMs - s.totalPausedMs + s.skippedMs;
  return Math.min(total, Math.max(0, raw));
}

export function getProgress(session: WorkoutSession, s: EngineState, now: number): Progress {
  const offsets = intervalOffsetsMs(session);
  const total = offsets[offsets.length - 1];
  const n = session.intervals.length;

  if (s.status === 'idle') {
    return {
      status: 'idle', totalMs: total, elapsedMs: 0, remainingMs: total, index: -1,
      current: null, next: session.intervals[0] ?? null,
      intervalElapsedMs: 0, intervalRemainingMs: (session.intervals[0]?.durationSeconds ?? 0) * 1000,
    };
  }

  const elapsed = elapsedMs(session, s, now);
  if (s.status === 'completed' || elapsed >= total) {
    return {
      status: s.status === 'completed' ? 'completed' : s.status, totalMs: total, elapsedMs: total,
      remainingMs: 0, index: n, current: null, next: null, intervalElapsedMs: 0, intervalRemainingMs: 0,
    };
  }

  // Last offset <= elapsed. Intervals are few (< 25), so a linear scan is fine.
  let index = 0;
  while (index < n - 1 && offsets[index + 1] <= elapsed) index++;

  return {
    status: s.status,
    totalMs: total,
    elapsedMs: elapsed,
    remainingMs: total - elapsed,
    index,
    current: session.intervals[index],
    next: session.intervals[index + 1] ?? null,
    intervalElapsedMs: elapsed - offsets[index],
    intervalRemainingMs: offsets[index + 1] - elapsed,
  };
}

// ---------- Transitions (all pure, all take "now") ----------

export function start(_s: EngineState, now: number): EngineState {
  return { ...initialEngineState, status: 'running', startedAtMs: now };
}

export function pause(s: EngineState, now: number): EngineState {
  if (s.status !== 'running') return s;
  return { ...s, status: 'paused', pausedAtMs: now };
}

export function resume(s: EngineState, now: number): EngineState {
  if (s.status !== 'paused' || s.pausedAtMs === null) return s;
  return { ...s, status: 'running', pausedAtMs: null, totalPausedMs: s.totalPausedMs + (now - s.pausedAtMs) };
}

/** Jump to the start of the next interval. Works while running or paused. */
export function skipInterval(session: WorkoutSession, s: EngineState, now: number): EngineState {
  if (s.status !== 'running' && s.status !== 'paused') return s;
  const p = getProgress(session, s, now);
  if (p.index < 0 || p.index >= session.intervals.length) return s;
  const next: EngineState = { ...s, skippedMs: s.skippedMs + p.intervalRemainingMs };
  // Skipping the last interval finishes the workout, even from paused.
  if (p.elapsedMs + p.intervalRemainingMs >= p.totalMs) {
    return { ...next, status: 'completed', pausedAtMs: null };
  }
  return next;
}

/** Moves running -> completed once time is up. Call on every UI tick and on app foreground. */
export function tick(session: WorkoutSession, s: EngineState, now: number): EngineState {
  if (s.status !== 'running') return s;
  return elapsedMs(session, s, now) >= totalMs(session) ? { ...s, status: 'completed' } : s;
}

/** End early. Returns to idle; the caller decides whether anything is saved (it is not). */
export function end(_s: EngineState): EngineState {
  return initialEngineState;
}
