"use client";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [loggingOut, setLoggingOut] = useState(false);

  const isPublicPage =
    pathname?.endsWith("/print") ||
    pathname?.startsWith("/pay/") ||
    pathname?.startsWith("/login");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  if (isPublicPage) {
    return <div className="public-layout">{children}</div>;
  }

  return (
    <div className="app-container">
      {sidebarOpen && (
        <div
          className="mobile-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main>
        <header className="glass-header">
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="btn"
              style={{ padding: "8px", border: "none", background: "none", fontSize: "1.5rem" }}
            >
              ☰
            </button>
            <div style={{ display: "flex", alignItems: "center" }}>
              <img src="/logo.png" alt="24Med Logo" style={{ height: "40px", width: "auto" }} />
              <span style={{ fontSize: "0.75rem", color: "var(--danger-color)", marginRight: "8px", verticalAlign: "middle", background: "rgba(239,68,68,0.1)", padding: "2px 6px", borderRadius: "4px" }}>v1.1.4</span>
              <span className="desktop-only" style={{ fontSize: "0.9rem", color: "var(--text-secondary)", marginRight: "8px" }}>نظام إدارة التوزيع</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div className="desktop-only" style={{ textAlign: "right", borderRight: "1px solid var(--border-color)", paddingRight: "15px" }}>
              <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>مرحباً بك</div>
              <div style={{ fontSize: "0.95rem", fontWeight: "bold" }}>المدير العام</div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="تسجيل الخروج"
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "8px 14px",
                background: "rgba(244,63,94,0.1)",
                border: "1px solid rgba(244,63,94,0.25)",
                borderRadius: "10px",
                color: "#f43f5e",
                cursor: "pointer",
                fontSize: "0.85rem",
                fontWeight: "600",
                fontFamily: "Cairo, sans-serif",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(244,63,94,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(244,63,94,0.1)")}
            >
              {loggingOut ? "..." : <>🚪 <span className="desktop-only">خروج</span></>}
            </button>
          </div>
        </header>

        <div className="main-content">
          {children}
        </div>
      </main>
    </div>
  );
}
