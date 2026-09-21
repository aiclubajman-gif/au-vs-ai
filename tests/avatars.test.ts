import { describe, it, expect } from 'vitest';
import {
  AVATAR_OPTIONS,
  getAvatarSrc,
  resolveAvatar,
  computeDisplayName,
  isCurrentPlayer,
  resolvePlayerAvatar,
} from '@/lib/avatars';
import fs from 'fs';
import path from 'path';

describe('Avatar System', () => {
  it('Male gender has exactly 3 avatar options', () => {
    expect(AVATAR_OPTIONS.Male).toHaveLength(3);
    expect(AVATAR_OPTIONS.Male.map((a) => a.id)).toEqual([
      'avatar_boy_1',
      'avatar_boy_2',
      'avatar_boy_3',
    ]);
  });

  it('Female gender has exactly 3 avatar options', () => {
    expect(AVATAR_OPTIONS.Female).toHaveLength(3);
    expect(AVATAR_OPTIONS.Female.map((a) => a.id)).toEqual([
      'avatar_girl_1',
      'avatar_girl_2',
      'avatar_girl_3',
    ]);
  });

  it('All 6 avatar image files exist on disk in public/avatars', () => {
    const all = [...AVATAR_OPTIONS.Male, ...AVATAR_OPTIONS.Female];
    expect(all).toHaveLength(6);

    for (const av of all) {
      const relativePath = av.src.replace(/^\//, '');
      const fullPath = path.resolve(process.cwd(), 'public', relativePath.replace(/^avatars\//, 'avatars/'));
      expect(fs.existsSync(fullPath), `Missing avatar file: ${fullPath}`).toBe(true);
    }
  });

  it('getAvatarSrc resolves known avatar IDs to valid paths', () => {
    expect(getAvatarSrc('avatar_boy_1')).toBe('/avatars/avatar_boy_1.png');
    expect(getAvatarSrc('avatar_girl_2')).toBe('/avatars/avatar_girl_2.png');
    expect(getAvatarSrc('unknown')).toBe('/avatars/avatar_boy_1.png');
  });

  it('resolveAvatar resolves exact IDs and hashes unknown seeds consistently', () => {
    expect(resolveAvatar('avatar_girl_3')).toBe('/avatars/avatar_girl_3.png');
    const hashResult = resolveAvatar('4821AUScholar');
    expect(hashResult).toMatch(/^\/avatars\/avatar_(boy|girl)_[123]\.png$/);
    expect(resolveAvatar('4821AUScholar')).toBe(hashResult);
  });

  it('computeDisplayName matches DB view logic', () => {
    expect(computeDisplayName('Mohammad B.')).toBe('Mohammad B.');
    expect(computeDisplayName('Mohammad Bushlaibi')).toBe('Mohammad B.');
    expect(computeDisplayName('Mohammad Ali Bushlaibi')).toBe('Mohammad B.');
    expect(computeDisplayName('Mohammad')).toBe('Mohammad');
    expect(computeDisplayName('Pending')).toBe(null);
    expect(computeDisplayName('')).toBe(null);
    expect(computeDisplayName(null)).toBe(null);
  });

  it('isCurrentPlayer correctly identifies the current user row', () => {
    const row = { display_name: 'Mohammad B.', masked_id_suffix: '8765' };

    // Matches by exact display_name
    expect(isCurrentPlayer(row, { displayName: 'Mohammad B.' })).toBe(true);

    // Matches case-insensitively
    expect(isCurrentPlayer(row, { displayName: 'mohammad b.' })).toBe(true);

    // Matches by full name that computes to display_name
    expect(isCurrentPlayer(row, { fullName: 'Mohammad Bushlaibi' })).toBe(true);

    // Matches by masked ID suffix
    expect(isCurrentPlayer(row, { maskedIdSuffix: '8765' })).toBe(true);

    // Does not match a different player
    const otherRow = { display_name: 'Banana H.', masked_id_suffix: '1234' };
    expect(isCurrentPlayer(otherRow, { displayName: 'Mohammad B.', maskedIdSuffix: '8765' })).toBe(false);
  });

  it('resolvePlayerAvatar overrides seed hash with currentAvatar for the logged-in player', () => {
    const row = { display_name: 'Mohammad B.', masked_id_suffix: '0000' };
    const user = { displayName: 'Mohammad B.', maskedIdSuffix: '0000' };

    // Row '0000Mohammad B.' naturally hashes to avatar_girl_2:
    // But resolvePlayerAvatar MUST return avatar_boy_2 when the user selected avatar_boy_2!
    expect(resolvePlayerAvatar(row, user, 'avatar_boy_2')).toBe('/avatars/avatar_boy_2.png');

    // And if the user switches to avatar_boy_3:
    expect(resolvePlayerAvatar(row, user, 'avatar_boy_3')).toBe('/avatars/avatar_boy_3.png');

    // For a different player, uses avatarMap if present, else fallback
    const otherRow = { display_name: 'Ahmed K.', masked_id_suffix: '5678' };
    expect(resolvePlayerAvatar(otherRow, user, 'avatar_boy_2', { '5678Ahmed K.': 'avatar_boy_1' })).toBe('/avatars/avatar_boy_1.png');
  });
});
