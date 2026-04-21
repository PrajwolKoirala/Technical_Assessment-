import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMarkdownReport } from "@/lib/reportGenerator";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const result = db.getSearch(id);

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 }
      );
    }

    const format =
      new URL(req.url).searchParams.get("format") ?? "json";

    const md = generateMarkdownReport(result);

    if (format === "markdown") {
      const safeName =
        result.entity?.name?.replace(/\s+/g, "-") ?? "osint-report";

      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="osint-report-${safeName}.md"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        markdown: md,
        result,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: "Report generation failed" },
      { status: 500 }
    );
  }
}