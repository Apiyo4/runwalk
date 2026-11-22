# RunWalk

A beginner Couch-to-5K interval coach for iPhone (Android-ready structure). Play music or a podcast in YouTube, start a run in RunWalk, and hear spoken "run" and "walk" cues that briefly lower YouTube's volume instead of stopping it.

No backend, accounts, GPS, analytics, or network calls. Progress is stored on the device.

- Design and decisions: [ARCHITECTURE.md](ARCHITECTURE.md)
- On-device test plan: [DEVICE_TEST_CHECKLIST.md](DEVICE_TEST_CHECKLIST.md)

## Stack

Expo SDK 58, React Native 0.88, TypeScript, `expo-keep-awake`, AsyncStorage, and one local native module (`modules/runwalk-audio`) for ducking speech and background survival. **This app does not run with voice in Expo Go**; it needs a development build.

## Project layout

```
App.tsx                         screen switching (home <-> workout)
src/config/c25kSchedule.ts      the 9-week plan. Edit this to change workouts.
src/engine/workoutEngine.ts     pure timestamp-based state machine
src/engine/announcer.ts         pure "what to say" logic (no duplicates, no stale backlog)
src/hooks/useWorkout.ts         ticks, AppState, keep-awake, audio session
src/audio/voice.ts              JS facade over the native module
src/storage/progress.ts         AsyncStorage progress
src/screens/                    HomeScreen, WorkoutScreen
src/ui/                         theme, button, formatting
modules/runwalk-audio/          Expo module: Swift (iOS) + Kotlin (Android)
```

## Run the tests

```bash
npm install
npm test            # 30 Jest tests: schedule, engine, announcer
npm run typecheck
```

## Build and run on a physical iPhone

### What you need

- A Mac with **Xcode** installed (current version from the App Store), opened once so it finishes installing components.
- Node.js LTS and CocoaPods (`brew install cocoapods`, or `sudo gem install cocoapods`).
- An Apple ID. A free one works for local installs (the app expires after 7 days; just rebuild). A paid Apple Developer account removes that limit and is required for the EAS route.
- An iPhone with a USB cable.

### One-time setup

1. **Set your bundle id.** In `app.json`, change `ios.bundleIdentifier` from `com.example.runwalk` to something unique, e.g. `com.yourname.runwalk`.
2. **Enable Developer Mode on the iPhone** (iOS 16+): Settings > Privacy & Security > Developer Mode > On. The phone restarts.
3. **Add your Apple ID to Xcode:** Xcode > Settings > Accounts > `+` > Apple ID.

### Option A: local build with Xcode (recommended)

```bash
npm install
npx expo prebuild --platform ios      # generates ios/ from app.json (adds background audio)
npx expo run:ios --device             # pick your iPhone from the list
```

If signing fails on the first run:

1. `open ios/RunWalk.xcworkspace`
2. Select the **RunWalk** target > **Signing & Capabilities** > tick *Automatically manage signing* > choose your **Team**.
3. Run `npx expo run:ios --device` again.

On the phone, the first launch may say "Untrusted Developer": Settings > General > VPN & Device Management > your Apple ID > Trust.

This installs a **debug** build that loads JavaScript from Metro on your Mac, so the phone and Mac must be on the same Wi-Fi. That is fine for development, but not for an actual run outdoors.

### For real runs: install a Release build

A Release build bundles the JavaScript into the app, so it works away from your Mac:

```bash
npx expo run:ios --device --configuration Release
```

### Option B: EAS development build (needs paid Apple Developer account)

```bash
npm install -g eas-cli
eas login
eas build:configure
eas device:create                      # register your iPhone (opens a link on the phone)
eas build --profile development --platform ios
```

Install from the link EAS gives you, then `npx expo start --dev-client` and open the project from the app. For a standalone build use `--profile preview`.

### After changing native code

Any change to `app.json` or `modules/runwalk-audio/**` needs a rebuild (`npx expo prebuild --clean` then `npx expo run:ios --device`). JavaScript changes reload instantly in a debug build.

## Editing the program

All workouts live in `src/config/c25kSchedule.ts`. Helpers keep it short:

```ts
session(5, 2, 'Two 8-minute runs with a 5-minute walk in between.', [
  run(480), walk(300), finalRun(480),
]),
```

`run()` and `walk()` generate the spoken cue from the duration. Pass your own text as the second argument to override it. Warm-up and cool-down are added automatically. Run `npm test` after editing; the tests check NHS run totals, alternation, and ids.

## Changes from the starting `c25kSchedule.ts`

- **Week 1 and Week 2 were short one walk.** The old helper dropped the trailing walk, then one walk was added back, giving 18.5 min instead of 20 (Week 1) and 19 min instead of 21 (Week 2). Now exactly 8 x (60 s + 90 s) and 6 x (90 s + 2 min).
- **TypeScript error fixed.** Inside `[1,2,3].map(...)` the literal `type: 'run'` widened to `string`, which does not satisfy `IntervalType`. Sessions are now built by typed helpers.
- Duration wording centralised (`spokenDuration`), including "2 and a half minutes".
- Fast Test Mode defaults to 6 s per interval so each cue finishes before the next one.
