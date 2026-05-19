"use client";

import { useState, useEffect, useCallback } from "react";
import { getEmployeeFromCookie, isAdmin } from "./auth";
import type { DashboardData } from "./types";

export function useDashboard() {
  const [employee, setEmployee] = useState<ReturnType<typeof getEmployeeFromCookie>>(null);
  const [fullData, setFullData] = useState<DashboardData | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [impersonate, setImpersonateState] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<string>("");

  const admin = employee ? isAdmin(employee.position) : false;

  const applyFilter = useCallback(
    (d: DashboardData, filterTo: string | null): DashboardData => {
      if (!filterTo) return d;
      return {
        ...d,
        sellers: (d.sellers || []).filter((s) => s.name === filterTo),
        followCases: (d.followCases || []).filter((c) => c.seller === filterTo),
        bookingCases: (d.bookingCases || []).filter((b) => b.seller === filterTo),
      };
    },
    []
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const emp = getEmployeeFromCookie() || {
        id: "dev",
        user_id: "dev",
        display_name: "Admin (Dev)",
        nickname: "admin",
        position: "admin",
      };
      setEmployee(emp);

      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("API error: " + res.status);
      const raw: DashboardData = await res.json();

      const now = new Date().toLocaleString("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      });
      setLastFetch("อัพเดท " + now);
      setFullData(raw);

      const userIsAdmin = isAdmin(emp.position);
      let imp: string | null = null;
      if (userIsAdmin) {
        const saved = typeof window !== "undefined" ? localStorage.getItem("oxlet_impersonate") : null;
        const validNames = (raw.sellers || []).map((s) => s.name);
        imp = saved && validNames.includes(saved) ? saved : null;
        setImpersonateState(imp);
      }

      const filterTo = !userIsAdmin ? emp.nickname : imp;
      setData(applyFilter(raw, filterTo));
      setLoading(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      setLoading(false);
    }
  }, [applyFilter]);

  const setImpersonate = useCallback(
    (name: string | null) => {
      setImpersonateState(name);
      if (name) localStorage.setItem("oxlet_impersonate", name);
      else localStorage.removeItem("oxlet_impersonate");
      if (fullData) {
        setData(applyFilter(fullData, name));
      }
    },
    [fullData, applyFilter]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    employee,
    data,
    fullData,
    loading,
    error,
    lastFetch,
    admin,
    impersonate,
    setImpersonate,
    loadData,
  };
}
