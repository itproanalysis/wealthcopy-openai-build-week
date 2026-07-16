import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export function GET() {
  return NextResponse.json(
    { status: "ok" },
    { headers: NO_STORE_HEADERS, status: 200 },
  );
}

export function HEAD() {
  return new Response(null, {
    headers: NO_STORE_HEADERS,
    status: 200,
  });
}
