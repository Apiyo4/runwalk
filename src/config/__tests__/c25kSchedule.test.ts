import {
  C25K_PROGRAM, getTotalDurationSeconds, spokenDuration, toFastTestSession, type WorkoutSession,
} from '../c25kSchedule';

const main = (s: WorkoutSession) => s.intervals.slice(1, -1);
const sum = (s: WorkoutSession, type?: string) =>
  main(s).filter((i) => !type || i.type === type).reduce((n, i) => n + i.durationSeconds, 0);
const byId = (id: string) => C25K_PROGRAM.find((s) => s.id === id)!;

describe('C25K program', () => {
  it('has 27 sessions with unique ids, 3 per week', () => {
    expect(C25K_PROGRAM).toHaveLength(27);
    expect(new Set(C25K_PROGRAM.map((s) => s.id)).size).toBe(27);
    for (let w = 1; w <= 9; w++) {
      expect(C25K_PROGRAM.filter((s) => s.week === w).map((s) => s.run)).toEqual([1, 2, 3]);
    }
  });

  it('every session is warm-up, main set, cool-down', () => {
    for (const s of C25K_PROGRAM) {
      expect(s.intervals[0]).toMatchObject({ type: 'warmup', durationSeconds: 300 });
      expect(s.intervals[s.intervals.length - 1]).toMatchObject({ type: 'cooldown', durationSeconds: 300 });
      for (const i of s.intervals) {
        expect(i.durationSeconds).toBeGreaterThan(0);
        expect(i.cue.length).toBeGreaterThan(0);
      }
    }
  });

  it('week 1 is 8 x (60s run + 90s walk) = 20 minutes', () => {
    const s = byId('w1-r1');
    expect(sum(s)).toBe(1200);
    expect(main(s).filter((i) => i.type === 'run')).toHaveLength(8);
    expect(main(s).filter((i) => i.type === 'walk')).toHaveLength(8);
    expect(getTotalDurationSeconds(s)).toBe(1800);
  });

  it('week 2 is 6 x (90s run + 2 min walk) = 21 minutes', () => {
    expect(sum(byId('w2-r2'))).toBe(1260);
    expect(sum(byId('w2-r2'), 'run')).toBe(540);
  });

  it('matches NHS run totals for the later weeks', () => {
    const runMinutes: Record<string, number> = {
      'w3-r1': 9, 'w4-r1': 16, 'w5-r1': 15, 'w5-r2': 16, 'w5-r3': 20,
      'w6-r1': 18, 'w6-r2': 20, 'w6-r3': 25, 'w7-r1': 25, 'w8-r1': 28, 'w9-r3': 30,
    };
    for (const [id, m] of Object.entries(runMinutes)) expect(sum(byId(id), 'run')).toBe(m * 60);
  });

  it('runs alternate with walks (no two adjacent intervals of the same type)', () => {
    for (const s of C25K_PROGRAM) {
      for (let i = 1; i < s.intervals.length; i++) {
        expect(s.intervals[i].type).not.toBe(s.intervals[i - 1].type);
      }
    }
  });

  it('formats spoken durations', () => {
    expect(spokenDuration(60)).toBe('1 minute');
    expect(spokenDuration(90)).toBe('90 seconds');
    expect(spokenDuration(120)).toBe('2 minutes');
    expect(spokenDuration(150)).toBe('2 and a half minutes');
  });

  it('fast test session keeps id and cues', () => {
    const f = toFastTestSession(byId('w1-r1'));
    expect(f.id).toBe('w1-r1');
    expect(f.intervals.every((i) => i.durationSeconds === 6)).toBe(true);
    expect(f.intervals[1].cue).toBe(byId('w1-r1').intervals[1].cue);
  });
});
