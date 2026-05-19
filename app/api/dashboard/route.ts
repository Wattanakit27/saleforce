import { NextResponse } from "next/server";
import { fetchDashboardData } from "@/lib/fetch-dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchDashboardData();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Dashboard API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
