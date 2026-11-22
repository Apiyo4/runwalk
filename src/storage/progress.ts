// src/storage/progress.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { C25K_PROGRAM } from '../config/c25kSchedule';

const KEY = 'runwalk.progress.v1';

export interface ProgressData {
  /** session id -> ISO timestamp of the most recent completion */
  completed: Record<string, string>;
}

const EMPTY: ProgressData = { completed: {} };

export async function loadProgress(): Promise<ProgressData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<ProgressData>;
    return { completed: parsed.completed ?? {} };
  } catch {
    return EMPTY;
  }
}

export async function saveProgress(data: ProgressData): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

/** First session in program order that has not been completed (or the last one). */
export function nextSessionId(data: ProgressData): string {
  const next = C25K_PROGRAM.find((s) => !data.completed[s.id]);
  return (next ?? C25K_PROGRAM[C25K_PROGRAM.length - 1]).id;
}

export function useProgress() {
  const [data, setData] = useState<ProgressData>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadProgress().then((d) => {
      setData(d);
      setLoaded(true);
    });
  }, []);

  const markComplete = useCallback((id: string) => {
    setData((prev) => {
      const next = { completed: { ...prev.completed, [id]: new Date().toISOString() } };
      saveProgress(next).catch((e) => console.warn('[progress] save failed', e));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setData(EMPTY);
    saveProgress(EMPTY).catch((e) => console.warn('[progress] reset failed', e));
  }, []);

  return { data, loaded, markComplete, reset };
}
