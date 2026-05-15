import { NextRequest, NextResponse } from "next/server";
import { fetchFXRate } from "@/lib/fx";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = (searchParams.get("from") ?? "").toUpperCase().trim();
  const to = (searchParams.get("to") ?? "").toUpperCase().trim();

  if (!from || !to) {
    return NextResponse.json(
      { error: "Both 'from' and 'to' query params are required" },
      { status: 400 }
    );
  }

  // Basic sanity check — ISO 4217 codes are 3 uppercase letters
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return NextResponse.json({ error: "Invalid currency code" }, { status: 400 });
  }

  try {
    const rate = await fetchFXRate(from, to);
    return NextResponse.json({ rate, from, to, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 503 }
    );
  }
}
