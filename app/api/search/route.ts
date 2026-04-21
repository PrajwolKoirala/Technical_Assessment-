import { NextRequest, NextResponse } from "next/server";
import { runSearch } from "@/lib/orchestrator";
import { SearchApiRequest } from "@/types";

export const maxDuration = 60; // Vercel: allow up to 60s for parallel adapters

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SearchApiRequest;

    if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: "Name must be at least 2 characters" },
        { status: 400 }
      );
    }

    if (!["company", "individual"].includes(body.type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be "company" or "individual"' },
        { status: 400 }
      );
    }

    const result = await runSearch({ name: body.name.trim(), type: body.type });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[/api/search]", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
