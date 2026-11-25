import { handleSession } from '../../../server/app.mjs';
import { toPlain, toResponse } from '../_lib/adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  return toResponse(handleSession(toPlain(req)));
}
