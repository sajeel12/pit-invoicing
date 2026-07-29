// POST { user, password } -> sets a signed session cookie on success.

import { NextRequest, NextResponse } from "next/server";
import {
  checkCredentials,
  createSessionToken,
  getCredentials,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!getCredentials().password) {
    return NextResponse.json(
      { error: "Login is not configured. Set LOGIN_PASSWORD in .env.local." },
      { status: 500 },
    );
  }

  let body: { user?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const user = String(body.user ?? "").trim();
  const password = String(body.password ?? "");

  if (!checkCredentials(user, password)) {
    return NextResponse.json({ error: "Incorrect username or password." }, { status: 401 });
  }

  const token = await createSessionToken(user);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
}
