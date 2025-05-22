
"use client";

import type { ThemeMode } from '@/app/dashboard/settings/components/application-settings-manager'; // Assuming type is still defined there or move it here too.
import { DEFAULT_APP_PRIMARY_COLOR } from '@/config/colors';

export const THEME_STORAGE_KEY = "app_settings_theme_mode";
export const ACCENT_COLOR_STORAGE_KEY = "app_settings_accent_color";

export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return null;

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
      default: h = 0;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function applyThemeMode(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

export function applyAccentColor(color: string) {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  let colorToApply = color;
  let hslColor = hexToHsl(colorToApply);

  if (!hslColor) {
    colorToApply = DEFAULT_APP_PRIMARY_COLOR; // Fallback
    hslColor = hexToHsl(colorToApply);
  }

  if (hslColor) {
    root.style.setProperty('--primary-h', `${hslColor.h}`);
    root.style.setProperty('--primary-s', `${hslColor.s}%`);
    root.style.setProperty('--primary-l', `${hslColor.l}%`);

    root.style.setProperty('--accent-h', `${hslColor.h}`);
    root.style.setProperty('--accent-s', `${hslColor.s}%`);
    root.style.setProperty('--accent-l', `${hslColor.l}%`);

    root.style.setProperty('--ring-h', `${hslColor.h}`);
    root.style.setProperty('--ring-s', `${hslColor.s}%`);
    root.style.setProperty('--ring-l', `${hslColor.l}%`);
    
    const isLightAccent = hslColor.l > 60;

    if (isLightAccent) {
        root.style.setProperty('--primary-foreground-h', `var(--default-primary-foreground-dark-h)`);
        root.style.setProperty('--primary-foreground-s', `var(--default-primary-foreground-dark-s)`);
        root.style.setProperty('--primary-foreground-l', `var(--default-primary-foreground-dark-l)`);
        root.style.setProperty('--accent-foreground-h', `var(--default-accent-foreground-dark-h)`);
        root.style.setProperty('--accent-foreground-s', `var(--default-accent-foreground-dark-s)`);
        root.style.setProperty('--accent-foreground-l', `var(--default-accent-foreground-dark-l)`);
    } else {
        root.style.setProperty('--primary-foreground-h', `var(--default-primary-foreground-light-h)`);
        root.style.setProperty('--primary-foreground-s', `var(--default-primary-foreground-light-s)`);
        root.style.setProperty('--primary-foreground-l', `var(--default-primary-foreground-light-l)`);
        root.style.setProperty('--accent-foreground-h', `var(--default-accent-foreground-light-h)`);
        root.style.setProperty('--accent-foreground-s', `var(--default-accent-foreground-light-s)`);
        root.style.setProperty('--accent-foreground-l', `var(--default-accent-foreground-light-l)`);
    }
  }
}
