// src/config/c25kSchedule.ts
//
// The 9-week Couch-to-5K plan, modeled on the NHS Couch to 5K progression.
// Edit this file to change the program. Everything else in the app derives
// from these definitions (durations, cues, Up Next labels, progress ids).

export type IntervalType = 'warmup' | 'run' | 'walk' | 'cooldown';

export interface WorkoutInterval {
  type: IntervalType;
  durationSeconds: number;
  /** Spoken when this interval starts. */
  cue: string;
}

export interface WorkoutSession {
  /** Stable id used for saved progress, e.g. "w1-r1". Do not rename once shipped. */
  id: string;
  week: number;
  run: number;
  title: string;
  description: string;
  intervals: WorkoutInterval[];
}

const WARMUP: WorkoutInterval = {
  type: 'warmup',
  durationSeconds: 300,
  cue: 'Start your 5-minute brisk warm-up walk.',
};

const COOLDOWN: WorkoutInterval = {
  type: 'cooldown',
  durationSeconds: 300,
  cue: 'Start your 5-minute cool-down walk.',
};

/** "60" -> "1 minute", "90" -> "90 seconds", "150" -> "2 and a half minutes". */
export function spokenDuration(sec: number): string {
  if (sec % 60 === 0) {
    const m = sec / 60;
    return `${m} ${m === 1 ? 'minute' : 'minutes'}`;
  }
  if (sec > 120 && sec % 30 === 0) {
    return `${Math.floor(sec / 60)} and a half minutes`;
  }
  return `${sec} seconds`;
}

function run(sec: number, cue = `Run for ${spokenDuration(sec)}.`): WorkoutInterval {
  return { type: 'run', durationSeconds: sec, cue };
}

function walk(sec: number, cue = `Walk for ${spokenDuration(sec)}.`): WorkoutInterval {
  return { type: 'walk', durationSeconds: sec, cue };
}

function finalRun(sec: number): WorkoutInterval {
  return run(sec, `Final run! ${spokenDuration(sec)}.`);
}

/**
 * `cycles` full run+walk pairs. Every pair keeps its walk, so the block length
 * is exactly cycles * (run + walk). The last run gets the "Final run!" cue.
 */
function runWalkCycles(cycles: number, runSec: number, walkSec: number): WorkoutInterval[] {
  const result: WorkoutInterval[] = [];
  for (let i = 0; i < cycles; i++) {
    const last = i === cycles - 1;
    result.push(last ? finalRun(runSec) : run(runSec, `Start running for ${spokenDuration(runSec)}.`));
    result.push(walk(walkSec));
  }
  return result;
}

function session(week: number, runNo: number, description: string, main: WorkoutInterval[]): WorkoutSession {
  return {
    id: `w${week}-r${runNo}`,
    week,
    run: runNo,
    title: `Week ${week} • Run ${runNo}`,
    description,
    intervals: [WARMUP, ...main, COOLDOWN],
  };
}

/** Same workout for all three runs of a week. */
function sameEachRun(week: number, description: (runNo: number) => string, main: () => WorkoutInterval[]): WorkoutSession[] {
  return [1, 2, 3].map((r) => session(week, r, description(r), main()));
}

export const C25K_PROGRAM: WorkoutSession[] = [
  // Week 1: 8 x (60s run + 90s walk) = 20 min
  ...sameEachRun(1, () => 'Alternate 60s run and 90s walk (8 cycles, 20 minutes).', () => runWalkCycles(8, 60, 90)),

  // Week 2: 6 x (90s run + 2 min walk) = 21 min
  ...sameEachRun(2, () => 'Alternate 90s run and 2-minute walk (6 cycles, 21 minutes).', () => runWalkCycles(6, 90, 120)),

  // Week 3: 2 x (90s run, 90s walk, 3 min run, 3 min walk)
  ...sameEachRun(3, () => 'Two sets of: 90s run, 90s walk, 3-min run, 3-min walk.', () => [
    run(90), walk(90), run(180), walk(180),
    run(90), walk(90), finalRun(180), walk(180),
  ]),

  // Week 4
  ...sameEachRun(4, () => '3m run, 90s walk, 5m run, 2.5m walk, 3m run, 90s walk, 5m run.', () => [
    run(180), walk(90), run(300), walk(150),
    run(180), walk(90), finalRun(300),
  ]),

  // Week 5: three different runs
  session(5, 1, 'Three 5-minute runs with 3-minute walks in between.', [
    run(300), walk(180), run(300), walk(180), finalRun(300),
  ]),
  session(5, 2, 'Two 8-minute runs with a 5-minute walk in between.', [
    run(480), walk(300), finalRun(480),
  ]),
  session(5, 3, 'Milestone: your first continuous 20-minute run!', [
    run(1200, 'Start your continuous 20-minute run. Pace yourself!'),
  ]),

  // Week 6: three different runs
  session(6, 1, '5m run, 3m walk, 8m run, 3m walk, 5m run.', [
    run(300), walk(180), run(480), walk(180), finalRun(300),
  ]),
  session(6, 2, 'Two 10-minute runs with a 3-minute walk in between.', [
    run(600), walk(180), finalRun(600),
  ]),
  session(6, 3, 'Continuous 25-minute run.', [
    run(1500, 'Start your continuous 25-minute run.'),
  ]),

  // Weeks 7 to 9: continuous runs
  ...sameEachRun(7, () => 'Continuous 25-minute run.', () => [run(1500, 'Start your 25-minute run.')]),
  ...sameEachRun(8, () => 'Continuous 28-minute run.', () => [run(1680, 'Start your 28-minute run.')]),
  ...sameEachRun(
    9,
    (r) => (r === 3 ? 'Graduation run: continuous 30-minute run!' : 'Continuous 30-minute run.'),
    () => [run(1800, 'Start your 30-minute run. You have got this!')],
  ),
];

export function getSessionById(id: string): WorkoutSession | undefined {
  return C25K_PROGRAM.find((s) => s.id === id);
}

export function getTotalDurationSeconds(s: WorkoutSession): number {
  return s.intervals.reduce((sum, i) => sum + i.durationSeconds, 0);
}

/** Default seconds per interval in Fast Test Mode. Long enough for a cue to finish. */
export const FAST_TEST_SECONDS = 6;

/**
 * Compresses every interval to `seconds` for rapid on-device testing.
 * Keeps the real id so a test completion maps to the real session,
 * and keeps the real cue text so you hear exactly what a real run says.
 */
export function toFastTestSession(s: WorkoutSession, seconds = FAST_TEST_SECONDS): WorkoutSession {
  return {
    ...s,
    title: `[TEST] ${s.title}`,
    intervals: s.intervals.map((i) => ({ ...i, durationSeconds: seconds })),
  };
}
