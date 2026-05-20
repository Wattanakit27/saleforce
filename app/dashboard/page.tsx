"use client";

import { useState, useCallback, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import { useDashboard } from "@/lib/use-dashboard";
import { isAdmin } from "@/lib/auth";
import {
  UPD_TGT,
  PAGE_SIZE,
  STATUS_COLOR,
  STATUS_ORDER,
  TEAM_COLORS,
  TEAM_NAMES,
  LT_COLORS,
  MONTHS_SHORT,
  MONTHS_FULL,
} from "@/lib/constants";
import {
  pct,
  nc,
  urg,
  nocar,
  empty,
  passMonth,
  parseNoteHistory,
  dots,
  urgBadge,
} from "@/lib/helpers";
import type { DashboardData, FollowCase, BookingCase, SellerData } from "@/lib/types";

type Tab = "o" | "a" | "b" | "s";
// dfMonth: 0 = ทั้งหมด, -1 = วันนี้, 1-12 = เดือน
type DfPreset = number;

export default function DashboardPageWrapper() {
  return (
    <Suspense fallback={<div className="app"><div className="loading-container"><div className="spin" /><span style={{ fontSize: 13 }}>กำลังโหลด...</span></div></div>}>
      <DashboardPage />
    </Suspense>
  );
}

function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    employee,
    data: D,
    fullData,
    loading,
    error,
    lastFetch,
    admin,
    impersonate,
    setImpersonate,
    loadData,
  } = useDashboard();

  // Read initial state from URL
  const initTab = (searchParams.get("tab") as Tab) || "o";
  const initSeller = searchParams.get("seller") || "";
  const initCase = searchParams.get("case") || null;

  const [tab, setTabState] = useState<Tab>(initTab);
  const [curS, setCurS] = useState(initSeller);
  const [curF, setCurF] = useState("all");
  const [curSo, setCurSo] = useState("urgent");
  const [curMode, setCurMode] = useState<"month" | "today">("month");
  const [lfPage, setLfPage] = useState(1);
  const [dfMonth, setDfMonth] = useState<DfPreset>(0);
  const [showCase, setShowCase] = useState<string | null>(initCase);

  // Sync URL → state on hydration (useState initializer may miss SSR→client transition)
  useEffect(() => {
    const urlTab = searchParams.get("tab") as Tab | null;
    const urlSeller = searchParams.get("seller") || "";
    const urlCase = searchParams.get("case") || null;
    if (urlTab && urlTab !== tab) setTabState(urlTab);
    if (urlSeller && urlSeller !== curS) setCurS(urlSeller);
    if (urlCase !== showCase) setShowCase(urlCase);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state → URL
  const updateUrl = useCallback((t: Tab, seller?: string, caseCode?: string | null) => {
    const params = new URLSearchParams();
    params.set("tab", t);
    if (seller) params.set("seller", seller);
    if (caseCode) params.set("case", caseCode);
    router.replace(`/dashboard?${params.toString()}`, { scroll: false });
  }, [router]);

  const setTab = useCallback((t: Tab) => {
    setTabState(t);
    updateUrl(t);
  }, [updateUrl]);
  const [errVisible, setErrVisible] = useState(true);
  const [msort, setMsort] = useState("lead");
  const [hsel, setHsel] = useState("all");
  const [liveMonth, setLiveMonth] = useState(0); // 0=ทั้งหมด, 1-12=เดือน
  const [liveTeam, setLiveTeam] = useState("all");
  const [followFilter, setFollowFilter] = useState("urgent");
  const [bkSel, setBkSel] = useState("all");
  const [bkStatus, setBkStatus] = useState("all");
  const [searchQ, setSearchQ] = useState("");

  // Set current seller if not set
  const effectiveCurS = curS || (D?.sellers?.[0]?.name ?? "");

  // --- Date filter ---
  const setDf = useCallback((preset: DfPreset) => {
    setDfMonth(preset);
    setLfPage(1);
  }, []);

  const ir = useCallback(
    (dateStr: string | undefined) => passMonth(dateStr, dfMonth),
    [dfMonth]
  );

  // --- Switch tab ---
  const sv = useCallback(
    (v: Tab, seller?: string) => {
      setTabState(v);
      if (v === "s") {
        const s = seller || effectiveCurS;
        setCurS(s);
        setShowCase(null);
        setDfMonth(0);
        updateUrl(v, s);
      } else {
        updateUrl(v);
      }
    },
    [effectiveCurS, updateUrl]
  );

  // --- Case detail with URL sync ---
  const openCase = useCallback((code: string | null, seller?: string) => {
    setShowCase(code);
    const s = seller || curS || effectiveCurS;
    updateUrl("s", s, code);
  }, [curS, effectiveCurS, updateUrl]);

  // --- Diligence map ---
  const dilMap = useMemo(() => {
    const m: Record<string, { tot: number; cnt: number; high: number }> = {};
    (D?.followCases || []).forEach((l) => {
      if (!m[l.seller]) m[l.seller] = { tot: 0, cnt: 0, high: 0 };
      m[l.seller].tot += l.updateCount;
      m[l.seller].cnt++;
      if (l.updateCount >= 3) m[l.seller].high++;
    });
    return m;
  }, [D?.followCases]);

  // === ACCESS DENIED ===
  if (!loading && error === "no_auth") {
    return (
      <div className="app" style={{ textAlign: "center", padding: "60px 20px", color: "var(--t2)" }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>&#x1F512;</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>
          ไม่มีสิทธิ์เข้าถึง
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 14 }}>
          กรุณาเปิดผ่านลิงก์ที่ได้รับจาก LINE — ติดต่อผู้ดูแลระบบ
        </div>
      </div>
    );
  }

  // === LOADING ===
  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="spin" />
          <span style={{ fontSize: 13 }}>กำลังดึงข้อมูล...</span>
        </div>
      </div>
    );
  }

  if (!D) return null;

  const sellers = D.sellers || [];
  const sellerNames = sellers.map((s) => s.name);

  // ====================================================================
  //  RENDER HELPERS (inline, matching original exactly)
  // ====================================================================

  function renderViewerBadge() {
    if (!employee) return null;
    if (admin) {
      if (impersonate) {
        return (
          <span style={{ background: "var(--purple-bg)", color: "var(--purple)", padding: "3px 9px", borderRadius: 14, fontSize: 11, fontWeight: 600, border: ".5px solid var(--purple-mid)" }}>
            &#x1F441;&#xFE0F; ดูในฐานะ {impersonate}
          </span>
        );
      }
      return (
        <span style={{ background: "var(--amber-bg)", color: "var(--amber)", padding: "3px 9px", borderRadius: 14, fontSize: 11, fontWeight: 600, border: ".5px solid var(--amber-mid)" }}>
          &#x1F451; Admin (ทั้งหมด)
        </span>
      );
    }
    return (
      <span style={{ background: "var(--blue-bg)", color: "var(--blue)", padding: "3px 9px", borderRadius: 14, fontSize: 11, fontWeight: 600, border: ".5px solid var(--blue)" }}>
        &#x1F464; {employee.nickname}
      </span>
    );
  }

  function renderImpersonateSwitcher() {
    if (!admin || !fullData) return null;
    const names = (fullData.sellers || []).map((s) => s.name);
    return (
      <select
        value={impersonate || ""}
        onChange={(e) => setImpersonate(e.target.value || null)}
        style={{ fontSize: 11, padding: "3px 9px", borderRadius: 14, border: ".5px solid var(--bd2)", background: "var(--bg2)", color: "var(--t1)", cursor: "pointer", fontFamily: "inherit" }}
      >
        <option value="">&#x1F451; Admin (ทั้งหมด)</option>
        {names.map((n) => (
          <option key={n} value={n}>&#x1F441;&#xFE0F; ดูในฐานะ {n}</option>
        ))}
      </select>
    );
  }

  // === DATE FILTER BAR ===
  function renderDateFilterBar() {
    const presets: { id: DfPreset; label: string }[] = [
      { id: 0, label: "ทั้งหมด" },
      { id: -1, label: "วันนี้" },
      ...MONTHS_SHORT.map((m, i) => ({ id: (i + 1) as DfPreset, label: m })),
    ];
    const dfCount = dfMonth !== 0
      ? (D?.followCases || []).filter((l) => ir(l.dateIn)).length
      : 0;

    return (
      <div className="df-bar">
        <span className="df-label">&#x1F4C5; กรองวันที่รับเคส:</span>
        {presets.map((p) => (
          <button
            key={p.id}
            className={`df-btn${dfMonth === p.id ? " on" : ""}`}
            onClick={() => setDf(p.id)}
          >
            {p.label}
          </button>
        ))}
        {dfMonth !== 0 && (
          <span style={{ fontSize: 11, color: "var(--blue)", fontWeight: 500, marginLeft: 4 }}>
            ในช่วงนี้: {dfCount} เคส
          </span>
        )}
      </div>
    );
  }

  // ====================================================================
  //  OVERVIEW TAB
  // ====================================================================
  function renderOverview() {
    const isToday = curMode === "today";
    // เลือก summary ตาม mode + เดือนที่กรอง
    const ms = (dfMonth > 0 && D?.monthlySummary?.[dfMonth]) ? D.monthlySummary[dfMonth] : null;
    const sm = isToday
      ? (D!.today || D!.summary)
      : (ms || D!.summary);
    const pl = ms ? ms.pipeline : D!.pipeline;
    const clipTgt = D?.meta?.clipMonthTarget || 4;

    const MONTHS_FULL = ["","มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const modeLabel = isToday
      ? "วันที่ " + new Date().toLocaleDateString("th-TH", { day: "numeric", month: "short" })
      : dfMonth > 0
        ? "เดือน" + MONTHS_FULL[dfMonth]
        : "ทั้งปี " + new Date().getFullYear();

    const kpis = [
      { l: "Lead" + (isToday ? " วันนี้" : dfMonth > 0 ? " เดือนนี้" : " ทั้งปี"), v: sm.totalLeads || 0, s: "รายการ", c: "var(--t1)" },
      { l: "ติดตามอยู่", v: sm.totalFollow || 0, s: pct(sm.totalFollow || 0, sm.totalLeads || 1) + "%", c: "var(--blue)" },
      { l: "จองแล้ว", v: ms ? ms.totalBookings : D!.summary.totalBookings, s: "Conv " + pct(ms ? ms.totalBookings : D!.summary.totalBookings, sm.totalLeads || 1) + "%", c: "var(--green)" },
      { l: "ปิดได้", v: ms ? ms.totalDone : D!.summary.totalDone, s: pct(ms ? ms.totalDone : D!.summary.totalDone, D!.summary.totalTarget) + "% ของเป้า", c: "var(--green-mid)" },
      { l: "เป้าหมาย", v: D!.summary.totalTarget, s: "เคส/เดือน", c: "var(--amber)" },
      { l: "RJ", v: ms ? ms.leadRJ : D!.summary.leadRJ, s: "จาก " + (ms ? ms.leadNormal : D!.summary.leadNormal) + " ปกติ", c: "var(--red)" },
    ];

    const pipeColors: Record<string, string> = {
      "รอเซ็นต์": "var(--blue)", "รอผล": "var(--amber)", "รอปล่อย": "var(--amber)",
      "ปล่อย": "var(--green-mid)", "รีเจ็ก": "var(--red)", "จอง": "var(--green)",
    };

    // Sorted sellers
    let ss = [...sellers];
    if (msort === "booking") ss.sort((a, b) => b.booking - a.booking);
    else if (msort === "diligent") ss.sort((a, b) => (dilMap[b.name]?.tot || 0) - (dilMap[a.name]?.tot || 0));
    else if (msort === "done") ss.sort((a, b) => b.done - a.done);
    else ss.sort((a, b) => b.lead - a.lead);

    // No-update panel
    const nu: Record<string, number> = {};
    (D?.followCases || []).filter((l) => l.updateCount === 0 && ir(l.dateIn)).forEach((l) => { nu[l.seller] = (nu[l.seller] || 0) + 1; });

    // Top booking
    const topBook = [...sellers].sort((a, b) => b.booking - a.booking).slice(0, 6);
    const medals = ["🥇", "🥈", "🥉", "4.", "5.", "6."];

    // Top diligent
    const dilEntries = Object.entries(dilMap).map(([n, d]) => ({
      n, avg: d.cnt ? Math.round((d.tot / d.cnt) * 10) / 10 : 0, high: d.high,
    })).sort((a, b) => b.avg - a.avg).slice(0, 6);

    return (
      <div>
        {/* Mode toggle */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--t2)" }}>แสดงข้อมูล:</span>
          <button className={`sbtn${curMode === "month" ? " on" : ""}`} onClick={() => setCurMode("month")}>เดือนนี้</button>
          <button className={`sbtn${curMode === "today" ? " on" : ""}`} onClick={() => setCurMode("today")}>วันนี้</button>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>{modeLabel}</span>
        </div>

        {/* KPI Grid */}
        <div className="kgrid">
          {kpis.map((k, i) => (
            <div className="kpi" key={i}>
              <div className="kl">{k.l}</div>
              <div className="kv" style={{ color: k.c }}>{(k.v || 0).toLocaleString()}</div>
              <div className="ks">{k.s}</div>
            </div>
          ))}
        </div>

        {/* Date filter results panel */}
        {dfMonth !== 0 && renderDfResultPanel()}

        {/* Pipeline */}
        <div className="card">
          <div className="card-title">&#x1F4CB; Pipeline ดีล</div>
          <div className="pipe-row">
            {Object.entries(pl).map(([k, v]) => (
              <div className="pipe-item" key={k}>
                <div className="pipe-num" style={{ color: pipeColors[k] || "var(--t1)" }}>{v}</div>
                <div className="pipe-lbl">{k}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Teams */}
        <div className="card">
          <div className="card-title">&#x1F465; แยกตามทีม</div>
          {Object.entries(D!.teams || {}).map(([tid, t]) => {
            const mt = ms?.teams?.[tid];
            const tLead = mt ? mt.lead : t.lead;
            const tFollow = mt ? mt.follow : t.follow;
            const tBooking = mt ? mt.booking : t.booking;
            const tDone = mt ? mt.done : t.done;
            const conv = pct(tBooking, tLead);
            const tPct = pct(tDone, t.target);
            const cPct = t.clipTarget > 0 ? Math.min((t.clip / t.clipTarget) * 100, 100) : 0;
            return (
              <div className={`team-card ${tid}`} key={tid}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEAM_COLORS[tid] }}>{TEAM_NAMES[tid]}</span>
                  <span style={{ fontSize: 11, color: "var(--t2)" }}>{t.members.join(" · ")}</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6, marginBottom: 6, textAlign: "center" }}>
                  <div><div style={{ fontSize: 10, color: "var(--t3)" }}>Lead</div><div style={{ fontSize: 15, fontWeight: 600, color: TEAM_COLORS[tid] }}>{tLead}</div></div>
                  <div><div style={{ fontSize: 10, color: "var(--t3)" }}>ติดตาม</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--blue)" }}>{tFollow}</div></div>
                  <div><div style={{ fontSize: 10, color: "var(--t3)" }}>จอง</div><div style={{ fontSize: 15, fontWeight: 600, color: "var(--green)" }}>{tBooking}</div></div>
                  <div><div style={{ fontSize: 10, color: "var(--t3)" }}>ปิด/เป้า</div><div style={{ fontSize: 15, fontWeight: 600, color: tDone >= t.target ? "var(--green)" : "var(--amber)" }}>{tDone}/{t.target}</div></div>
                  <div><div style={{ fontSize: 10, color: "var(--t3)" }}>Conv</div><div style={{ fontSize: 15, fontWeight: 600, color: conv >= 8 ? "var(--green)" : conv >= 4 ? "var(--amber)" : "var(--red)" }}>{conv}%</div></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                      <span style={{ color: "var(--t3)" }}>เป้าจบ {t.done}/{t.target}</span>
                      <span style={{ color: TEAM_COLORS[tid] }}>{tPct}%</span>
                    </div>
                    <div className="pbr" style={{ height: 5 }}><div className="pbf" style={{ width: `${Math.min(tPct, 100)}%`, background: TEAM_COLORS[tid] }} /></div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 2 }}>
                      <span style={{ color: "var(--t3)" }}>&#x1F4E1;{t.live} &#x1F3AC;{t.clip}/{t.clipTarget}</span>
                      <span style={{ color: t.clip >= t.clipTarget ? "var(--green)" : "var(--amber)" }}>{Math.round(cPct)}%</span>
                    </div>
                    <div className="pbr" style={{ height: 5 }}><div className="pbf" style={{ width: `${Math.min(cPct, 100)}%`, background: t.clip >= t.clipTarget ? "var(--green-mid)" : "var(--purple-mid)" }} /></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Seller table */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
            <div className="card-title" style={{ margin: 0 }}>สรุปรายเซลล์</div>
            <select value={msort} onChange={(e) => setMsort(e.target.value)}>
              <option value="lead">Lead มากสุด</option>
              <option value="booking">จองสูงสุด</option>
              <option value="diligent">ติดตามมาก</option>
              <option value="done">ปิดมากสุด</option>
            </select>
          </div>
          <div className="shdr">
            <span>เซลล์</span><span style={{ textAlign: "right" }}>Lead</span>
            <span style={{ textAlign: "right" }}>ติดตาม</span><span style={{ textAlign: "right" }}>จอง</span>
            <span style={{ textAlign: "right" }}>ปิด</span><span style={{ textAlign: "right" }}>คลิป</span>
            <span style={{ textAlign: "right" }}>ไลฟ์</span><span>Conv%</span>
          </div>
          {ss.map((s) => {
            const msd = ms?.sellers?.[s.name];
            const sLead = msd ? msd.lead : s.lead;
            const sFollow = msd ? msd.follow : s.follow;
            const sBooking = msd ? msd.booking : s.booking;
            const sDone = msd ? msd.done : s.done;
            const conv = pct(sBooking, sLead);
            const cPct2 = pct(s.clip, s.clipTarget || 1);
            const tC = conv >= 8 ? "var(--green)" : conv >= 4 ? "var(--amber)" : "var(--red)";
            const tBg = conv >= 8 ? "var(--green-bg)" : conv >= 4 ? "var(--amber-bg)" : "var(--red-bg)";
            const d = dilMap[s.name];
            const avg = d && d.cnt ? Math.round((d.tot / d.cnt) * 10) / 10 : 0;
            return (
              <div className="srow" key={s.name} onClick={() => sv("s", s.name)}>
                <span style={{ fontWeight: 600 }}>
                  {s.name}
                  <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 4, background: TEAM_COLORS[s.team] || "var(--t3)", color: "#fff", marginLeft: 2 }}>{s.team}</span>
                </span>
                <span style={{ textAlign: "right" }}>{sLead}</span>
                <span style={{ textAlign: "right", color: "var(--blue)" }}>{sFollow}</span>
                <span style={{ textAlign: "right", color: "var(--green)" }}>{sBooking}</span>
                <span style={{ textAlign: "right", color: "var(--green-mid)" }}>{sDone}</span>
                <span style={{ textAlign: "right", color: cPct2 >= 100 ? "var(--green)" : "var(--amber)" }}>{s.clip}/{s.clipTarget}</span>
                <span style={{ textAlign: "right", color: s.live > 0 ? "var(--blue)" : "var(--t3)" }}>{s.live}</span>
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <span className="sbdg" style={{ background: tBg, color: tC }}>{conv}% Conv</span>
                    <span style={{ fontSize: 10, color: "var(--t3)" }}>&#x1F501;{avg}x</span>
                  </div>
                  <div className="pbr"><div className="pbf" style={{ width: `${Math.min(cPct2, 100)}%`, background: "var(--green-mid)" }} /></div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Follow cases section */}
        {renderFollowCasesSection()}

        {/* 3-col panels */}
        <div className="g3">
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title">&#x1F534; ยังไม่อัพเดท</div>
            {Object.entries(nu).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, count]) => (
              <div className="prow" key={name} onClick={() => sv("s", name)}>
                <span style={{ fontWeight: 500 }}>{name}</span>
                <span style={{ color: "var(--red)", fontWeight: 500 }}>{count} เคส</span>
              </div>
            ))}
            {Object.keys(nu).length === 0 && <span style={{ fontSize: 12, color: "var(--t3)" }}>ทุกเคสอัพเดทแล้ว 🎉</span>}
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title">&#x1F3C6; Top จอง</div>
            {topBook.map((s, i) => (
              <div className="prow" key={s.name} onClick={() => sv("s", s.name)}>
                <span style={{ fontWeight: 500 }}>{medals[i]} {s.name}</span>
                <span style={{ color: "var(--green)", fontWeight: 500 }}>{s.booking} จอง · {pct(s.booking, s.lead)}%</span>
              </div>
            ))}
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title">&#x1F501; ติดตามมาก</div>
            {dilEntries.map((d) => (
              <div className="dilrow" key={d.n} onClick={() => sv("s", d.n)} style={{ cursor: "pointer" }}>
                <span style={{ fontSize: 12, fontWeight: 500, minWidth: 44 }}>{d.n}</span>
                <div className="dilbar"><div className="dilfill" style={{ width: `${Math.min((d.avg / UPD_TGT) * 100, 100)}%`, background: "var(--blue)" }} /></div>
                <span style={{ fontSize: 11, color: "var(--blue)", fontWeight: 600, minWidth: 26, textAlign: "right" }}>{d.avg}x</span>
                <span style={{ fontSize: 10, color: "var(--amber)" }}>&#x1F525;{d.high}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Hot cases */}
        {renderHotCases()}
      </div>
    );
  }

  function renderDfResultPanel() {
    const fc = (D?.followCases || []).filter((l) => ir(l.dateIn));
    const noCall = fc.filter((l) => l.updateCount === 0).length;
    const hot = fc.filter((l) => l.updateCount >= 3).length;
    const doneRange = (D?.bookingCases || []).filter((b) => b.status === "ปล่อย" && ir(b.date)).length;
    const lbl = dfMonth === -1 ? "วันนี้" : "เดือน" + MONTHS_FULL[dfMonth - 1];

    const bySeller: Record<string, { total: number; noCall: number; hot: number }> = {};
    fc.forEach((l) => {
      if (!bySeller[l.seller]) bySeller[l.seller] = { total: 0, noCall: 0, hot: 0 };
      bySeller[l.seller].total++;
      if (l.updateCount === 0) bySeller[l.seller].noCall++;
      if (l.updateCount >= 3) bySeller[l.seller].hot++;
    });
    const rows = Object.entries(bySeller).sort((a, b) => b[1].total - a[1].total);
    const maxTotal = rows[0]?.[1].total || 1;

    return (
      <div style={{ marginBottom: 10 }}>
        <div className="card" style={{ borderColor: "var(--blue)", background: "var(--blue-bg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
            <div className="card-title" style={{ margin: 0, color: "var(--blue)" }}>&#x1F4C5; ผลกรองวันที่ <span style={{ fontSize: 11, fontWeight: 400 }}>({lbl})</span></div>
            <button onClick={() => setDf(0)} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: ".5px solid var(--blue)", background: "transparent", color: "var(--blue)", cursor: "pointer" }}>✕ ล้างกรอง</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(100px,1fr))", gap: 7, marginBottom: 10 }}>
            {[
              { l: "เคสติดตาม", v: fc.length, c: "var(--blue)" },
              { l: "ยังไม่โทร", v: noCall, c: "var(--red)" },
              { l: "ติดตาม 3+x", v: hot, c: "var(--amber)" },
              { l: "ปล่อยรถ", v: doneRange, c: "var(--green)" },
            ].map((k, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,.6)", borderRadius: "var(--r-sm)", padding: "8px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "var(--t2)", marginBottom: 3 }}>{k.l}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
          {rows.length > 0 ? (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px 60px 60px", gap: 5, fontSize: 10, color: "var(--t3)", fontWeight: 500, padding: "4px 0", borderBottom: ".5px solid var(--bd)", marginBottom: 2 }}>
                <span>เซลล์</span><span>ความคืบหน้า</span><span style={{ textAlign: "right" }}>เคส</span><span style={{ textAlign: "right" }}>ยังไม่โทร</span><span style={{ textAlign: "right" }}>ติดตาม 3+</span>
              </div>
              {rows.map(([s, d]) => {
                const pct2 = Math.round((d.total / maxTotal) * 100);
                return (
                  <div key={s} style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px 60px 60px", gap: 5, alignItems: "center", padding: "5px 0", borderBottom: ".5px solid rgba(0,0,0,.05)", fontSize: 12, cursor: "pointer" }} onClick={() => sv("s", s)}>
                    <span style={{ fontWeight: 600, color: "var(--t1)" }}>{s}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: "rgba(0,0,0,.08)", overflow: "hidden" }}>
                        <div style={{ height: "100%", borderRadius: 3, width: `${pct2}%`, background: "var(--blue)" }} />
                      </div>
                    </div>
                    <span style={{ textAlign: "right", fontWeight: 500, color: "var(--blue)" }}>{d.total}</span>
                    <span style={{ textAlign: "right", color: "var(--red)" }}>{d.noCall}</span>
                    <span style={{ textAlign: "right", color: "var(--amber)" }}>{d.hot}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--t3)", padding: 8 }}>ไม่มีเคสในช่วงนี้</div>
          )}
        </div>
      </div>
    );
  }

  function renderFollowCasesSection() {
    let cases = (D?.followCases || []).filter((l) => ir(l.dateIn));
    if (followFilter === "notcalled") cases = cases.filter((l) => l.updateCount === 0);
    else if (followFilter === "hot") cases = cases.filter((l) => l.updateCount >= 3);

    if (followFilter === "recent") {
      cases.sort((a, b) => {
        const pa = a.lastUpdate && a.lastUpdate !== "-";
        const pb = b.lastUpdate && b.lastUpdate !== "-";
        if (!pa && !pb) return 0;
        if (!pa) return 1;
        if (!pb) return -1;
        return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
      });
    } else {
      cases.sort((a, b) => urg(b) - urg(a));
    }

    return (
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <div className="card-title" style={{ margin: 0 }}>&#x1F4DE; เคสติดตาม <span style={{ fontSize: 11, fontWeight: 400, color: "var(--t3)" }}>({cases.length} เคส)</span></div>
          <select value={followFilter} onChange={(e) => setFollowFilter(e.target.value)}>
            <option value="urgent">เร่งด่วนก่อน</option>
            <option value="notcalled">ยังไม่โทร</option>
            <option value="hot">ติดตาม 3+x</option>
            <option value="recent">อัพเดทล่าสุด</option>
          </select>
        </div>
        <div className="lfhdr"><span>Code · เซลล์</span><span>หมายเหตุ / รถ</span><span style={{ textAlign: "right" }}>อัพ</span></div>
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {cases.length === 0 && <div style={{ textAlign: "center", color: "var(--t3)", padding: 18, fontSize: 12 }}>ไม่มีเคสติดตาม</div>}
          {cases.slice(0, 50).map((l) => {
            const cls = l.updateCount === 0 ? "lfrow hr" : nc(l.updateCount) >= 2 ? "lfrow ha" : l.updateCount >= 3 ? "lfrow hb" : "lfrow";
            const carHas = !nocar(l.car);
            return (
              <div className={cls} key={l.code} onClick={() => { setCurS(l.seller); sv("s", l.seller); setTimeout(() => openCase(l.code, l.seller), 100); }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 11, color: "var(--blue)" }}>{l.code}</div>
                  <div style={{ fontSize: 10, color: "var(--t2)", marginTop: 1 }}>{l.seller}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)" }}>{l.lastUpdate && l.lastUpdate !== "-" ? l.lastUpdate : "ยังไม่อัพเดท"}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{(l.note || "-").slice(0, 80)}</div>
                  {carHas && <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>&#x1F697; {l.car}</div>}
                  <div style={{ marginTop: 3 }} dangerouslySetInnerHTML={{ __html: urgBadge(l) }} />
                </div>
                <div dangerouslySetInnerHTML={{ __html: dots(l.updateCount) }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderHotCases() {
    let rows = (D?.followCases || []).filter((l) => l.updateCount >= 2 && ir(l.dateIn));
    if (hsel !== "all") rows = rows.filter((l) => l.seller === hsel);
    rows.sort((a, b) => b.updateCount - a.updateCount);

    return (
      <div className="card" style={{ marginTop: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <div className="card-title" style={{ margin: 0 }}>&#x1F525; Hot Cases ≥2 อัพเดท</div>
          <select value={hsel} onChange={(e) => setHsel(e.target.value)}>
            <option value="all">ทุกเซลล์</option>
            {sellerNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="hlhdr"><span>Code</span><span>เซลล์</span><span>หมายเหตุ</span><span>รถ</span><span style={{ textAlign: "right" }}>อัพ</span></div>
        {rows.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>ไม่มีเคส</div>}
        {rows.slice(0, 25).map((l) => {
          const c = l.updateCount >= UPD_TGT ? "var(--green)" : l.updateCount >= 3 ? "var(--green-mid)" : "var(--amber)";
          return (
            <div className="hlrow" key={l.code} onClick={() => { setCurS(l.seller); sv("s", l.seller); setTimeout(() => openCase(l.code, l.seller), 100); }}>
              <div><div style={{ fontWeight: 700, fontSize: 11, color: "var(--blue)" }}>{l.code}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{l.lastUpdate && l.lastUpdate !== "-" ? l.lastUpdate : "—"}</div></div>
              <span style={{ color: "var(--blue)", fontWeight: 500 }}>{l.seller}</span>
              <span style={{ color: "var(--t2)", lineHeight: 1.4 }}>{(l.note || "").slice(0, 55)}</span>
              <span style={{ color: "var(--t2)", fontSize: 10 }}>{nocar(l.car) ? "—" : l.car.slice(0, 14)}</span>
              <span style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: c }}>{l.updateCount}<span style={{ fontSize: 10, fontWeight: 400, color: "var(--t3)" }}>/{UPD_TGT}</span></span>
            </div>
          );
        })}
      </div>
    );
  }

  // ====================================================================
  //  ACTIVITY TAB
  // ====================================================================
  function renderActivity() {
    const la = D?.liveActivity || { totalInbox: 0, totalLead: 0, totalSessions: 0, byHost: {}, sessions: [] };
    const totLive = sellers.reduce((a, s) => a + s.live, 0);
    const totClip = sellers.reduce((a, s) => a + s.clip, 0);

    const summaryCards = [
      { l: "ไลฟ์รวม", v: totLive + " ครั้ง", s: la.totalSessions + " session", c: "var(--blue)" },
      { l: "Inbox รวม", v: String(la.totalInbox), s: la.totalLead + " lead จากไลฟ์", c: "var(--green)" },
      { l: "คลิปรวม", v: totClip + " คลิป", s: sellers.filter((s) => s.clip >= s.clipTarget).length + " คน ถึงเป้า", c: "var(--purple-mid)" },
    ];

    // Filter sessions by month and team
    let sessions = [...(la.sessions || [])];
    if (liveMonth > 0) {
      sessions = sessions.filter((s) => {
        const parts = (s.date || "").split("/");
        const m = parts.length >= 2 ? parseInt(parts[1]) : 0;
        return m === liveMonth;
      });
    }
    if (liveTeam !== "all") {
      sessions = sessions.filter((s) => s.team === liveTeam);
    }
    sessions.sort((a, b) => (String(b.date) > String(a.date) ? 1 : -1));

    // Collect unique teams from sessions for filter dropdown
    const liveTeams = Array.from(new Set((la.sessions || []).map((s) => s.team).filter(Boolean))).sort();

    return (
      <div>
        <div className="g3">
          {summaryCards.map((k, i) => (
            <div className="card" key={i} style={{ margin: 0, textAlign: "center" }}>
              <div className="kl">{k.l}</div>
              <div className="kv" style={{ color: k.c }}>{k.v}</div>
              <div className="ks">{k.s}</div>
            </div>
          ))}
        </div>
        <div className="g2">
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title">&#x1F4E1; ไลฟ์สด</div>
            <div className="act-hdr"><span>เซลล์</span><span>จำนวนครั้ง</span><span style={{ textAlign: "right" }}>inbox</span></div>
            {[...sellers].sort((a, b) => b.live - a.live).map((s) => {
              const inbox = la.byHost[s.name]?.inbox || 0;
              return (
                <div className="act-row" key={s.name} onClick={() => sv("s", s.name)}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--blue)" }}>{s.live} ครั้ง</span>
                  <span style={{ textAlign: "right", fontSize: 11, color: "var(--t3)" }}>&#x1F4E5;{inbox}</span>
                </div>
              );
            })}
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="card-title">&#x1F3AC; คลิป TikTok</div>
            <div className="act-hdr"><span>เซลล์</span><span>คลิป/เป้า</span><span style={{ textAlign: "right" }}>สถานะ</span></div>
            {[...sellers].sort((a, b) => (b.clip / Math.max(b.clipTarget, 1)) - (a.clip / Math.max(a.clipTarget, 1))).map((s) => {
              const ok = s.clip >= (s.clipTarget || 1);
              const p = s.clipTarget > 0 ? Math.min((s.clip / s.clipTarget) * 100, 100) : 0;
              return (
                <div className="act-row" key={s.name} onClick={() => sv("s", s.name)}>
                  <span style={{ fontWeight: 500 }}>{s.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--bg3)", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: 3, width: `${p}%`, background: ok ? "var(--green-mid)" : "var(--purple-mid)" }} />
                    </div>
                    <span style={{ fontSize: 10, color: ok ? "var(--green)" : "var(--amber)" }}>{s.clip}/{s.clipTarget}</span>
                  </div>
                  <span style={{ textAlign: "right", fontSize: 11 }}>{ok ? "✅" : "⚠️ ขาด " + ((s.clipTarget || 4) - s.clip)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card" style={{ marginTop: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <div className="card-title" style={{ margin: 0 }}>&#x1F4FA; ไลฟ์รายครั้ง <span style={{ fontSize: 11, fontWeight: 400, color: "var(--t3)" }}>{liveMonth > 0 ? MONTHS_SHORT[liveMonth - 1] : "ทั้งปี"}{liveTeam !== "all" ? " · ทีม " + liveTeam : ""} ({sessions.length})</span></div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={liveMonth} onChange={(e) => setLiveMonth(Number(e.target.value))} style={{ fontSize: 11 }}>
                <option value={0}>ทุกเดือน</option>
                {MONTHS_SHORT.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={liveTeam} onChange={(e) => setLiveTeam(e.target.value)} style={{ fontSize: 11 }}>
                <option value="all">ทุกทีม</option>
                {liveTeams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          {sessions.length === 0 && <div style={{ padding: 12, textAlign: "center", color: "var(--t3)", fontSize: 12 }}>ไม่มีข้อมูลไลฟ์</div>}
          {sessions.slice(0, 30).map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "72px auto 1fr 1fr 60px", gap: 6, alignItems: "center", padding: "7px 0", borderBottom: ".5px solid var(--bd)", fontSize: 11 }}>
              <span style={{ color: "var(--t3)" }}>{s.date}{s.time ? " " + s.time : ""}</span>
              <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 8, background: "var(--bg3)", color: "var(--t3)" }}>{s.team || "-"}</span>
              <span style={{ fontWeight: 500 }}>{s.hosts.join(", ")}</span>
              <span style={{ color: "var(--t2)" }}>{s.topic || "—"}</span>
              <span style={{ textAlign: "right", color: "var(--t2)" }}>&#x1F4E5;{s.inbox} &#x1F3AF;{s.lead}</span>
            </div>
          ))}
          {sessions.length > 30 && <div style={{ textAlign: "center", padding: 8, fontSize: 11, color: "var(--t3)" }}>แสดง 30 จาก {sessions.length} รายการ</div>}
        </div>
      </div>
    );
  }

  // ====================================================================
  //  BOOKING TAB
  // ====================================================================
  function renderBookings() {
    let bk = [...(D?.bookingCases || [])];
    if (bkSel !== "all") bk = bk.filter((b) => b.seller === bkSel);
    if (bkStatus !== "all") bk = bk.filter((b) => b.status === bkStatus);
    bk = bk.filter((b) => ir(b.date));

    bk.sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.status);
      const bi = STATUS_ORDER.indexOf(b.status);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const missing = bk.filter((b) => {
      if (b.status === "รอเซ็นต์") return empty(b.signDate);
      if (b.status === "รอผล") return empty(b.resultDate);
      if (b.status === "รอปล่อย") return empty(b.releaseDate) || empty(b.docsDate);
      return false;
    });

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Pipeline จอง</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={bkSel} onChange={(e) => setBkSel(e.target.value)}>
              <option value="all">ทุกเซลล์</option>
              {sellerNames.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <select value={bkStatus} onChange={(e) => setBkStatus(e.target.value)}>
              <option value="all">ทุกสถานะ</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        {missing.length > 0 && (
          <div style={{ background: "var(--red-bg)", border: ".5px solid var(--red-mid)", borderRadius: "var(--r-sm)", padding: "9px 12px", marginBottom: 10, fontSize: 12, color: "var(--red)" }}>
            ⚠️ <strong>{missing.length} เคส</strong> ยังไม่ได้ใส่วันที่สำคัญ — {missing.slice(0, 3).map((b) => b.customer || b.car).join(", ")}{missing.length > 3 ? " ..." : ""}
          </div>
        )}
        {bk.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "var(--t3)", fontSize: 13 }}>ไม่มีเคสในระบบ</div>}
        {bk.map((b, i) => {
          const color = STATUS_COLOR[b.status] || "#6b7280";
          let keyDate = "", keyLabel = "", needDate = false;
          if (b.status === "รอเซ็นต์") { keyLabel = "นัดเซ็น"; keyDate = b.signDate; needDate = empty(b.signDate); }
          else if (b.status === "รอผล") { keyLabel = "ผลออก"; keyDate = b.resultDate; needDate = empty(b.resultDate); }
          else if (b.status === "รอปล่อย") { keyLabel = "ปล่อยรถ"; keyDate = b.releaseDate; needDate = empty(b.releaseDate); }
          else if (b.status === "ปล่อย") { keyLabel = "ปล่อยแล้ว"; keyDate = b.releaseDate; }
          else if (b.status === "จอง") { keyLabel = "วันจอง"; keyDate = b.date; }
          return (
            <div className="booking-card" key={i}>
              <div className="booking-head" style={{ background: `linear-gradient(135deg,${color} 0%,${color}cc 100%)` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 700, background: "rgba(0,0,0,.2)", padding: "2px 8px", borderRadius: 20 }}>{b.status}</span>
                  <span style={{ fontSize: 11, color: "#fff", opacity: 0.9 }}>{b.seller}{b.isCash ? " · 💵 ซื้อสด" : ""}</span>
                </div>
                <div style={{ fontSize: 13, color: "#fff", fontWeight: 600, marginBottom: 2 }}>{b.customer}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.8)" }}>{b.car}{b.plate && b.plate !== "-" ? " · " + b.plate : ""}</div>
              </div>
              <div className="booking-body">
                {keyLabel && (
                  <div className="brow">
                    <span className="blbl">&#x1F4C5; {keyLabel}</span>
                    <span className="bval" style={{ color: needDate ? "var(--red)" : "var(--t1)", fontWeight: needDate ? 600 : 400 }}>
                      {needDate ? "⚠️ ยังไม่ได้ใส่!" : keyDate || "-"}
                    </span>
                  </div>
                )}
                {b.status === "รอปล่อย" && (
                  <div className="brow">
                    <span className="blbl">&#x1F4C4; เอกสาร</span>
                    <span className="bval" style={{ color: empty(b.docsDate) ? "var(--red)" : "var(--t1)", fontWeight: empty(b.docsDate) ? 600 : 400 }}>
                      {empty(b.docsDate) ? "⚠️ ยังไม่ครบ!" : b.docsDate}
                    </span>
                  </div>
                )}
                {b.phone && !empty(b.phone) && <div className="brow"><span className="blbl">&#x1F4DE; เบอร์</span><span className="bval" style={{ color: "var(--blue)" }}>{b.phone}</span></div>}
                {b.price > 0 && <div className="brow"><span className="blbl">&#x1F4B0; ราคา</span><span className="bval" style={{ color: "var(--t1)", fontWeight: 500 }}>฿{Number(b.price || 0).toLocaleString()}</span></div>}
                <div className="brow"><span className="blbl">&#x1F4B3; มัดจำ</span><span className="bval" style={{ color: "var(--green)", fontWeight: 600 }}>฿{Number(b.deposit || 0).toLocaleString()}</span></div>
                {b.finance && !empty(b.finance) && (
                  <div className="brow"><span className="blbl">&#x1F3E6; ไฟแนนซ์</span><span className="bval">{b.finance}{b.grade && !empty(b.grade) ? " · เกรด " + b.grade : ""}{b.year && !empty(b.year) ? " · ปี " + b.year : ""}</span></div>
                )}
                {b.leadCode && !empty(b.leadCode) && (
                  <div className="brow"><span className="blbl">&#x1F516; Lead Code</span>
                    <span className="bval" style={{ color: "var(--blue)", cursor: "pointer" }} onClick={() => { setCurS(b.seller); sv("s", b.seller); setTimeout(() => openCase(b.leadCode, b.seller), 100); }}>{b.leadCode} →</span>
                  </div>
                )}
                {b.note && !empty(b.note) && <div className="brow"><span className="blbl">&#x1F4DD; หมายเหตุ</span><span className="bval" style={{ color: "var(--t2)" }}>{b.note}</span></div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ====================================================================
  //  SELLER TAB
  // ====================================================================
  function renderSeller() {
    const sd = sellers.find((s) => s.name === effectiveCurS) || ({} as SellerData);
    const isAdminTeam = sd.team === "ADMIN";
    const cases = (D?.followCases || []).filter((l) => l.seller === effectiveCurS && ir(l.dateIn));
    const noU = cases.filter((l) => l.updateCount === 0).length;
    const hot = cases.filter((l) => l.updateCount >= 3).length;
    const totU = cases.reduce((a, l) => a + l.updateCount, 0);
    const bkCount = (D?.bookingCases || []).filter((b) => b.seller === effectiveCurS).length;

    const la = D?.liveActivity;

    // Lead types
    const lt = sd.leadTypes || {};
    const ltTotal = Object.values(lt).reduce((a, v) => a + v, 0) || 1;
    const ltSorted = Object.entries(lt).sort((a, b) => b[1] - a[1]);

    const kpis = [
      { l: "Lead", v: sd.lead || 0, c: "var(--t1)" },
      { l: "ติดตาม", v: sd.follow || 0, c: "var(--blue)" },
      { l: "ว่าง", v: sd.vacant || 0, c: "var(--t3)" },
      { l: "จอง", v: sd.booking || 0, c: "var(--green)" },
      { l: "ปิด/เป้า", v: (sd.done || 0) + "/" + (sd.target || 0), c: (sd.done || 0) >= (sd.target || 1) ? "var(--green)" : "var(--amber)" },
      { l: "ยังไม่โทร", v: noU, c: noU > 10 ? "var(--red)" : "var(--amber)" },
    ];

    // Chips
    const chips = [
      { f: "all", l: "ทั้งหมด", n: cases.length },
      { f: "notcalled", l: "ยังไม่โทร", n: noU },
      { f: "frequent", l: "ติดตามมาก", n: hot },
      { f: "followstatus", l: "ต้องตาม", n: cases.filter((l) => { const st = (l.adminStatus || "").toLowerCase(); return ["ติดตาม", "รอตอบ", "รอลูกค้า", "โทรไม่รับ", "ผิดนัด"].some((s) => st.includes(s)); }).length },
      { f: "need2", l: "โทรอีก 2+", n: cases.filter((l) => nc(l.updateCount) >= 2).length },
      { f: "hascar", l: "มีรถสนใจ", n: cases.filter((l) => !nocar(l.car)).length },
      { f: "haschannel", l: "มีช่องทาง", n: cases.filter((l) => !empty(l.channel) && l.channel !== "-").length },
      { f: "hasprofile", l: "มีโปรไฟล์", n: cases.filter((l) => l.profile && l.profile.length > 0).length },
    ];

    // Filtered & sorted leads
    let rows = [...cases];
    if (curF === "notcalled") rows = rows.filter((l) => l.updateCount === 0);
    else if (curF === "frequent") rows = rows.filter((l) => l.updateCount >= 3);
    else if (curF === "followstatus") rows = rows.filter((l) => { const st = (l.adminStatus || "").toLowerCase(); return ["ติดตาม", "รอตอบ", "รอลูกค้า", "โทรไม่รับ", "ผิดนัด"].some((s) => st.includes(s)); });
    else if (curF === "need2") rows = rows.filter((l) => nc(l.updateCount) >= 2);
    else if (curF === "hascar") rows = rows.filter((l) => !nocar(l.car));
    else if (curF === "haschannel") rows = rows.filter((l) => !empty(l.channel) && l.channel !== "-");
    else if (curF === "hasprofile") rows = rows.filter((l) => l.profile && l.profile.length > 0);

    if (searchQ) {
      const q = searchQ.toLowerCase();
      rows = rows.filter((l) => [l.code, l.car, l.note, l.phone, l.channel, l.leadType].join(" ").toLowerCase().includes(q));
    }

    if (curSo === "urgent") rows.sort((a, b) => urg(b) - urg(a));
    else if (curSo === "upd-asc") rows.sort((a, b) => a.updateCount - b.updateCount);
    else if (curSo === "upd-desc") rows.sort((a, b) => b.updateCount - a.updateCount);
    else if (curSo === "date") rows.sort((a, b) => {
      const pa = a.lastUpdate && a.lastUpdate !== "-";
      const pb = b.lastUpdate && b.lastUpdate !== "-";
      if (!pa && !pb) return 0; if (!pa) return 1; if (!pb) return -1;
      return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
    });

    const total = rows.length;
    const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
    const safePage = lfPage > totalPages ? totalPages : lfPage;
    const start = (safePage - 1) * PAGE_SIZE;
    const pageRows = rows.slice(start, start + PAGE_SIZE);

    // Case detail
    if (showCase) {
      const l = (D?.followCases || []).find((c) => c.code === showCase);
      if (l) return renderCaseDetail(l);
    }

    const aB = noU > 10 ? "rgba(226,75,74,.06)" : "rgba(239,159,39,.06)";
    const aBd = noU > 10 ? "var(--red-mid)" : "var(--amber-mid)";

    return (
      <div>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="bbtn" onClick={() => sv("o")}>← กลับ</button>
          <div className="av">{effectiveCurS.charAt(0)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{effectiveCurS}</div>
            <div style={{ fontSize: 11, color: "var(--t2)" }}>{sd.lead || 0} Lead · ว่าง {sd.vacant || 0} · จอง {sd.booking || 0} · ทีม {sd.team || "?"}</div>
          </div>
          <select value={effectiveCurS} onChange={(e) => { setCurS(e.target.value); openCase(null); setCurF("all"); setLfPage(1); updateUrl("s", e.target.value); }}>
            {sellerNames.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {/* KPI */}
        <div className="kgrid" style={{ marginBottom: 10 }}>
          {kpis.map((k, i) => (
            <div className="kpi" key={i}>
              <div className="kl">{k.l}</div>
              <div className="kv" style={{ color: k.c }}>{k.v}</div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(k as any).s && <div className="ks">{(k as any).s}</div>}
            </div>
          ))}
        </div>

        {/* Lead types */}
        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-title">&#x1F3F7; ประเภท Lead</div>
          {ltSorted.length === 0 && <span style={{ fontSize: 12, color: "var(--t3)" }}>ยังไม่มีข้อมูล</span>}
          {ltSorted.map(([name, count]) => {
            const p = Math.round((count / ltTotal) * 100);
            const c = LT_COLORS[name] || "var(--t2)";
            return (
              <div className="lt-row" key={name}>
                <span style={{ minWidth: 60, fontSize: 11, fontWeight: 500, color: "var(--t1)" }}>{name}</span>
                <div className="lt-bar" style={{ width: `${Math.max(p, 2)}%`, background: c, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: c, marginLeft: 5, minWidth: 50 }}>{count} ({p}%)</span>
              </div>
            );
          })}
        </div>

        {/* Live/Clip */}
        {!isAdminTeam && (
          <div className="g2" style={{ marginBottom: 10 }}>
            <div className="card" style={{ margin: 0, padding: 11 }}>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5 }}>&#x1F4E1; ไลฟ์</div>
              {(() => {
                const inbox = la?.byHost?.[effectiveCurS]?.inbox || 0;
                const lead = la?.byHost?.[effectiveCurS]?.lead || 0;
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--t2)" }}>{sd.live} ครั้ง</span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 3 }}>Inbox {inbox} · Lead {lead}</div>
                  </>
                );
              })()}
            </div>
            <div className="card" style={{ margin: 0, padding: 11 }}>
              <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5 }}>&#x1F3AC; คลิป</div>
              {(() => {
                const cOk = (sd.clip || 0) >= (sd.clipTarget || 1);
                const cP = Math.min(((sd.clip || 0) / Math.max(sd.clipTarget || 1, 1)) * 100, 100);
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--t2)" }}>{sd.clip} คลิป / เป้า {sd.clipTarget || 4}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: cOk ? "var(--green)" : "var(--amber)" }}>{cOk ? "✅ ถึงเป้า" : "ขาด " + ((sd.clipTarget || 4) - (sd.clip || 0)) + " คลิป"}</span>
                    </div>
                    <div className="pbr" style={{ height: 8 }}><div className="pbf" style={{ width: `${cP}%`, background: cOk ? "var(--green-mid)" : "var(--purple-mid)" }} /></div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* Alert bar */}
        <div style={{ background: aB, border: `.5px solid ${aBd}`, borderRadius: "var(--r-sm)", padding: "8px 12px", marginBottom: 10, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { dot: "var(--red-mid)", t: `ยังไม่โทรเลย <strong>${noU}</strong> เคส` },
            { dot: "var(--amber-mid)", t: `ติดตาม 3+ ครั้ง <strong>${hot}</strong> เคส` },
            { dot: "var(--green-mid)", t: `อัพเดทรวม <strong>${totU}</strong> ครั้ง` },
          ].map((a, i) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: a.dot, flexShrink: 0 }} />
              <span dangerouslySetInnerHTML={{ __html: a.t }} />
            </span>
          ))}
        </div>

        {/* Quick nav to booking */}
        {bkCount > 0 && (
          <div style={{ marginBottom: 10 }}>
            <button className="bbtn" style={{ color: "var(--green)", borderColor: "var(--green-bg)", background: "var(--green-bg)" }} onClick={() => sv("b")}>
              &#x1F4CB; ดู Pipeline จอง {bkCount} เคส →
            </button>
          </div>
        )}

        {/* Chips */}
        <div className="chips">
          {chips.map((ch) => (
            <button key={ch.f} className={`chip${ch.f === curF ? " on" : ""}`} onClick={() => { setCurF(ch.f); setLfPage(1); }}>
              {ch.l} <span className="cpill">{ch.n}</span>
            </button>
          ))}
        </div>

        {/* Search & sort */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
          <input type="text" placeholder="ค้นหา code / รถ / หมายเหตุ..." style={{ flex: 1, minWidth: 130 }} value={searchQ} onChange={(e) => { setSearchQ(e.target.value); setLfPage(1); }} />
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {[
              { s: "urgent", l: "เร่งด่วน" },
              { s: "upd-asc", l: "อัพน้อย" },
              { s: "upd-desc", l: "ติดตามมาก" },
              { s: "date", l: "ล่าสุด" },
            ].map((b) => (
              <button key={b.s} className={`sbtn${curSo === b.s ? " on" : ""}`} onClick={() => { setCurSo(b.s); setLfPage(1); }}>{b.l}</button>
            ))}
          </div>
        </div>

        {/* Lead list */}
        <div className="card">
          <div className="lfhdr"><span>Code · อัพล่าสุด</span><span>หมายเหตุ / รถ</span><span style={{ textAlign: "right" }}>อัพ</span></div>
          <div style={{ maxHeight: 440, overflowY: "auto" }}>
            {pageRows.map((l) => {
              const cls = l.updateCount === 0 ? "lfrow hr" : nc(l.updateCount) >= 2 ? "lfrow ha" : l.updateCount >= 3 ? "lfrow hb" : "lfrow";
              const carHas = !nocar(l.car);
              const chanHas = !empty(l.channel) && l.channel !== "-";
              return (
                <div className={cls} key={l.code} onClick={() => openCase(l.code)}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 11, color: "var(--blue)" }}>
                      {l.code}
                      {l.leadType && <span style={{ fontSize: 9, padding: "1px 4px", borderRadius: 4, background: "var(--blue-bg)", color: "var(--blue)", fontWeight: 600, marginLeft: 3 }}>{l.leadType}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--t3)" }}>{l.lastUpdate && l.lastUpdate !== "-" ? l.lastUpdate : "ยังไม่อัพเดท"}</div>
                    {carHas && <div style={{ fontSize: 10, color: "var(--t2)" }}>&#x1F697; {l.car}</div>}
                    {chanHas && <div style={{ fontSize: 10, color: "var(--purple-mid)" }}>&#x1F4E2; {l.channel}</div>}
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>{(l.note || "-").slice(0, 80)}</div>
                    <div style={{ marginTop: 3 }} dangerouslySetInnerHTML={{ __html: urgBadge(l) }} />
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: dots(l.updateCount) }} />
                </div>
              );
            })}
          </div>
          {total === 0 && <div style={{ textAlign: "center", color: "var(--t3)", padding: "22px 0", fontSize: 13 }}>ไม่พบเคส</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, flexWrap: "wrap", gap: 6 }}>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>แสดง {start + 1}-{Math.min(start + PAGE_SIZE, total)} จาก {total} เคส</div>
            <div style={{ display: "flex", gap: 6 }}>
              {safePage > 1 && <button className="pg-btn" onClick={() => setLfPage(safePage - 1)}>←</button>}
              <span style={{ fontSize: 12, color: "var(--t2)", padding: "0 6px", lineHeight: "32px" }}>{safePage}/{totalPages}</span>
              {safePage < totalPages && <button className="pg-btn primary" onClick={() => setLfPage(safePage + 1)}>→</button>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ====================================================================
  //  CASE DETAIL
  // ====================================================================
  function renderCaseDetail(l: FollowCase) {
    const n = nc(l.updateCount);
    const noC = l.updateCount === 0;
    const uc = noC ? "var(--red)" : n >= 2 ? "var(--amber)" : n === 0 ? "var(--green)" : "var(--blue)";
    const ut = noC ? "ยังไม่โทร" : n >= 2 ? "โทรอีก " + n + "x" : n === 1 ? "โทรอีก 1x" : "ครบแล้ว";

    const cdKpis = [
      { l: "อัพเดท", v: l.updateCount + "/" + UPD_TGT, c: l.updateCount >= UPD_TGT ? "var(--green)" : "var(--amber)" },
      { l: "สถานะ", v: ut, c: uc },
      { l: "หลักฐาน", v: l.callProof || "-", c: l.callProof === "ส่งแล้ว" ? "var(--green)" : l.callProof === "-" ? "var(--t3)" : "var(--red)" },
      { l: "อัพล่าสุด", v: l.lastUpdate && l.lastUpdate !== "-" ? l.lastUpdate : "ยังไม่มี", c: "var(--t2)" },
    ];

    const infoRows = [
      { l: "&#x1F4DE; เบอร์", v: l.phone || "-", c: !empty(l.phone) ? "var(--blue)" : "var(--t3)" },
      { l: "&#x1F697; รถ", v: nocar(l.car) ? "-" : l.car, c: "var(--t1)" },
      { l: "&#x1F4E2; ช่องทาง", v: !empty(l.channel) && l.channel !== "-" ? l.channel : "-", c: "var(--purple-mid)" },
      { l: "&#x1F4CB; Status", v: l.adminStatus || "-", c: "var(--t1)" },
      { l: "&#x1F4C5; รับเคส", v: l.dateIn + (l.timeIn ? " " + l.timeIn : ""), c: "var(--t2)" },
    ];
    if (l.profile && !empty(l.profile)) {
      infoRows.push({ l: "&#x1F464; Profile", v: l.profile, c: "var(--t2)" });
    }

    const history = parseNoteHistory(l.note || "");

    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="bbtn" onClick={() => openCase(null)}>← รายการ</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--blue)" }}>{l.code}</div>
            <div style={{ fontSize: 11, color: "var(--t2)" }}>
              {l.seller} · {l.dateIn}
              {l.leadType && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4, background: "var(--blue-bg)", color: "var(--blue)", fontWeight: 600, marginLeft: 4 }}>{l.leadType}</span>}
            </div>
          </div>
        </div>

        <div className="cd-kpi-grid">
          {cdKpis.map((k, i) => (
            <div className="cd-kpi" key={i}>
              <div className="cd-kl">{k.l}</div>
              <div className="cd-kv" style={{ color: k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        <div className="card" style={{ marginBottom: 10 }}>
          <div className="card-title">&#x1F4DE; ข้อมูลลูกค้า</div>
          {infoRows.map((r, i) => (
            <div className="irow" key={i}>
              <span className="ilbl" dangerouslySetInnerHTML={{ __html: r.l }} />
              <span className="ival" style={{ color: r.c }}>{r.v}</span>
            </div>
          ))}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: ".5px solid var(--bd)" }}>
            <div style={{ fontSize: 11, color: "var(--t3)", marginBottom: 5 }}>ความคืบหน้า</div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {Array.from({ length: UPD_TGT }).map((_, j) => {
                const f = j < l.updateCount;
                const c2 = f ? (l.updateCount >= UPD_TGT ? "#3B6D11" : l.updateCount >= 3 ? "#1D9E75" : l.updateCount >= 2 ? "#EF9F27" : "#E24B4A") : "#ccc";
                return <span key={j} className="dot" style={{ background: c2, width: 12, height: 12 }} />;
              })}
              <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: 6 }}>{l.updateCount}/{UPD_TGT} ครั้ง</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">&#x1F4DD; ประวัติการติดตาม</div>
          {history.length === 0 && <div style={{ color: "var(--t3)", fontSize: 12, padding: "8px 0" }}>ยังไม่มีหมายเหตุ</div>}
          {history.map((h, i) => (
            <div className="upd-item" key={i}>
              <span className="upd-n">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.55 }}>{h}</div>
                {i === history.length - 1 && (
                  <span className="bdg" style={{ background: "var(--blue-bg)", color: "var(--blue)", marginTop: 3, display: "inline-block" }}>&#x1F4CD; ล่าสุด</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }


  // ====================================================================
  //  MAIN RETURN
  // ====================================================================
  return (
    <div className="app">
      <header className="hdr" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)" }}>Oxlet Dashboard</span>
          {renderViewerBadge()}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {renderImpersonateSwitcher()}
          <button onClick={loadData} disabled={loading} style={{ fontSize: 11, padding: "4px 10px", borderRadius: 14, border: ".5px solid var(--bd2)", background: "var(--bg2)", color: "var(--t2)", cursor: "pointer" }}>
            &#x1F504; รีเฟรช
          </button>
        </div>
      </header>
      {error && errVisible && (
        <div style={{ background: "var(--red-bg)", color: "var(--red)", padding: "8px 14px", borderRadius: "var(--r-sm)", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", margin: "0 0 8px" }}>
          <span>{error}</span>
          <button onClick={() => setErrVisible(false)} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: 14 }}>&times;</button>
        </div>
      )}
      {lastFetch && (
        <div style={{ fontSize: 10, color: "var(--t3)", marginBottom: 8, textAlign: "right" }}>
          &#x1F551; ดึงข้อมูลล่าสุด: {lastFetch}
        </div>
      )}
      <div className="tabs">
        <button className={`tab${tab === "o" ? " on" : ""}`} onClick={() => setTab("o")}>&#x1F4CA; ภาพรวม</button>
        <button className={`tab${tab === "a" ? " on" : ""}`} onClick={() => setTab("a")}>&#x1F3AC; กิจกรรม</button>
        <button className={`tab${tab === "b" ? " on" : ""}`} onClick={() => setTab("b")}>&#x1F4CB; จอง</button>
        <button className={`tab${tab === "s" ? " on" : ""}`} onClick={() => setTab("s")}>&#x1F464; เซลล์</button>
      </div>
      {renderDateFilterBar()}
      {tab === "o" && renderOverview()}
      {tab === "a" && renderActivity()}
      {tab === "b" && renderBookings()}
      {tab === "s" && renderSeller()}
    </div>
  );
}
