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
const STORAGE_NAME_KEY = 'au_vs_ai_user_name';
const STORAGE_DISPLAY_NAME_KEY = 'au_vs_ai_user_display_name';
const STORAGE_MASKED_ID_KEY = 'au_vs_ai_user_masked_id';

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

export function getStoredUserName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_NAME_KEY);
}

export function setStoredUserName(name: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_NAME_KEY, name);
  } catch {
    // ignore
  }
}

export function getStoredUserDisplayName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_DISPLAY_NAME_KEY);
}

export function setStoredUserDisplayName(displayName: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_DISPLAY_NAME_KEY, displayName);
  } catch {
    // ignore
  }
}

export function getStoredUserMaskedId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_MASKED_ID_KEY);
}

export function setStoredUserMaskedId(id: string) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_MASKED_ID_KEY, id);
  } catch {
    // ignore
  }
}

/**
 * Computes the public display name from a full name, matching DB view logic:
 * First name + capitalized first initial of last name with a dot (e.g. "Mohammad B.").
 */
export function computeDisplayName(fullName: string | null | undefined): string | null {
  if (!fullName || fullName === 'Pending') return null;
  const trimmed = fullName.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() ?? '';
  return `${parts[0]} ${lastInitial}.`;
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

export interface CurrentPlayerIdentity {
  displayName?: string | null;
  maskedIdSuffix?: string | null;
  fullName?: string | null;
}

/**
 * Checks if a leaderboard row represents the currently logged in player.
 */
export function isCurrentPlayer(
  row: { display_name: string; masked_id_suffix?: string },
  user?: CurrentPlayerIdentity | null
): boolean {
  if (!user) return false;

  const rowName = row.display_name.trim().toLowerCase();
  const userDisp = user.displayName?.trim().toLowerCase();
  const userFull = user.fullName?.trim().toLowerCase();
  const userComputed = user.fullName ? computeDisplayName(user.fullName)?.toLowerCase() : null;

  // If masked_id_suffix is available and matches
  if (user.maskedIdSuffix && row.masked_id_suffix) {
    if (row.masked_id_suffix === user.maskedIdSuffix) {
      if (!userDisp || rowName === userDisp || rowName === userComputed || rowName === userFull) {
        return true;
      }
    }
  }

  // Match by display_name (e.g. "Mohammad B.")
  if (userDisp && rowName === userDisp) {
    return true;
  }

  // Match by full name or computed display name
  if (userComputed && rowName === userComputed) {
    return true;
  }

  if (userFull && rowName === userFull) {
    return true;
  }

  return false;
}

/**
 * Resolves the avatar image for a leaderboard row:
 * 1. If it's the current player, uses their active chosen avatar.
 * 2. If it exists in the server avatar map (keyed by masked_id_suffix+display_name or display_name), uses that.
 * 3. Otherwise falls back to deterministic hash.
 */
export function resolvePlayerAvatar(
  row: { display_name: string; masked_id_suffix: string },
  user: CurrentPlayerIdentity | null | undefined,
  currentAvatar: string,
  avatarMap?: Record<string, string> | null
): string {
  if (isCurrentPlayer(row, user)) {
    return getAvatarSrc(currentAvatar);
  }

  if (avatarMap) {
    const keyWithSuffix = row.masked_id_suffix + row.display_name;
    if (avatarMap[keyWithSuffix]) {
      return getAvatarSrc(avatarMap[keyWithSuffix]);
    }
    if (avatarMap[row.display_name]) {
      return getAvatarSrc(avatarMap[row.display_name]);
    }
  }

  return resolveAvatar(row.masked_id_suffix + row.display_name);
}
