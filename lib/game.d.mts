export type Team = '黑' | '白';
export type Card = { team: Team; spy: boolean; scoringTeam: Team };
export type Mirror = { guest: number; spy: boolean };
export type Game = { version: number; cards: Card[]; draws: { guest: number; slot: number }[]; mirror: Record<Team, Mirror | null> };
export function createGame(random?: () => number): Game;
export function drawCard(game: Game, guest: number, slot: number): Game;
export function inspectGuest(game: Game, team: Team, guest: number): Game;
export function identityText(card: Card): string;
export function isValidGame(game: unknown): game is Game;
