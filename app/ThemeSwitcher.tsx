"use client";
import React, { useState, useEffect } from "react";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
  };

  return (
    <div className="glass-panel" style={{ marginTop: '2rem', border: '1px dashed var(--accent-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0 }}>🎨 مظهر النظام</h3>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>اختر مظهر الموقع (ليلي / نهاري)</p>
        </div>
        <button 
          onClick={toggleTheme}
          className="btn"
          style={{ 
            padding: "12px 24px", 
            borderRadius: "var(--radius-md)", 
            background: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
            fontSize: "1.1rem" 
          }}
        >
          {theme === "dark" ? "☀️ تحويل للوضع الفاتح" : "🌙 تحويل للوضع الليلي"}
        </button>
      </div>
    </div>
  );
}
