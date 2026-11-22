import type { WorkoutSession } from '../../config/c25kSchedule';
import {
  COMPLETE_CUE, HALFWAY_CUE, computeAnnouncements, initialAnnouncerState, resyncCue, spokenRemaining,
  type AnnouncerState,
} from '../announcer';
import { getProgress, initialEngineState, pause, resume, skipInterval, start, tick, type EngineState } from '../workoutEngine';

const session: WorkoutSession = {
  id: 't', week: 1, run: 1, title: 'T', description: '',
  intervals: [
    { type: 'warmup', durationSeconds: 30, cue: 'warm' },
    { type: 'run', durationSeconds: 60, cue: 'run' },
    { type: 'walk', durationSeconds: 90, cue: 'walk' },
    { type: 'run', durationSeconds: 60, cue: 'run2' },
    { type: 'cooldown', durationSeconds: 60, cue: 'cool' },
  ],
}; // total 300s, halfway at 150s (inside the walk)
const T0 = 5_000_000;
const sec = (n: number) => T0 + n * 1000;

/** Simulates the app's tick loop: ticks at the given seconds, collects all spoken cues. */
function simulate(times: number[], engine: EngineState = start(initialEngineState, T0)) {
  let a: AnnouncerState = initialAnnouncerState;
  let s = engine;
  const spoken: string[][] = [];
  for (const t of times) {
    s = tick(session, s, sec(t));
    const r = computeAnnouncements(session, getProgress(session, s, sec(t)), a);
    a = r.state;
    spoken.push(r.cues);
  }
  return { spoken, a, s };
}

describe('announcer', () => {
  it('announces each interval exactly once with frequent ticks', () => {
    const times = Array.from({ length: 1201 }, (_, i) => i * 0.25); // 4 Hz for 300 s
    const all = simulate(times).spoken.flat();
    expect(all).toEqual(['warm', 'run', 'walk', HALFWAY_CUE, 'run2', 'cool', COMPLETE_CUE]);
  });

  it('never repeats a cue on repeated ticks at the same time', () => {
    const { spoken } = simulate([0, 0, 0, 0.1, 0.2]);
    expect(spoken.flat()).toEqual(['warm']);
  });

  it('after a long background gap speaks ONE resync cue, not the backlog', () => {
    // Ticks stop at 1s, resume at 200s (inside run2, which started at 180s).
    const { spoken } = simulate([0, 1, 200]);
    expect(spoken[2]).toEqual([resyncCue('run', 40_000)]);
    expect(spoken[2]).not.toContain('run');
    expect(spoken[2]).not.toContain('walk');
    expect(spoken[2]).not.toContain(HALFWAY_CUE); // stale halfway is dropped silently
  });

  it('a small delay still counts as fresh and uses the normal cue', () => {
    const { spoken } = simulate([0, 32]); // run started at 30s, we are 2s late
    expect(spoken[1]).toEqual(['run']);
  });

  it('returning after the workout ended speaks only the completion cue', () => {
    const { spoken, s } = simulate([0, 5000]);
    expect(s.status).toBe('completed');
    expect(spoken[1]).toEqual([COMPLETE_CUE]);
  });

  it('skip produces the next cue immediately', () => {
    let s = start(initialEngineState, T0);
    let a = computeAnnouncements(session, getProgress(session, s, sec(0)), initialAnnouncerState).state;
    s = skipInterval(session, s, sec(5));
    const r = computeAnnouncements(session, getProgress(session, s, sec(5)), a);
    expect(r.cues).toEqual(['run']);
  });

  it('pause/resume does not re-announce the current interval', () => {
    let s = start(initialEngineState, T0);
    let a = computeAnnouncements(session, getProgress(session, s, sec(0)), initialAnnouncerState).state;
    s = pause(s, sec(10));
    a = computeAnnouncements(session, getProgress(session, s, sec(60)), a).state;
    s = resume(s, sec(120));
    const r = computeAnnouncements(session, getProgress(session, s, sec(121)), a);
    expect(r.cues).toEqual([]);
  });

  it('resets when idle', () => {
    const r = computeAnnouncements(session, getProgress(session, initialEngineState, T0), {
      lastIndex: 3, halfwayHandled: true, completeHandled: true,
    });
    expect(r.state).toEqual(initialAnnouncerState);
  });

  it('formats remaining time for speech', () => {
    expect(spokenRemaining(1_000)).toBe('1 second');
    expect(spokenRemaining(42_400)).toBe('42 seconds');
    expect(spokenRemaining(60_000)).toBe('1 minute');
    expect(spokenRemaining(150_000)).toBe('2 minutes 30 seconds');
    expect(resyncCue('cooldown', 90_000)).toBe('Cool-down walk. 1 minute 30 seconds left.');
  });
});

describe('announcer + engine: skip while paused', () => {
  it('announces the skipped-to interval once, on resume', () => {
    let s = start(initialEngineState, T0);
    let a = computeAnnouncements(session, getProgress(session, s, sec(0)), initialAnnouncerState).state;
    s = pause(s, sec(5));
    s = skipInterval(session, s, sec(8)); // hook does not announce while paused
    s = resume(s, sec(20));
    const r1 = computeAnnouncements(session, getProgress(session, s, sec(20)), a);
    expect(r1.cues).toEqual(['run']);
    const r2 = computeAnnouncements(session, getProgress(session, s, sec(20.25)), r1.state);
    expect(r2.cues).toEqual([]);
  });
});
