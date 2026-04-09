// World Menu POS — Theme System
// 3 selectable themes stored in settings

export interface Theme {
  name: string;
  label: string;
  emoji: string;
  bg: string;
  bgCard: string;
  bgCardHover: string;
  bgInput: string;
  primary: string;
  primaryDark: string;
  primaryText: string;
  success: string;
  successDark: string;
  danger: string;
  dangerDark: string;
  info: string;
  infoDark: string;
  accent: string;
  accentDark: string;
  purple: string;
  orange: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
}

export const themes: Record<string, Theme> = {
  'warm-night': {
    name: 'warm-night',
    label: 'Warm Night',
    emoji: '🌙',
    bg: '#1a1a2e',
    bgCard: '#16213e',
    bgCardHover: '#1c2a4e',
    bgInput: '#16213e',
    primary: '#e2b04a',
    primaryDark: '#c4942a',
    primaryText: '#1a1a2e',
    success: '#2dd4bf',
    successDark: '#0d9488',
    danger: '#f87171',
    dangerDark: '#dc2626',
    info: '#3b82f6',
    infoDark: '#2563eb',
    accent: '#f59e0b',
    accentDark: '#d97706',
    purple: '#8b5cf6',
    orange: '#ea580c',
    text: '#f5f0eb',
    textSecondary: '#a8a0b0',
    textMuted: '#6b6580',
    border: '#2a2a4e',
  },
  'fresh-bold': {
    name: 'fresh-bold',
    label: 'Fresh & Bold',
    emoji: '⚡',
    bg: '#0f0f0f',
    bgCard: '#1e1e1e',
    bgCardHover: '#2a2a2a',
    bgInput: '#1e1e1e',
    primary: '#3b82f6',
    primaryDark: '#2563eb',
    primaryText: '#ffffff',
    success: '#22c55e',
    successDark: '#16a34a',
    danger: '#ef4444',
    dangerDark: '#dc2626',
    info: '#3b82f6',
    infoDark: '#2563eb',
    accent: '#f59e0b',
    accentDark: '#d97706',
    purple: '#8b5cf6',
    orange: '#f97316',
    text: '#ffffff',
    textSecondary: '#a3a3a3',
    textMuted: '#666666',
    border: '#333333',
  },
  'thai-gold': {
    name: 'thai-gold',
    label: 'Thai Gold',
    emoji: '🪷',
    bg: '#1a1410',
    bgCard: '#2a2018',
    bgCardHover: '#3d2e1e',
    bgInput: '#2a2018',
    primary: '#c4942a',
    primaryDark: '#a67c1a',
    primaryText: '#1a1410',
    success: '#34d399',
    successDark: '#059669',
    danger: '#dc2626',
    dangerDark: '#b91c1c',
    info: '#3b82f6',
    infoDark: '#2563eb',
    accent: '#ea580c',
    accentDark: '#c2410c',
    purple: '#8b5cf6',
    orange: '#ea580c',
    text: '#fdf6e3',
    textSecondary: '#b8a88a',
    textMuted: '#7a6a50',
    border: '#3d2e1e',
  },
};

export function getTheme(name?: string): Theme {
  return themes[name || 'warm-night'] || themes['warm-night'];
}
