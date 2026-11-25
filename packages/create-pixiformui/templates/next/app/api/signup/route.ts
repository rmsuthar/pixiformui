import { handleSignup } from '../../../server/app.mjs';
import { toPlain, toResponse } from '../_lib/adapter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return toResponse(await handleSignup(toPlain(req)));
}
