import type { WorkoutInterval } from '../config/c25kSchedule';
import { intervalLabels } from './theme';

/** Countdown display: rounds up so "0:00" only shows when time is truly up. */
export function clock(ms: number, roundUp = true): string {
  const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function shortDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec % 60 === 0) return `${sec / 60} min`;
  return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

export function upNextLabel(i: WorkoutInterval | null): string {
  if (!i) return 'Next: Finish';
  const name = intervalLabels[i.type].toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return `Next: ${shortDuration(i.durationSeconds)} ${name}`;
}
