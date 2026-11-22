import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors, MIN_TAP } from './theme';

type Variant = 'primary' | 'secondary' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  accessibilityHint?: string;
  style?: ViewStyle;
  disabled?: boolean;
}

export function BigButton({ label, onPress, variant = 'secondary', accessibilityHint, style, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, variant === 'primary' && styles.labelPrimary]} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TAP,
    borderRadius: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  primary: { backgroundColor: colors.accent, borderColor: colors.accent, minHeight: 84 },
  secondary: { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
  danger: { backgroundColor: 'transparent', borderColor: colors.danger },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.4 },
  label: { color: colors.text, fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
  labelPrimary: { color: '#000', fontSize: 28 },
});
