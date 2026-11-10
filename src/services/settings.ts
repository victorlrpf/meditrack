import { getSetting, setSetting } from '../db/database';

export async function isOnboarded(): Promise<boolean> {
  return (await getSetting('onboarded')) === '1';
}

export async function markOnboarded(): Promise<void> {
  await setSetting('onboarded', '1');
}
