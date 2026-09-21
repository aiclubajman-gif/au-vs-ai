export type Gender = 'Male' | 'Female';

export interface AvatarOption {
  id: string;
  src: string;
  label: string;
  gender: Gender;
}

export const AVATAR_OPTIONS: Record<Gender, AvatarOption[]> = {
  Male: [
    { id: 'avatar_boy_1', src: '/avatars/avatar_boy_1.png', label: 'Avatar 1', gender: 'Male' },
    { id: 'avatar_boy_2', src: '/avatars/avatar_boy_2.png', label: 'Avatar 2', gender: 'Male' },
    { id: 'avatar_boy_3', src: '/avatars/avatar_boy_3.png', label: 'Avatar 3', gender: 'Male' },
  ],
  Female: [
    { id: 'avatar_girl_1', src: '/avatars/avatar_girl_1.png', label: 'Avatar 1', gender: 'Female' },
    { id: 'avatar_girl_2', src: '/avatars/avatar_girl_2.png', label: 'Avatar 2', gender: 'Female' },
    { id: 'avatar_girl_3', src: '/avatars/avatar_girl_3.png', label: 'Avatar 3', gender: 'Female' },
  ],
};

const STORAGE_AVATAR_KEY = 'au_vs_ai_user_avatar';
const STORAGE_GENDER_KEY = 'au_vs_ai_user_gender';

export function getStoredGender(): Gender {
  if (typeof window === 'undefined') return 'Male';
  const saved = localStorage.getItem(STORAGE_GENDER_KEY);
  return saved === 'Female' ? 'Female' : 'Male';
}

export function setStoredGender(gender: Gender) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_GENDER_KEY, gender);
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

export function getStoredAvatar(): string {
  if (typeof window === 'undefined') return 'avatar_boy_1';
  const saved = localStorage.getItem(STORAGE_AVATAR_KEY);
  const validIds = new Set([
    ...AVATAR_OPTIONS.Male.map((a) => a.id),
    ...AVATAR_OPTIONS.Female.map((a) => a.id),
  ]);
  if (saved && validIds.has(saved)) return saved;
  const gender = getStoredGender();
  return AVATAR_OPTIONS[gender][0].id;
}

export function setStoredAvatar(avatarId: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_AVATAR_KEY, avatarId);
    window.dispatchEvent(new CustomEvent('au_vs_ai_avatar_changed', { detail: { avatarId } }));
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

export function getAvatarSrc(avatarId: string): string {
  const all = [...AVATAR_OPTIONS.Male, ...AVATAR_OPTIONS.Female];
  const found = all.find((a) => a.id === avatarId);
  return found?.src ?? '/avatars/avatar_boy_1.png';
}

/**
 * Returns the image source for a player given their avatar ID or seed string.
 * If the string matches one of the custom avatar IDs, it returns that avatar directly.
 * Otherwise, it deterministically maps the seed across the available avatars.
 */
export function resolveAvatar(avatarIdOrSeed: string): string {
  const all = [...AVATAR_OPTIONS.Male, ...AVATAR_OPTIONS.Female];
  const match = all.find((a) => a.id === avatarIdOrSeed);
  if (match) return match.src;

  // Fallback hash
  let h = 0;
  for (let i = 0; i < avatarIdOrSeed.length; i++) {
    h = (h * 31 + avatarIdOrSeed.charCodeAt(i)) >>> 0;
  }
  return all[h % all.length].src;
}
