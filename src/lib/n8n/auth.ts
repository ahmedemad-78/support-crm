import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

export function validN8nKey(request: Request) {
  const expected = process.env.N8N_API_KEY;
  const supplied = request.headers.get("x-api-key");
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
