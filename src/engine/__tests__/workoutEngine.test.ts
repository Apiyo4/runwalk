import { toFastTestSession, type WorkoutSession } from '../../config/c25kSchedule';
import {
  end, getProgress, initialEngineState, pause, resume, skipInterval, start, tick, totalMs,
  type EngineState,
} from '../workoutEngine';

const session: WorkoutSession = {
  id: 't', week: 1, run: 1, title: 'T', description: '',
  intervals: [
    { type: 'warmup', durationSeconds: 10, cue: 'warm' },
    { type: 'run', durationSeconds: 20, cue: 'run' },
    { type: 'walk', durationSeconds: 30, cue: 'walk' },
    { type: 'cooldown', durationSeconds: 10, cue: 'cool' },
  ],
};
const T0 = 1_000_000;
const sec = (n: number) => T0 + n * 1000;

describe('workout engine', () => {
  it('idle shows the first interval as Up Next', () => {
    const p = getProgress(session, initialEngineState, T0);
    expect(p.status).toBe('idle');
    expect(p.index).toBe(-1);
    expect(p.next?.type).toBe('warmup');
    expect(p.remainingMs).toBe(70_000);
  });

  it('derives interval and countdown from timestamps only', () => {
    const s = start(initialEngineState, T0);
    let p = getProgress(session, s, sec(0));
    expect(p.index).toBe(0);
    expect(p.intervalRemainingMs).toBe(10_000);

    p = getProgress(session, s, sec(15));
    expect(p.current?.type).toBe('run');
    expect(p.intervalElapsedMs).toBe(5_000);
    expect(p.intervalRemainingMs).toBe(15_000);
    expect(p.next?.type).toBe('walk');
    expect(p.elapsedMs).toBe(15_000);
    expect(p.remainingMs).toBe(55_000);
  });

  it('boundary belongs to the next interval', () => {
    const s = start(initialEngineState, T0);
    expect(getProgress(session, s, sec(10)).current?.type).toBe('run');
    expect(getProgress(session, s, sec(9.999)).current?.type).toBe('warmup');
  });

  it('has no drift when ticks are missed (app backgrounded for 45s)', () => {
    let s = start(initialEngineState, T0);
    s = tick(session, s, sec(1));
    // No ticks between 1s and 46s.
    s = tick(session, s, sec(46));
    const p = getProgress(session, s, sec(46));
    expect(p.current?.type).toBe('walk');
    expect(p.intervalElapsedMs).toBe(16_000);
  });

  it('pause freezes time and resume excludes the paused span', () => {
    let s: EngineState = start(initialEngineState, T0);
    s = pause(s, sec(12));
    expect(getProgress(session, s, sec(100)).elapsedMs).toBe(12_000);
    s = resume(s, sec(100));
    expect(getProgress(session, s, sec(103)).elapsedMs).toBe(15_000);
    // Second pause accumulates.
    s = pause(s, sec(105));
    s = resume(s, sec(205));
    expect(getProgress(session, s, sec(206)).elapsedMs).toBe(18_000);
  });

  it('ignores invalid transitions', () => {
    const idle = initialEngineState;
    expect(pause(idle, T0)).toBe(idle);
    expect(resume(idle, T0)).toBe(idle);
    const running = start(idle, T0);
    expect(resume(running, sec(1))).toBe(running);
    expect(skipInterval(session, idle, T0)).toBe(idle);
  });

  it('completes on tick when time is up, and clamps elapsed', () => {
    let s = start(initialEngineState, T0);
    s = tick(session, s, sec(69));
    expect(s.status).toBe('running');
    s = tick(session, s, sec(500));
    expect(s.status).toBe('completed');
    const p = getProgress(session, s, sec(900));
    expect(p.elapsedMs).toBe(70_000);
    expect(p.remainingMs).toBe(0);
    expect(p.current).toBeNull();
  });

  it('skip jumps to the start of the next interval', () => {
    let s = start(initialEngineState, T0);
    s = skipInterval(session, s, sec(3));
    let p = getProgress(session, s, sec(3));
    expect(p.current?.type).toBe('run');
    expect(p.intervalElapsedMs).toBe(0);
    // Time keeps flowing normally after a skip.
    p = getProgress(session, s, sec(8));
    expect(p.intervalElapsedMs).toBe(5_000);
  });

  it('skip while paused stays paused at the next interval start', () => {
    let s = start(initialEngineState, T0);
    s = pause(s, sec(5));
    s = skipInterval(session, s, sec(50));
    expect(s.status).toBe('paused');
    const p = getProgress(session, s, sec(60));
    expect(p.current?.type).toBe('run');
    expect(p.intervalElapsedMs).toBe(0);
  });

  it('skipping the last interval completes the workout', () => {
    let s = start(initialEngineState, T0);
    s = skipInterval(session, s, sec(65));
    expect(s.status).toBe('completed');
    s = start(initialEngineState, T0);
    s = pause(s, sec(65));
    s = skipInterval(session, s, sec(70));
    expect(s.status).toBe('completed');
  });

  it('end and restart reset cleanly', () => {
    let s = start(initialEngineState, T0);
    s = pause(s, sec(10));
    expect(end(s)).toEqual(initialEngineState);
    s = start(s, sec(50));
    expect(s.totalPausedMs).toBe(0);
    expect(getProgress(session, s, sec(51)).elapsedMs).toBe(1_000);
  });

  it('fast test mode compresses every interval', () => {
    const fast = toFastTestSession(session, 5);
    expect(totalMs(fast)).toBe(20_000);
    expect(fast.id).toBe(session.id);
  });
});
