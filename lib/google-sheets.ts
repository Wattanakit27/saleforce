import { GoogleAuth } from "google-auth-library";

// ── Config: Sheet IDs & tab names ──
export const SHEET_CONFIG = {
  leads: {
    spreadsheetId: "1s9FFPRV53U7pQTnBGSlkSFL8ygmRGRGYOAG1HakzgA0",
    sheetName: "รวม sheet",
  },
  sales_reports: {
    spreadsheetId: "13_vFkHEZWRAzxZiJ1Uj-NPlzlZtptyXuIjdxkGqlg8Y",
    sheetName: "รวม sheet",
  },
  bookings: {
    spreadsheetId: "13jiQTOvcCvlKLGvjrb348_iRWoiMpumqqeEgOTkTgB0",
    sheetName: "รวม sheet",
  },
  live_sessions: {
    spreadsheetId: "18Djos3lUJnoZ00gYEBuCCExwm1YknfIQrP-TIuUgjWU",
    sheetName: "รวม sheet",
  },
  live_followups: {
    spreadsheetId: "18Djos3lUJnoZ00gYEBuCCExwm1YknfIQrP-TIuUgjWU",
    sheetName: "ติดตามไลฟ์สด",
  },
  employees: {
    spreadsheetId: "1HOhrPSIFTxfOpc4UWvKb-LfMuXGYW2vYkR5vbGzPd_A",
    sheetName: "เก็บข้อมูลพนักงาน กลุ่ม หลัก",
  },
} as const;

// ── Column index maps (0-based) ──
export const LEADS_COL = {
  received_date: 0,
  phone: 1,
  time: 2,
  lead_code: 3,
  sales_rep: 4,
  live_team: 5,
  admin: 6,
  channel: 7,
  branch: 8,
  type: 9,
  ads: 10,
  car_inquiry: 11,
  car_formula: 12,
  call_proof: 13,
  focus: 14,
  contact_datetime: 15,
  update_count: 16,
  last_updated_at: 17,
  fill_sheet_note: 18,
  customer_profile: 19,
  customer_profile_1: 20,
  customer_profile_2: 21,
  customer_profile_3: 22,
  date2: 23,
  status: 24,
  admin_survey: 25,
  admin_status: 26,
  _skip: 27,
  sales_status: 28,
  case_update_1: 29,
  case_update_2: 30,
  case_update_3: 31,
  final_status: 32,
} as const;

export const SALES_COL = {
  sales_rep: 0,
  order_num: 1,
  date: 2,
  channel: 3,
  lead_code: 4,
  booking_no: 5,
  customer_name: 6,
  phone: 7,
  car_detail: 8,
  car_year: 9,
  license_plate: 10,
  sale_price: 11,
  deposit_amount: 12,
  status: 13,
  sign_date: 14,
  finance_main: 15,
  finance_backup: 16,
  grade: 17,
  doc_complete_date: 18,
  result_date: 19,
  note: 20,
  car_release_date: 21,
} as const;

export const BOOKINGS_COL = {
  no: 0,
  date: 1,
  sales_rep: 2,
  channel: 3,
  seller_input: 4,
  booking_amount: 5,
  code: 6,
  ads: 7,
  type: 8,
  car: 9,
  plate: 10,
  customer_name: 11,
  province: 12,
  car_formula: 13,
} as const;

export const LIVE_COL = {
  date: 0,
  time: 1,
  team: 2,
  host_1: 3,
  host_2: 4,
  host_3: 5,
  host_4: 6,
  host_5: 7,
  topic: 8,
  inbox: 9,
  lead_count: 10,
} as const;

export const FOLLOWUP_COL = {
  name: 0,
  clip_date: 1,
} as const;

export const EMPLOYEE_COL = {
  user_id: 0,
  display_name: 1,
  picture_url: 2,
  group_id: 3,
  reply_token: 4,
  nickname: 5,
  position: 6,
} as const;

// ── Google Sheets auth via google-auth-library + native fetch ──
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";

function getAuth(): GoogleAuth {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  // Strip surrounding quotes if present
  if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
    rawKey = rawKey.slice(1, -1);
  }
  // Replace literal \n with real newlines
  const key = rawKey.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY env vars");
  }
  return new GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

// ── Fetch a single sheet → array of row arrays ──
export async function fetchSheet(
  configKey: keyof typeof SHEET_CONFIG
): Promise<string[][]> {
  const auth = getAuth();
  const client = await auth.getClient();
  const tokenRes = await client.getAccessToken();
  const token = typeof tokenRes === "string" ? tokenRes : tokenRes?.token;

  const cfg = SHEET_CONFIG[configKey];
  const range = encodeURIComponent(`'${cfg.sheetName}'`);
  const url = `${SHEETS_API}/${cfg.spreadsheetId}/values/${range}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API error (${configKey}): ${res.status} ${body}`);
  }

  const data = await res.json();
  const rows: string[][] = data.values || [];
  // Skip header row (row 0)
  return rows.slice(1);
}

// ── Fetch all 6 sheets in parallel ──
export async function fetchAllSheets() {
  const [leads, salesReports, bookings, liveSessions, liveFollowups, employees] =
    await Promise.all([
      fetchSheet("leads"),
      fetchSheet("sales_reports"),
      fetchSheet("bookings"),
      fetchSheet("live_sessions"),
      fetchSheet("live_followups"),
      fetchSheet("employees"),
    ]);

  return { leads, salesReports, bookings, liveSessions, liveFollowups, employees };
}

// ── Helper: safe get cell value ──
export function cell(row: string[], index: number): string {
  return (row[index] || "").trim();
}

export function cellNum(row: string[], index: number): number {
  const v = cell(row, index).replace(/[,\s]/g, "");
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function cellBool(row: string[], index: number): boolean {
  const v = cell(row, index).toLowerCase();
  return v === "ส่งแล้ว" || v === "true" || v === "yes" || v === "1";
}
