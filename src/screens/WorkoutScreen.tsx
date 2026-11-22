import { useEffect } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { WorkoutSession } from '../config/c25kSchedule';
import { useWorkout } from '../hooks/useWorkout';
import { BigButton } from '../ui/BigButton';
import { clock, upNextLabel } from '../ui/format';
import { colors, intervalColors, intervalLabels } from '../ui/theme';

interface Props {
  session: WorkoutSession;
  onComplete(sessionId: string): void;
  onExit(): void;
}

export function WorkoutScreen({ session, onComplete, onExit }: Props) {
  const w = useWorkout(session, onComplete);
  const { progress: p, status } = w;

  const bannerKey = status === 'completed' ? 'completed' : p.current?.type ?? 'idle';
  const bannerLabel =
    status === 'completed' ? 'DONE' : p.current ? intervalLabels[p.current.type] : 'READY';
  const countdownMs = status === 'idle' ? p.intervalRemainingMs : status === 'completed' ? 0 : p.intervalRemainingMs;

  const confirmEnd = () => {
    if (status === 'idle' || status === 'completed') {
      w.end();
      onExit();
      return;
    }
    Alert.alert('End workout?', 'This run will not be saved as complete.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'End workout', style: 'destructive', onPress: () => { w.end(); onExit(); } },
    ]);
  };

  // Android back button behaves like End Workout.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmEnd();
      return true;
    });
    return () => sub.remove();
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{session.title}</Text>
        <View
          style={[styles.badge, w.keepAwake ? styles.badgeOn : styles.badgeOff]}
          accessibilityLabel={w.keepAwake ? 'Screen will stay awake' : 'Screen may sleep'}
        >
          <Text style={[styles.badgeText, w.keepAwake && { color: '#000' }]}>
            {w.keepAwake ? '☀ AWAKE' : '☾ CAN SLEEP'}
          </Text>
        </View>
      </View>

      <View
        style={[styles.banner, { backgroundColor: intervalColors[bannerKey] }]}
        accessible
        accessibilityLabel={`${bannerLabel}, ${clock(countdownMs)} remaining`}
        accessibilityLiveRegion="polite"
      >
        <Text style={[styles.bannerLabel, bannerKey === 'idle' && { color: colors.text }]}>{bannerLabel}</Text>
        <Text
          style={[styles.countdown, bannerKey === 'idle' && { color: colors.text }]}
          maxFontSizeMultiplier={1.2}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {clock(countdownMs)}
        </Text>
        {status === 'paused' && <Text style={styles.pausedTag}>PAUSED</Text>}
      </View>

      <View style={styles.stats}>
        <Stat label="Elapsed" value={clock(p.elapsedMs, false)} />
        <Stat label="Remaining" value={clock(p.remainingMs)} />
      </View>

      <Text style={styles.next} accessibilityLabel={upNextLabel(status === 'idle' ? session.intervals[0] : p.next)}>
        {status === 'completed' ? 'Great job. Run saved.' : upNextLabel(status === 'idle' ? session.intervals[0] : p.next)}
      </Text>

      <View style={styles.controls}>
        {status === 'idle' && <BigButton label="START" variant="primary" onPress={w.start} />}

        {status === 'running' && (
          <View style={styles.row}>
            <BigButton label="PAUSE" variant="primary" onPress={w.pause} style={styles.flex} />
            <BigButton label="SKIP ›" onPress={w.skip} style={styles.flexSmall} accessibilityHint="Skips to the next interval" />
          </View>
        )}

        {status === 'paused' && (
          <>
            <View style={styles.row}>
              <BigButton label="RESUME" variant="primary" onPress={w.resume} style={styles.flex} />
              <BigButton label="SKIP ›" onPress={w.skip} style={styles.flexSmall} />
            </View>
            <BigButton label="RESTART" onPress={w.restart} accessibilityHint="Starts this workout again from the beginning" />
          </>
        )}

        {status === 'completed' && (
          <>
            <BigButton label="DONE" variant="primary" onPress={() => { w.end(); onExit(); }} />
            <BigButton label="RUN IT AGAIN" onPress={w.restart} />
          </>
        )}

        {status !== 'completed' && (
          <BigButton label={status === 'idle' ? 'BACK' : 'END WORKOUT'} variant="danger" onPress={confirmEnd} />
        )}
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, gap: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 2 },
  badgeOn: { backgroundColor: colors.success, borderColor: colors.success },
  badgeOff: { borderColor: colors.border },
  badgeText: { color: colors.textMuted, fontSize: 13, fontWeight: '800' },
  banner: { borderRadius: 28, paddingVertical: 24, alignItems: 'center', justifyContent: 'center', flexGrow: 1, maxHeight: 340 },
  bannerLabel: { color: colors.onBanner, fontSize: 40, fontWeight: '900', letterSpacing: 2 },
  countdown: { color: colors.onBanner, fontSize: 120, fontWeight: '900', fontVariant: ['tabular-nums'] },
  pausedTag: { color: colors.onBanner, fontSize: 20, fontWeight: '900', letterSpacing: 4 },
  stats: { flexDirection: 'row', gap: 12, marginTop: 14 },
  stat: { flex: 1, backgroundColor: colors.surface, borderRadius: 16, padding: 12, alignItems: 'center' },
  statLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  statValue: { color: colors.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  next: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginVertical: 14 },
  controls: { gap: 12, paddingBottom: 12 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 2 },
  flexSmall: { flex: 1 },
});
