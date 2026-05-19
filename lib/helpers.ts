import { UPD_TGT } from "./constants";

export function pct(a: number, b: number): number {
  return b > 0 ? Math.round((a / b) * 100) : 0;
}

export function nc(u: number): number {
  return Math.max(0, UPD_TGT - u);
}

export function urg(l: { updateCount: number }): number {
  let s = l.updateCount === 0 ? 100 : 0;
  s += nc(l.updateCount) * 10;
  return s;
}

export function nocar(c: string | null | undefined): boolean {
  return !c || c === "ลูกค้าไม่ตอบ" || c === "รถที่ไม่ได้ทำการตลาด" || c === "-";
}

export function empty(v: string | null | undefined): boolean {
  return !v || v === "-" || v === "";
}

export function todayDay(): number {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  ).getDate();
}

export function todayMonth(): number {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  ).getMonth() + 1;
}

export function inRange(dateStr: string | undefined, dfFrom: number, dfTo: number): boolean {
  if (!dfFrom && !dfTo) return true;
  const d = parseInt((dateStr || "").split("/")[0]);
  if (isNaN(d)) return true;
  if (dfFrom && d < dfFrom) return false;
  if (dfTo && d > dfTo) return false;
  return true;
}

// dfMonth: 0 = ทั้งหมด, -1 = วันนี้, 1-12 = เดือนนั้น
export function passMonth(dateStr: string | undefined, dfMonth: number): boolean {
  if (dfMonth === 0) return true;
  const parts = (dateStr || "").split("/");
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  if (isNaN(day) || isNaN(month)) return true;
  if (dfMonth === -1) {
    return day === todayDay() && month === todayMonth();
  }
  return month === dfMonth;
}

export function parseNoteHistory(note: string): string[] {
  if (!note || note === "-") return [];
  return note
    .replace(/^\d{4,5}\s*/, "")
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s && s !== "-");
}

export function dots(u: number): string {
  let h = "";
  for (let i = 0; i < UPD_TGT; i++) {
    const f = i < u;
    const c = f
      ? u >= UPD_TGT
        ? "#3B6D11"
        : u >= 3
          ? "#1D9E75"
          : u >= 2
            ? "#EF9F27"
            : "#E24B4A"
      : "#ccc";
    h += `<span class="dot" style="background:${c}"></span>`;
  }
  return `<span style="display:flex;align-items:center">${h}<span style="font-size:10px;color:var(--t3);margin-left:2px">${u}/${UPD_TGT}</span></span>`;
}

export function urgBadge(l: { updateCount: number }): string {
  const n = nc(l.updateCount);
  const noC = l.updateCount === 0;
  if (noC) return `<span class="bdg" style="background:var(--red-bg);color:var(--red)">ยังไม่โทร</span>`;
  if (n >= 3) return `<span class="bdg" style="background:var(--red-bg);color:var(--red)">+${n}</span>`;
  if (n >= 1) return `<span class="bdg" style="background:var(--amber-bg);color:var(--amber)">+${n}</span>`;
  return `<span class="bdg" style="background:var(--green-bg);color:var(--green)">✓</span>`;
}
