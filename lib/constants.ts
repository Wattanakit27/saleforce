export const UPD_TGT = 4;
export const LIVE_TGT = 4;
export const PAGE_SIZE = 15;

// ── Seller name normalization ──
export const SELLER_MAP: Record<string, string> = {
  "เจเจ": "เจ",
  "กลอฟ": "กอล์ฟ",
  "แซนด์": "แซน",
};

export function normalizeSeller(name: string): string {
  return SELLER_MAP[name] || name;
}

// ── Teams & Targets (hardcoded from business) ──
export const TEAMS: Record<string, string[]> = {
  A: ["โอ๊ต", "เฟิร์ส", "เจ", "บอย", "นั่ม", "กอล์ฟ"],
  B: ["นวล", "เก้า", "มด", "มัท", "อุ้ม", "แซน"],
  C: ["ใบตอง"],
};

export const TARGETS: Record<string, number> = {
  "โอ๊ต": 8, "เฟิร์ส": 12, "เจ": 7, "บอย": 8, "นั่ม": 6, "กอล์ฟ": 2,
  "นวล": 10, "เก้า": 8, "มด": 6, "มัท": 8, "อุ้ม": 8, "แซน": 2,
  "ใบตอง": 2,
};

export const ALL_SELLERS: string[] = Object.values(TEAMS).flat();

export const TEAM_ID: Record<string, string> = {};
Object.entries(TEAMS).forEach(([t, ms]) =>
  ms.forEach((n) => { TEAM_ID[n] = t; })
);

export const RJ_TYPES = ["RJ", "Hot RJ", "Hot RB"];

export const STATUS_COLOR: Record<string, string> = {
  "จอง": "#f59e0b",
  "รอเซ็นต์": "#3b82f6",
  "รอผล": "#f97316",
  "รอปล่อย": "#8b5cf6",
  "ปล่อย": "#10b981",
  "รีเจ็ก": "#ef4444",
};

export const STATUS_ORDER = ["จอง", "รอเซ็นต์", "รอผล", "รอปล่อย", "ปล่อย", "รีเจ็ก"];

export const TEAM_COLORS: Record<string, string> = {
  A: "var(--tA)",
  B: "var(--tB)",
  C: "var(--tC)",
  ADMIN: "var(--amber-mid)",
};

export const TEAM_NAMES: Record<string, string> = {
  A: "ทีม A",
  B: "ทีม B",
  C: "ทีม C",
  ADMIN: "ADMIN",
};

export const MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

export const MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

export const LT_COLORS: Record<string, string> = {
  NLD: "var(--blue)",
  BLD: "var(--green)",
  TLD: "var(--purple-mid)",
  WLD: "var(--amber-mid)",
  HLD: "var(--green-mid)",
  RJ: "var(--red)",
  "Hot RJ": "var(--red)",
  "Hot RB": "var(--red-mid)",
};
