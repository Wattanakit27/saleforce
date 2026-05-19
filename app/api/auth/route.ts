import { NextRequest, NextResponse } from "next/server";
import { fetchSheet, cell, EMPLOYEE_COL as EM } from "@/lib/google-sheets";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const employees = await fetchSheet("employees");
    const row = employees.find((r) => cell(r, EM.user_id) === token);
    if (!row) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    return NextResponse.json({
      id: cell(row, EM.user_id),
      user_id: cell(row, EM.user_id),
      display_name: cell(row, EM.display_name),
      nickname: cell(row, EM.nickname),
      position: cell(row, EM.position),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
