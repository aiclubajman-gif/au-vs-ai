import { describe, it, expect } from 'vitest';
import { AVATAR_OPTIONS, getAvatarSrc, resolveAvatar } from '@/lib/avatars';
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
});
