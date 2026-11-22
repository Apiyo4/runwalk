// src/ui/theme.ts
// High-contrast palette. Every banner color carries black text (contrast > 7:1)
// and a text label, so state is never conveyed by color alone.

import type { IntervalType } from '../config/c25kSchedule';

export const colors = {
  bg: '#0B0B0C',
  surface: '#1A1B1E',
  surfaceRaised: '#25272B',
  border: '#3A3D42',
  text: '#FFFFFF',
  textMuted: '#B8BCC4',
  onBanner: '#000000',
  accent: '#FFD60A',
  danger: '#FF6B6B',
  success: '#32D74B',
};

export const intervalColors: Record<IntervalType | 'idle' | 'completed', string> = {
  idle: '#3A3D42',
  warmup: '#FFC233',
  run: '#FF7A45',
  walk: '#5AA9FF',
  cooldown: '#C3A6FF',
  completed: '#32D74B',
};

export const intervalLabels: Record<IntervalType, string> = {
  warmup: 'WARM-UP',
  run: 'RUN',
  walk: 'WALK',
  cooldown: 'COOL-DOWN',
};

export const MIN_TAP = 64;
