import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  C25K_PROGRAM, FAST_TEST_SECONDS, getSessionById, getTotalDurationSeconds,
} from '../config/c25kSchedule';
import type { ProgressData } from '../storage/progress';
import { BigButton } from '../ui/BigButton';
import { colors, MIN_TAP } from '../ui/theme';

interface Props {
  progress: ProgressData;
  selectedId: string;
  onSelect(id: string): void;
  fastTest: boolean;
  onToggleFastTest(v: boolean): void;
  onStart(): void;
  onResetProgress(): void;
  voiceAvailable: boolean;
}

const WEEKS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function HomeScreen(p: Props) {
  const selected = getSessionById(p.selectedId) ?? C25K_PROGRAM[0];
  const minutes = Math.round(getTotalDurationSeconds(selected) / 60);
  const doneCount = Object.keys(p.progress.completed).length;
  const isDone = !!p.progress.completed[selected.id];

  const confirmReset = () =>
    Alert.alert('Reset progress?', 'This clears every completed run on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: p.onResetProgress },
    ]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand} accessibilityRole="header">RunWalk</Text>
        <Text style={styles.muted}>{doneCount} of 27 runs complete</Text>

        {!p.voiceAvailable && (
          <View style={styles.warn} accessibilityRole="alert">
            <Text style={styles.warnText}>
              Voice cues need a development build. In Expo Go the timer works but stays silent.
            </Text>
          </View>
        )}

        <View style={styles.hero}>
          <Text style={styles.heroTitle} accessibilityRole="header">{selected.title}</Text>
          <Text style={styles.heroDesc}>{selected.description}</Text>
          <Text style={styles.muted}>
            {p.fastTest
              ? `Fast Test: ${selected.intervals.length} intervals × ${FAST_TEST_SECONDS}s`
              : `${minutes} minutes including warm-up and cool-down`}
            {isDone ? '  •  Completed ✓' : ''}
          </Text>
          <BigButton
            label={p.fastTest ? 'START TEST RUN' : 'START'}
            variant="primary"
            onPress={p.onStart}
            accessibilityHint={`Opens the workout screen for ${selected.title}`}
            style={{ marginTop: 16 }}
          />
        </View>

        <View style={[styles.fastRow, p.fastTest && styles.fastRowOn]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fastTitle}>Fast Test Mode</Text>
            <Text style={styles.mutedSmall}>
              Every interval becomes {FAST_TEST_SECONDS} seconds. For testing cues and transitions.
            </Text>
          </View>
          <Switch
            value={p.fastTest}
            onValueChange={p.onToggleFastTest}
            accessibilityLabel="Fast Test Mode"
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#fff"
            style={{ transform: [{ scale: 1.25 }] }}
          />
        </View>

        <Text style={styles.section} accessibilityRole="header">Program</Text>
        {WEEKS.map((week) => (
          <View key={week} style={styles.weekRow}>
            <Text style={styles.weekLabel}>Week {week}</Text>
            <View style={styles.tiles}>
              {C25K_PROGRAM.filter((s) => s.week === week).map((s) => {
                const done = !!p.progress.completed[s.id];
                const sel = s.id === p.selectedId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => p.onSelect(s.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`${s.title}${done ? ', completed' : ', not started'}`}
                    accessibilityState={{ selected: sel }}
                    style={[styles.tile, done && styles.tileDone, sel && styles.tileSelected]}
                  >
                    <Text style={[styles.tileText, done && styles.tileTextDone]}>
                      {done ? '✓ ' : ''}Run {s.run}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Pressable onPress={confirmReset} accessibilityRole="button" style={styles.reset} hitSlop={8}>
          <Text style={styles.resetText}>Reset progress</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, paddingBottom: 48 },
  brand: { color: colors.text, fontSize: 34, fontWeight: '900' },
  muted: { color: colors.textMuted, fontSize: 16, marginTop: 4 },
  mutedSmall: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
  warn: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 2, borderColor: colors.accent },
  warnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  hero: { marginTop: 20, padding: 20, borderRadius: 22, backgroundColor: colors.surface },
  heroTitle: { color: colors.text, fontSize: 30, fontWeight: '900' },
  heroDesc: { color: colors.text, fontSize: 18, marginTop: 6 },
  fastRow: {
    marginTop: 16, padding: 16, borderRadius: 18, borderWidth: 2, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  fastRowOn: { borderColor: colors.accent },
  fastTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  section: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: 28, marginBottom: 8 },
  weekRow: { marginBottom: 12 },
  weekLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1, minHeight: MIN_TAP - 8, borderRadius: 14, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  tileDone: { backgroundColor: '#123A1C', borderColor: colors.success },
  tileSelected: { borderColor: colors.accent, borderWidth: 3 },
  tileText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  tileTextDone: { color: colors.success },
  reset: { marginTop: 24, alignSelf: 'center', padding: 12 },
  resetText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
