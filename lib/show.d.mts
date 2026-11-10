import type { Game, Team } from './game.mjs';

export type ScoreRound = 2 | 4;
type TeamScore = { team: Team; score: number; actualScore?: number };
type Phase = 'draw' | 'captains' | 'scores' | 'mirror';
export type Show = {
  game: Game;
  phase: Phase;
  guest: number;
  identityUntil: number;
  identityPending: boolean;
  captains: Record<Team, number | null>;
  roundScores: Record<ScoreRound, TeamScore | null>;
  screenRound: ScoreRound | null;
  mirrorTeam: Team;
  guestNames?: Record<number, string>;
  teamNames?: Record<Team, string>;
  revision: number;
};
export type Action =
  | { type: 'import-v1'; game: Game }
  | { type: 'reset' | 'hide-identity' | 'next-guest' }
  | { type: 'draw'; guest: number; slot: number }
  | { type: 'show-identity'; guest: number }
  | { type: 'stage-hidden'; revision: number }
  | { type: 'phase'; phase: Phase }
  | { type: 'captain' | 'mirror'; team: Team; guest: number }
  | { type: 'names'; guestNames: Record<number, string>; teamNames: Record<Team, string> }
  | { type: 'publish-score'; round: ScoreRound; team: Team; score: number; actualScore: number };
export type StageView = Pick<Show, 'phase' | 'guest' | 'captains' | 'screenRound' | 'guestNames' | 'teamNames'> & {
  draws: Game['draws'];
  hideRevision: number | null;
  rosters: Record<Team, number[]> | null;
  identity: { title: string; text: string; team: Team; apparentTeam: Team; spy: boolean; remaining: number } | null;
  score: TeamScore | null;
  mirror: { team: Team; guest: number; spy: boolean } | null;
};
export const teams: readonly Team[];
export const scoreRounds: readonly ScoreRound[];
export const guests: readonly number[];
export function guestName(guest: number, names?: Show['guestNames']): string;
export const identityDuration: number;
export function createShow(game?: Game): Show;
export function restoreShow(saved: unknown): Show;
export function members(show: Show, team: Team): number[];
export function changeShow(show: Show, action: Action, now?: number): Show;
export function stageView(show: Show, now?: number): StageView;
export function teamName(team: Team, names?: Show['teamNames']): string;
