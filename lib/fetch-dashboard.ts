import {
  fetchAllSheets,
  cell, cellNum,
  LEADS_COL as L,
  SALES_COL as S,
  BOOKINGS_COL as B,
  LIVE_COL as LV,
  FOLLOWUP_COL as FU,
  EMPLOYEE_COL as EM,
} from "./google-sheets";
import {
  normalizeSeller,
  TEAMS, TARGETS, ALL_SELLERS, TEAM_ID, RJ_TYPES,
} from "./constants";
import type {
  DashboardData,
  SummaryData,
  TodaySummary,
  SellerData,
  TeamData,
  FollowCase,
  BookingCase,
  LiveActivity,
  LiveSession,
  LiveHostStats,
} from "./types";

// ── Follow status keywords (from original v7 HTML) ──
const FOLLOW_KEYWORDS = ["ติดตาม", "รอตอบ", "รอลูกค้า", "โทรไม่รับ", "ผิดนัด"];

function isFollow(status: string): boolean {
  if (!status) return false;
  const lower = status.toLowerCase();
  return FOLLOW_KEYWORDS.some((kw) => lower.includes(kw));
}

function isVacant(status: string): boolean {
  return !status || status === "-" || status === "";
}

// ── Helpers ──────────────────────────────────────────
function bangkokNow(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" })
  );
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === "-") return null;
  // Handle Excel serial date numbers (e.g., "46037")
  if (/^\d{4,5}$/.test(dateStr.trim())) {
    const serial = parseInt(dateStr.trim());
    if (serial > 1000 && serial < 100000) {
      // Excel epoch: 1900-01-01, but Excel has a bug treating 1900 as leap year
      const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
      const d = new Date(excelEpoch.getTime() + serial * 86400000);
      if (!isNaN(d.getTime())) return d;
    }
  }
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    let year = parseInt(parts[2]);
    if (year < 100) year += 2000;
    if (year > 2500) year -= 543;
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  } catch { /* ignore */ }
  return null;
}

function isThisYear(dateStr: string): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  return d.getFullYear() === bangkokNow().getFullYear();
}

function isToday(dateStr: string): boolean {
  const d = parseDate(dateStr);
  if (!d) return false;
  const now = bangkokNow();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

// ── Main ─────────────────────────────────────────────
export async function fetchDashboardData(): Promise<DashboardData> {
  const {
    leads: rawLeads, salesReports, bookings: rawBookings,
    liveSessions, liveFollowups, employees,
  } = await fetchAllSheets();

  const now = bangkokNow();
  const month = now.getMonth() + 1;
  const yearFull = now.getFullYear();
  const weeksElapsed = Math.ceil(now.getDate() / 7);
  const clipMonthTarget = weeksElapsed * 2;

  // userIdMap
  const userIdMap: Record<string, string> = {};
  employees.forEach((row) => {
    const uid = cell(row, EM.user_id);
    const nickname = cell(row, EM.nickname);
    if (uid && nickname) userIdMap[uid] = nickname;
  });

  // Filter leads from January
  const yearLeads = rawLeads.filter((r) => isThisYear(cell(r, L.received_date)));
  const todayLeads = rawLeads.filter((r) => isToday(cell(r, L.received_date)));

  // Jongs from bookings sheet
  interface Jong { seller: string; date: string; code: string; }
  const jongs: Jong[] = [];
  rawBookings.forEach((r) => {
    const dateStr = cell(r, B.date);
    if (!/^\d+\/\d+\/\d{2,4}$/.test(dateStr)) return;
    const seller = normalizeSeller(cell(r, B.sales_rep));
    if (!seller || seller === "เซลล์" || seller === "DATE") return;
    if (seller.startsWith("รวม") || seller.startsWith("**")) return;
    jongs.push({ seller, date: dateStr, code: cell(r, B.code) });
  });
  const yearJongs = jongs.filter((j) => isThisYear(j.date));

  // BookingCases from sales_reports
  const bookingCases: BookingCase[] = [];
  salesReports.forEach((r) => {
    const sellerCell = cell(r, S.sales_rep);
    const seller = normalizeSeller(
      sellerCell.replace("ชื่อเซลล์ ", "").replace("ชื่อเซลล์", "").trim()
    );
    const seq = cell(r, S.order_num);
    if (!seq || seq === "ลำดับ" || isNaN(Number(seq))) return;
    const status = cell(r, S.status);
    if (!status) return;
    bookingCases.push({
      seller,
      status: status.replace(" (ซื้อสด)", "").trim(),
      isCash: status.includes("(ซื้อสด)"),
      customer: cell(r, S.customer_name),
      phone: cell(r, S.phone),
      car: cell(r, S.car_detail),
      year: cell(r, S.car_year),
      plate: cell(r, S.license_plate),
      price: cellNum(r, S.sale_price),
      deposit: cellNum(r, S.deposit_amount),
      leadCode: cell(r, S.lead_code),
      date: cell(r, S.date),
      signDate: cell(r, S.sign_date),
      resultDate: cell(r, S.result_date),
      docsDate: cell(r, S.doc_complete_date),
      releaseDate: cell(r, S.car_release_date),
      finance: cell(r, S.finance_main),
      grade: cell(r, S.grade),
      note: cell(r, S.note),
    });
  });

  // Live sessions from January
  const yearLive = liveSessions.filter((r) => isThisYear(cell(r, LV.date)));

  // Clips from January
  const yearClips: { name: string; date: string }[] = [];
  liveFollowups.forEach((row) => {
    const name = normalizeSeller(cell(row, FU.name));
    const date = cell(row, FU.clip_date);
    if (!name || !date || !ALL_SELLERS.includes(name)) return;
    if (isThisYear(date)) yearClips.push({ name, date });
  });

  // Aggregate live/clip
  const liveCountMap: Record<string, number> = {};
  const liveInboxMap: Record<string, number> = {};
  const liveLeadMap: Record<string, number> = {};
  const clipCountMap: Record<string, number> = {};

  yearLive.forEach((r) => {
    for (let i = 0; i < 5; i++) {
      const h = normalizeSeller(cell(r, LV.host_1 + i));
      if (h && h !== "-" && h !== "nan") {
        liveCountMap[h] = (liveCountMap[h] || 0) + 1;
        liveInboxMap[h] = (liveInboxMap[h] || 0) + cellNum(r, LV.inbox);
        liveLeadMap[h] = (liveLeadMap[h] || 0) + cellNum(r, LV.lead_count);
      }
    }
  });
  yearClips.forEach((c) => {
    clipCountMap[c.name] = (clipCountMap[c.name] || 0) + 1;
  });

  // Jong per seller
  const jongBySeller: Record<string, number> = {};
  yearJongs.forEach((j) => {
    jongBySeller[j.seller] = (jongBySeller[j.seller] || 0) + 1;
  });

  // Summary
  const leadNormal = yearLeads.filter((r) => !RJ_TYPES.includes(cell(r, L.type))).length;
  const leadRJ = yearLeads.filter((r) => RJ_TYPES.includes(cell(r, L.type))).length;
  const totalDone = bookingCases.filter((b) => b.status === "ปล่อย").length;
  const totalTarget = Object.values(TARGETS).reduce((a, b) => a + b, 0);
  const totalFollow = yearLeads.filter((r) => isFollow(cell(r, L.admin_status))).length;
  const totalVacant = yearLeads.filter((r) => isVacant(cell(r, L.admin_status))).length;

  const summary: SummaryData = {
    totalLeads: yearLeads.length, leadNormal, leadRJ,
    totalFollow, totalVacant, totalDone, totalTarget,
    totalBookings: yearJongs.length,
  };

  // Pipeline
  const pipeline: Record<string, number> = {
    "จอง": yearJongs.length,
    "รอเซ็นต์": bookingCases.filter((b) => b.status === "รอเซ็นต์").length,
    "รอผล": bookingCases.filter((b) => b.status === "รอผล").length,
    "รอปล่อย": bookingCases.filter((b) => b.status === "รอปล่อย").length,
    "ปล่อย": bookingCases.filter((b) => b.status === "ปล่อย").length,
    "รีเจ็ก": bookingCases.filter((b) => b.status === "รีเจ็ก").length,
  };

  // Sellers
  const sellers: SellerData[] = ALL_SELLERS.map((name) => {
    const sl = yearLeads.filter((r) => normalizeSeller(cell(r, L.sales_rep)) === name);
    const sb = bookingCases.filter((b) => b.seller === name);
    const follow = sl.filter((r) => isFollow(cell(r, L.admin_status))).length;
    const vacant = sl.filter((r) => isVacant(cell(r, L.admin_status))).length;
    const done = sb.filter((b) => b.status === "ปล่อย").length;
    const leadTypes: Record<string, number> = {};
    sl.forEach((r) => {
      const t = cell(r, L.type) || "ไม่ระบุ";
      leadTypes[t] = (leadTypes[t] || 0) + 1;
    });
    return {
      name, team: TEAM_ID[name] || "?",
      lead: sl.length, follow, vacant, done,
      target: TARGETS[name] || 0,
      booking: jongBySeller[name] || 0,
      live: liveCountMap[name] || 0,
      clip: clipCountMap[name] || 0,
      clipTarget: clipMonthTarget,
      liveInbox: liveInboxMap[name] || 0,
      liveLead: liveLeadMap[name] || 0,
      leadTypes,
    };
  }).filter((s) => s.lead > 0 || s.done > 0 || s.booking > 0);

  // ADMIN seller
  const adminLeads = yearLeads.filter((r) => normalizeSeller(cell(r, L.sales_rep)) === "ADMIN");
  if (adminLeads.length > 0) {
    const adminFollow = adminLeads.filter((r) => isFollow(cell(r, L.admin_status))).length;
    const adminVacant = adminLeads.filter((r) => isVacant(cell(r, L.admin_status))).length;
    const adminDone = bookingCases.filter((b) => b.seller === "ADMIN" && b.status === "ปล่อย").length;
    const adminBooking = yearJongs.filter((b) => b.seller === "ADMIN").length;
    const adminTypes: Record<string, number> = {};
    adminLeads.forEach((r) => {
      const t = cell(r, L.type) || "ไม่ระบุ";
      adminTypes[t] = (adminTypes[t] || 0) + 1;
    });
    sellers.push({
      name: "ADMIN", team: "ADMIN",
      lead: adminLeads.length, follow: adminFollow,
      vacant: adminVacant, done: adminDone,
      target: 0, booking: adminBooking,
      live: 0, clip: 0, clipTarget: 0,
      liveInbox: 0, liveLead: 0,
      leadTypes: adminTypes,
    });
  }

  // Teams
  const teams: Record<string, TeamData> = {};
  Object.entries(TEAMS).forEach(([tid, members]) => {
    const ms = sellers.filter((s) => members.includes(s.name));
    teams[tid] = {
      members,
      lead: ms.reduce((a, s) => a + s.lead, 0),
      follow: ms.reduce((a, s) => a + s.follow, 0),
      vacant: ms.reduce((a, s) => a + s.vacant, 0),
      done: ms.reduce((a, s) => a + s.done, 0),
      target: ms.reduce((a, s) => a + s.target, 0),
      booking: ms.reduce((a, s) => a + s.booking, 0),
      live: ms.reduce((a, s) => a + s.live, 0),
      clip: ms.reduce((a, s) => a + s.clip, 0),
      clipTarget: members.length * clipMonthTarget,
    };
  });

  // Follow Cases
  const followCases: FollowCase[] = yearLeads
    .filter((r) => isFollow(cell(r, L.admin_status)))
    .map((r) => ({
      code: cell(r, L.lead_code) || "-",
      seller: normalizeSeller(cell(r, L.sales_rep)) || "-",
      phone: cell(r, L.phone) || "-",
      channel: cell(r, L.channel) || "-",
      leadType: cell(r, L.type),
      car: cell(r, L.car_inquiry) || cell(r, L.car_formula) || "-",
      adminStatus: cell(r, L.admin_status) || "ติดตาม",
      callProof: cell(r, L.call_proof) || "-",
      profile: cell(r, L.customer_profile) || "",
      dateIn: cell(r, L.received_date) || "-",
      timeIn: cell(r, L.time),
      note: (cell(r, L.fill_sheet_note) || "-").replace(/^\d{4,5}\s*/, "") || "-",
      lastUpdate: cell(r, L.last_updated_at) || "-",
      updateCount: cellNum(r, L.update_count),
    }))
    .filter((r) => r.seller !== "-");

  // Today summary
  const todayBySeller: Record<string, { lead: number; follow: number; vacant: number }> = {};
  todayLeads.forEach((r) => {
    const s = normalizeSeller(cell(r, L.sales_rep));
    if (!s) return;
    if (!todayBySeller[s]) todayBySeller[s] = { lead: 0, follow: 0, vacant: 0 };
    todayBySeller[s].lead++;
    const st = cell(r, L.admin_status);
    if (isFollow(st)) todayBySeller[s].follow++;
    if (isVacant(st)) todayBySeller[s].vacant++;
  });

  const today: TodaySummary = {
    totalLeads: todayLeads.length,
    totalFollow: todayLeads.filter((r) => isFollow(cell(r, L.admin_status))).length,
    totalVacant: todayLeads.filter((r) => isVacant(cell(r, L.admin_status))).length,
    bySeller: todayBySeller,
  };

  // Live Activity
  const liveSess: LiveSession[] = yearLive.map((r) => {
    const hosts: string[] = [];
    for (let i = 0; i < 5; i++) {
      const h = normalizeSeller(cell(r, LV.host_1 + i));
      if (h && h !== "-" && h !== "nan") hosts.push(h);
    }
    return {
      date: cell(r, LV.date),
      time: cell(r, LV.time),
      team: cell(r, LV.team),
      hosts,
      topic: cell(r, LV.topic),
      inbox: cellNum(r, LV.inbox),
      lead: cellNum(r, LV.lead_count),
    };
  });

  const byHost: Record<string, LiveHostStats> = {};
  ALL_SELLERS.forEach((n) => {
    byHost[n] = {
      sessions: liveCountMap[n] || 0,
      inbox: liveInboxMap[n] || 0,
      lead: liveLeadMap[n] || 0,
      clip: clipCountMap[n] || 0,
    };
  });

  const liveActivity: LiveActivity = {
    totalSessions: yearLive.length,
    totalInbox: yearLive.reduce((a, r) => a + cellNum(r, LV.inbox), 0),
    totalLead: yearLive.reduce((a, r) => a + cellNum(r, LV.lead_count), 0),
    byHost,
    sessions: liveSess,
  };


  // Monthly Summary
  function getMonth(dateStr: string): number {
    if (!dateStr || dateStr === "-") return 0;
    // Handle Excel serial date
    if (/^\d{4,5}$/.test(dateStr.trim())) {
      const d = parseDate(dateStr);
      return d ? d.getMonth() + 1 : 0;
    }
    const p = dateStr.split("/");
    return p.length >= 2 ? parseInt(p[1]) || 0 : 0;
  }

  // For "ปล่อย" cases: use releaseDate first, fallback to date
  function getDoneMonth(b: BookingCase): number {
    if (b.releaseDate && b.releaseDate !== "-" && b.releaseDate !== "") {
      const m = getMonth(b.releaseDate);
      if (m > 0) return m;
    }
    return getMonth(b.date);
  }

  const monthlySummary: Record<number, {
    totalLeads: number; leadNormal: number; leadRJ: number;
    totalFollow: number; totalVacant: number; totalDone: number;
    totalBookings: number;
    pipeline: Record<string, number>;
    sellers: Record<string, { lead: number; follow: number; vacant: number; done: number; booking: number }>;
    teams: Record<string, { lead: number; follow: number; vacant: number; done: number; booking: number }>;
  }> = {};

  for (let m = 1; m <= 12; m++) {
    const mLeads = yearLeads.filter((r) => getMonth(cell(r, L.received_date)) === m);
    const mJongs = yearJongs.filter((j) => getMonth(j.date) === m);
    const mLN = mLeads.filter((r) => !RJ_TYPES.includes(cell(r, L.type))).length;
    const mLR = mLeads.filter((r) => RJ_TYPES.includes(cell(r, L.type))).length;
    const mFollow = mLeads.filter((r) => isFollow(cell(r, L.admin_status))).length;
    const mVacant = mLeads.filter((r) => isVacant(cell(r, L.admin_status))).length;

    // For non-ปล่อย statuses, filter by booking date
    const mBookings = bookingCases.filter((b) => getMonth(b.date) === m);
    // For ปล่อย, filter by releaseDate (fallback to date)
    const mDone = bookingCases.filter((b) => b.status === "ปล่อย" && getDoneMonth(b) === m);
    const mPipeline: Record<string, number> = {
      "จอง": mJongs.length,
      "รอเซ็นต์": mBookings.filter((b) => b.status === "รอเซ็นต์").length,
      "รอผล": mBookings.filter((b) => b.status === "รอผล").length,
      "รอปล่อย": mBookings.filter((b) => b.status === "รอปล่อย").length,
      "ปล่อย": mDone.length,
      "รีเจ็ก": mBookings.filter((b) => b.status === "รีเจ็ก").length,
    };

    const mSellers: Record<string, { lead: number; follow: number; vacant: number; done: number; booking: number }> = {};
    const mJongBySeller: Record<string, number> = {};
    mJongs.forEach((j) => { mJongBySeller[j.seller] = (mJongBySeller[j.seller] || 0) + 1; });

    ALL_SELLERS.forEach((name) => {
      const sl = mLeads.filter((r) => normalizeSeller(cell(r, L.sales_rep)) === name);
      const sbDone = mDone.filter((b) => b.seller === name);
      mSellers[name] = {
        lead: sl.length,
        follow: sl.filter((r) => isFollow(cell(r, L.admin_status))).length,
        vacant: sl.filter((r) => isVacant(cell(r, L.admin_status))).length,
        done: sbDone.length,
        booking: mJongBySeller[name] || 0,
      };
    });

    const mTeams: Record<string, { lead: number; follow: number; vacant: number; done: number; booking: number }> = {};
    Object.entries(TEAMS).forEach(([tid, members]) => {
      const ts = members.reduce((acc, n) => {
        const s = mSellers[n] || { lead: 0, follow: 0, vacant: 0, done: 0, booking: 0 };
        return {
          lead: acc.lead + s.lead, follow: acc.follow + s.follow,
          vacant: acc.vacant + s.vacant, done: acc.done + s.done,
          booking: acc.booking + s.booking,
        };
      }, { lead: 0, follow: 0, vacant: 0, done: 0, booking: 0 });
      mTeams[tid] = ts;
    });

    monthlySummary[m] = {
      totalLeads: mLeads.length, leadNormal: mLN, leadRJ: mLR,
      totalFollow: mFollow, totalVacant: mVacant,
      totalDone: mDone.length,
      totalBookings: mJongs.length,
      pipeline: mPipeline,
      sellers: mSellers,
      teams: mTeams,
    };
  }

  return {
    meta: { generatedAt: now.toISOString(), month, year: yearFull, weeksElapsed, clipMonthTarget },
    summary, today, pipeline, teams, sellers,
    followCases, bookingCases, liveActivity, userIdMap,
    monthlySummary,
  };
}
