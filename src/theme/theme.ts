import { useColorScheme } from 'react-native';

export type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

export interface Theme {
  dark: boolean;
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
  ok: string;
  okBg: string;
  warn: string;
  warnBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
}

export const lightTheme: Theme = {
  dark: false,
  bg: '#F4F7F7',
  card: '#FFFFFF',
  text: '#0F172A',
  muted: '#5B6B7A',
  border: '#DCE4E8',
  primary: '#0F766E',
  onPrimary: '#FFFFFF',
  ok: '#15803D',
  okBg: '#DCFCE7',
  warn: '#92400E',
  warnBg: '#FEF3C7',
  danger: '#B91C1C',
  dangerBg: '#FEE2E2',
  info: '#0369A1',
  infoBg: '#E0F2FE',
};

export const darkTheme: Theme = {
  dark: true,
  bg: '#0B1215',
  card: '#131C20',
  text: '#E6EEF0',
  muted: '#9BB0BA',
  border: '#24323A',
  primary: '#2DD4BF',
  onPrimary: '#04201D',
  ok: '#86EFAC',
  okBg: '#14301F',
  warn: '#FCD34D',
  warnBg: '#3A2D0B',
  danger: '#FCA5A5',
  dangerBg: '#3F1515',
  info: '#7DD3FC',
  infoBg: '#0C2A3B',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}

export function toneColors(t: Theme, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'ok':
      return { fg: t.ok, bg: t.okBg };
    case 'warn':
      return { fg: t.warn, bg: t.warnBg };
    case 'danger':
      return { fg: t.danger, bg: t.dangerBg };
    case 'info':
      return { fg: t.info, bg: t.infoBg };
    default:
      return { fg: t.muted, bg: t.border };
  }
}
