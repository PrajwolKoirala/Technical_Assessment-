import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const history = q ? await db.searchHistory(q) : await db.getHistory(limit);
    return NextResponse.json({ success: true, data: history });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to load history" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };
    if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });
    await db.deleteSearch(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Delete failed" }, { status: 500 });
  }
}
