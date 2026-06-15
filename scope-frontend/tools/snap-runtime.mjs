import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

export const BASE = process.env.SNAP_BASE ?? 'http://localhost:8088';
export const OUT = 'snaps';
export const DEFAULT_VIEWPORT = { width: 1440, height: 900 };

function markOnboardingCompleted() {
  try {
    localStorage.setItem('scope-onboarding-completed-v1', 'completed');
    localStorage.setItem('scope-analytics-consent', 'granted');
    localStorage.setItem('scope-cookie-consent', 'dismissed');
  } catch {}
}

function markOnboardingIncomplete() {
  try {
    localStorage.removeItem('scope-onboarding-completed-v1');
    localStorage.setItem('scope-analytics-consent', 'granted');
    localStorage.setItem('scope-cookie-consent', 'dismissed');
  } catch {}
}

export async function launchSnapBrowser() {
  if (!existsSync(OUT)) {
    mkdirSync(OUT, { recursive: true });
  }

  return chromium.launch();
}

export async function createSnapContext(
  browser,
  { viewport = DEFAULT_VIEWPORT, showOnboarding = false } = {},
) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(
    showOnboarding ? markOnboardingIncomplete : markOnboardingCompleted,
  );
  return context;
}
