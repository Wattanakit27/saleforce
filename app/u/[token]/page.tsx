"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { setEmployeeCookie } from "@/lib/auth";
import type { Employee } from "@/lib/auth";

export default function MagicLinkPage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function verify() {
      const token = params.token as string;
      if (!token) {
        setStatus("error");
        setErrorMsg("ไม่พบ token");
        return;
      }

      try {
        const res = await fetch(`/api/auth?token=${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok || data.error) {
          setStatus("error");
          setErrorMsg("ลิงก์ไม่ถูกต้องหรือหมดอายุ — กรุณาติดต่อผู้ดูแลระบบ");
          return;
        }

        setEmployeeCookie(data as Employee);
        router.replace("/dashboard");
      } catch {
        setStatus("error");
        setErrorMsg("เกิดข้อผิดพลาด — กรุณาลองอีกครั้ง");
      }
    }

    verify();
  }, [params.token, router]);

  if (status === "error") {
    return (
      <div className="app" style={{ textAlign: "center", paddingTop: 80 }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>&#x1F512;</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--t1)", marginBottom: 6 }}>
          ไม่มีสิทธิ์เข้าถึง
        </div>
        <div style={{ fontSize: 13, color: "var(--t2)", marginBottom: 14 }}>
          {errorMsg}
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="loading-container">
        <div className="spin" />
        <span style={{ fontSize: 13 }}>กำลังตรวจสอบสิทธิ์...</span>
      </div>
    </div>
  );
}
