import type { Team } from './game.mjs';

export const roleOptions = [
  { key: 'black-civilian', label: '黑队平民', spy: false },
  { key: 'white-civilian', label: '白队平民', spy: false },
  { key: 'black-spy', label: '黑队卧底', spy: true },
  { key: 'white-spy', label: '白队卧底', spy: true },
] as const;

export type RoleKey = (typeof roleOptions)[number]['key'];
export const avatarMaxBytes = 4 * 1024 * 1024;
export const avatarFormats = 'image/png,image/jpeg,image/webp';

export function roleKey(affiliation: Team, spy: boolean): RoleKey {
  return affiliation === '黑'
    ? (spy ? 'black-spy' : 'black-civilian')
    : (spy ? 'white-spy' : 'white-civilian');
}

export function avatarUrl(role: RoleKey, version?: number) {
  return '/api/role-avatar/' + role + (version ? '?v=' + version : '');
}
