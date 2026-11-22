import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { C25K_PROGRAM, getSessionById, toFastTestSession } from './src/config/c25kSchedule';
import { voiceAvailable } from './src/audio/voice';
import { HomeScreen } from './src/screens/HomeScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { nextSessionId, useProgress } from './src/storage/progress';

type Screen = { name: 'home' } | { name: 'workout'; sessionId: string; fastTest: boolean };

export default function App() {
  const { data, loaded, markComplete, reset } = useProgress();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fastTest, setFastTest] = useState(false);
  const completedThisWorkout = useRef(false);

  // Default selection: the first run not yet completed.
  useEffect(() => {
    if (loaded && selectedId === null) setSelectedId(nextSessionId(data));
  }, [loaded, data, selectedId]);

  const workoutSession = useMemo(() => {
    if (screen.name !== 'workout') return null;
    const base = getSessionById(screen.sessionId) ?? C25K_PROGRAM[0];
    return screen.fastTest ? toFastTestSession(base) : base;
  }, [screen]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen.name === 'workout' && workoutSession ? (
        <WorkoutScreen
          key={`${workoutSession.id}-${screen.fastTest}`}
          session={workoutSession}
          onComplete={(id) => {
            completedThisWorkout.current = true;
            markComplete(id);
          }}
          onExit={() => {
            // After a completion, move the selection on to the next run.
            if (completedThisWorkout.current) setSelectedId(null);
            completedThisWorkout.current = false;
            setScreen({ name: 'home' });
          }}
        />
      ) : (
        <HomeScreen
          progress={data}
          selectedId={selectedId ?? C25K_PROGRAM[0].id}
          onSelect={setSelectedId}
          fastTest={fastTest}
          onToggleFastTest={setFastTest}
          onStart={() =>
            setScreen({ name: 'workout', sessionId: selectedId ?? C25K_PROGRAM[0].id, fastTest })
          }
          onResetProgress={() => {
            reset();
            setSelectedId(C25K_PROGRAM[0].id);
          }}
          voiceAvailable={voiceAvailable}
        />
      )}
    </SafeAreaProvider>
  );
}
