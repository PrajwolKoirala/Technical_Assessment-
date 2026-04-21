import { db } from "@/lib/db/index";
import { NextRequest, NextResponse } from "next/server";
import { generateMarkdownReport } from "@/lib/reportGenerator";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const result = await db.getSearch(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    const format = new URL(req.url).searchParams.get("format") ?? "json";

    if (format === "markdown") {
      const md = generateMarkdownReport(result);

      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="osint-report-${result.entity.name.replace(/\s+/g, "-")}.md"`,
        },
      });
    }

    const md = generateMarkdownReport(result);

    return NextResponse.json({
      success: true,
      data: { markdown: md, result },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Report generation failed" },
      { status: 500 }
    );
  }
}