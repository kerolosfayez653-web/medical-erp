"use client";
import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Sidebar from "./Sidebar";

interface LayoutWrapperProps {
  children: React.ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const isLoginPage = pathname === "/login";
  const isPublicPage = pathname?.endsWith("/print") || pathname?.startsWith("/pay/");

  useEffect(() => {
    // Load persisted theme
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      // Default to dark
      document.documentElement.setAttribute("data-theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  if (isLoginPage || isPublicPage) {
    return <div className="public-layout">{children}</div>;
  }

  // Prevent flash of content if not authenticated
  if (status === "unauthenticated") {
    return null;
  }

  return (
    <div className="app-container">
      {/* Sidebar Overlay for Mobile */}
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
             <button 
                onClick={handleLogout}
                className="btn"
                style={{ fontSize: "0.85rem", color: "var(--danger-color)", borderColor: "rgba(244,63,94,0.2)" }}
             >
                تسجيل الخروج
             </button>
             
             <div className="desktop-only" style={{ textAlign: "right", borderRight: "1px solid var(--border-color)", paddingRight: "15px" }}>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>مرحباً بك</div>
                <div style={{ fontSize: "0.95rem", fontWeight: "bold" }}>{session?.user?.name || "المدير العام"}</div>
             </div>
          </div>
        </header>

        <div className="main-content">
          {children}
        </div>
      </main>
    </div>
  );
}
