import { showEvents } from '../../../../lib/show-events';
import { stageView } from '../../../../lib/show.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export function GET(request: Request) {
  return showEvents(request, stageView, true);
}
