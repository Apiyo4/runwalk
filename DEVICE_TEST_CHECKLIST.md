# Physical device test checklist (iPhone)

Use a Release build (`npx expo run:ios --device --configuration Release`) for the outdoor steps. Wired or Bluetooth headphones recommended. Tick each box; note the iOS version and YouTube version at the top.

iOS version: ______  YouTube version: ______  Premium (background/PiP): yes / no

## A. Setup

- [ ] A1. Phone volume at a normal listening level; ring/silent switch set to **silent** (cues should still play).
- [ ] A2. Open RunWalk. No yellow "Voice cues need a development build" banner on Home.
- [ ] A3. Home shows "Week 1 • Run 1" (or your next run) with completed runs ticked in the grid.
- [ ] A4. Tap a different run tile (e.g. Week 5 Run 3). Hero card updates. Tap back to the run you want.

## B. Fast Test pass, RunWalk in the foreground

- [ ] B1. Start a music video or podcast in **YouTube**. Confirm audio is playing.
- [ ] B2. Switch to RunWalk. YouTube keeps playing (RunWalk opening must not pause it).
- [ ] B3. Turn on **Fast Test Mode**. Select **Week 5 Run 3** (3 intervals, 18 s total). Tap **START TEST RUN**, then **START**.
- [ ] B4. You hear "Start your 5-minute brisk warm-up walk." YouTube **drops in volume** while it speaks and **returns to full volume** about half a second after. YouTube never pauses.
- [ ] B5. Banner is amber **WARM-UP**, countdown runs from 0:06, Up Next shows "Next: 20 min Run".
- [ ] B6. Badge in the top right reads **☀ AWAKE** (green).
- [ ] B7. Run and cool-down cues duck and restore the same way. Banner turns orange **RUN**, then purple **COOL-DOWN**.
- [ ] B8. At the end: "Workout complete. Great job.", banner green **DONE**, YouTube back at full volume.
- [ ] B9. Tap **DONE**. On Home, Week 5 Run 3 shows a tick and the counter went up by one.

## C. Screen stays awake

- [ ] C1. Set Settings > Display & Brightness > Auto-Lock to **30 seconds**.
- [ ] C2. Turn **off** Fast Test. Start any real run. Do not touch the phone for 2 minutes. Screen stays on.
- [ ] C3. Tap **PAUSE**. Badge changes to **☾ CAN SLEEP**. Wait 45 s: the screen dims/locks normally.
- [ ] C4. Unlock, tap **RESUME**. Badge returns to **☀ AWAKE**. No duplicate cue for the current interval.

## D. Cues while YouTube is in the foreground / PiP

- [ ] D1. Fast Test on, select **Week 1 Run 1** (18 intervals, about 1 min 48 s). Start it.
- [ ] D2. Immediately switch to **YouTube** (swipe up / app switcher). Play a video full screen.
- [ ] D3. Every ~6 s you hear the next cue ("Start running for 1 minute.", "Walk for 90 seconds." ...), each with YouTube ducking and restoring. None are skipped, none repeat.
- [ ] D4. Around the middle you also hear "Halfway there." right after a run cue.
- [ ] D5. (Premium) Swipe home from YouTube so it goes to **Picture-in-Picture**. Cues continue.
- [ ] D6. Return to RunWalk mid-workout. Display matches what you heard (correct interval, sensible countdown). You hear **nothing extra** on return.
- [ ] D7. Let it finish while you are in YouTube. You hear "Workout complete." The run is ticked on Home when you return.

## E. Stale resync (suspension recovery)

- [ ] E1. Start a Fast Test run. Switch to YouTube. **Force a long gap**: open Control Center and start a 30 s screen recording, or take a short phone call.
- [ ] E2. When the call or interruption ends, you hear at most **one** cue, either a normal cue or a resync such as "Walk. 4 seconds left." Never a burst of several cues.

## F. Controls

- [ ] F1. **SKIP ›** while running: jumps to the next interval and speaks its cue immediately.
- [ ] F2. **SKIP ›** while paused: moves to the start of the next interval and stays paused, silently. On **RESUME** you hear that interval's cue exactly once.
- [ ] F3. **RESTART** (from paused): starts again at the warm-up with the warm-up cue.
- [ ] F4. **END WORKOUT** asks for confirmation. "Keep going" continues. "End workout" returns Home and does **not** tick the run.
- [ ] F5. Skip through every interval of a run: ends in **DONE** and saves.

## G. Real-world run (Release build, no Mac nearby)

- [ ] G1. Week 1 Run 1, Fast Test **off**, phone in an armband or pocket with YouTube playing.
- [ ] G2. All 18 interval cues arrive on time (spot-check with a watch). Halfway cue near 15:00.
- [ ] G3. Bluetooth headphones disconnect and reconnect mid-run: cues continue afterwards.
- [ ] G4. After finishing, battery drop is reasonable (note %: start ____ end ____).

## H. Cleanup

- [ ] H1. Home > **Reset progress** clears ticks from Fast Test runs.
- [ ] H2. Restore Auto-Lock to your usual setting.

### If something fails

| Symptom | Likely cause |
|---|---|
| Cues stop as soon as you open YouTube | Background audio missing. Check `UIBackgroundModes` contains `audio` in `ios/RunWalk/Info.plist`; rerun `npx expo prebuild --clean`. |
| YouTube stays quiet after a cue | Unduck did not deactivate. Look for `[voice]` or `unduck failed` warnings in the Xcode console. |
| YouTube pauses when RunWalk speaks | Session not mixable. Check the native module is linked (no yellow banner on Home). |
| YouTube stops when you leave it | YouTube itself (no Premium). Not a RunWalk issue. |
