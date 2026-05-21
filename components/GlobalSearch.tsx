"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  type: "product" | "person" | "invoice" | "payment";
  icon: string;
  title: string;
  subtitle: string;
  detail: string;
  url: string;
  meta: any;
}

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [counts, setCounts] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut: Ctrl+K to open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
        setResults([]);
        setActiveFilter("all");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setCounts(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) {
        setResults(data.results);
        setCounts(data.counts);
        setSelectedIndex(0);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Filter results
  const filteredResults = activeFilter === "all"
    ? results
    : results.filter(r => r.type === activeFilter);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredResults[selectedIndex]) {
      e.preventDefault();
      navigateTo(filteredResults[selectedIndex]);
    }
  };

  const navigateTo = (result: SearchResult) => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setActiveFilter("all");
    router.push(result.url);
  };

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setActiveFilter("all");
  };

  const filterButtons = [
    { key: "all", label: "الكل", icon: "🔍" },
    { key: "product", label: "منتجات", icon: "📦" },
    { key: "person", label: "أشخاص", icon: "👥" },
    { key: "invoice", label: "فواتير", icon: "🧾" },
    { key: "payment", label: "مدفوعات", icon: "💰" },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        id="global-search-btn"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 16px",
          background: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.2)",
          borderRadius: "12px",
          color: "var(--text-secondary)",
          cursor: "pointer",
          fontSize: "0.85rem",
          fontFamily: "Cairo, sans-serif",
          transition: "all 0.2s ease",
          minWidth: "180px",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--accent-color)";
          e.currentTarget.style.background = "rgba(16, 185, 129, 0.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(16, 185, 129, 0.2)";
          e.currentTarget.style.background = "rgba(16, 185, 129, 0.08)";
        }}
      >
        🔍 بحث سريع...
        <kbd
          style={{
            marginRight: "auto",
            padding: "2px 6px",
            background: "rgba(255,255,255,0.08)",
            borderRadius: "4px",
            fontSize: "0.7rem",
            color: "var(--text-secondary)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          Ctrl+K
        </kbd>
      </button>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        paddingTop: "10vh",
      }}
    >
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(8px)",
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "relative",
          width: "95%",
          maxWidth: "640px",
          maxHeight: "75vh",
          background: "var(--bg-secondary)",
          border: "1px solid var(--border-color)",
          borderRadius: "20px",
          boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "searchSlideIn 0.2s ease-out",
        }}
      >
        {/* Search Input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-color)",
            gap: "12px",
          }}
        >
          <span style={{ fontSize: "1.3rem", opacity: 0.5 }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="ابحث عن منتج، عميل، فاتورة، أو رقم تليفون..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "1.1rem",
              fontFamily: "Cairo, sans-serif",
            }}
          />
          {loading && (
            <div
              style={{
                width: "20px",
                height: "20px",
                border: "2px solid rgba(16,185,129,0.3)",
                borderTopColor: "var(--accent-color)",
                borderRadius: "50%",
                animation: "spin 0.6s linear infinite",
              }}
            />
          )}
          <kbd
            onClick={close}
            style={{
              padding: "4px 8px",
              background: "rgba(255,255,255,0.08)",
              borderRadius: "6px",
              fontSize: "0.75rem",
              color: "var(--text-secondary)",
              border: "1px solid rgba(255,255,255,0.1)",
              cursor: "pointer",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Filter Tabs */}
        {results.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              padding: "10px 20px",
              borderBottom: "1px solid var(--border-color)",
              overflowX: "auto",
            }}
          >
            {filterButtons.map((f) => {
              const count =
                f.key === "all"
                  ? counts?.total || 0
                  : counts?.[f.key + "s"] || 0;
              return (
                <button
                  key={f.key}
                  onClick={() => {
                    setActiveFilter(f.key);
                    setSelectedIndex(0);
                  }}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    border:
                      activeFilter === f.key
                        ? "1px solid var(--accent-color)"
                        : "1px solid var(--border-color)",
                    background:
                      activeFilter === f.key
                        ? "rgba(16,185,129,0.15)"
                        : "transparent",
                    color:
                      activeFilter === f.key
                        ? "var(--accent-color)"
                        : "var(--text-secondary)",
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    fontFamily: "Cairo, sans-serif",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    transition: "all 0.2s ease",
                  }}
                >
                  {f.icon} {f.label}
                  {count > 0 && (
                    <span
                      style={{
                        marginRight: "4px",
                        opacity: 0.6,
                        fontSize: "0.7rem",
                      }}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Results */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px",
          }}
        >
          {query.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🔍</div>
              <div style={{ fontSize: "1rem" }}>
                اكتب للبحث في المنتجات، العملاء، الفواتير...
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  marginTop: "8px",
                  opacity: 0.6,
                }}
              >
                يمكنك البحث بالاسم، رقم التليفون، رقم الفاتورة، أو الباركود
              </div>
            </div>
          )}

          {query.length > 0 && !loading && filteredResults.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--text-secondary)",
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "8px" }}>😕</div>
              <div>لا توجد نتائج لـ &quot;{query}&quot;</div>
            </div>
          )}

          {filteredResults.map((result, idx) => (
            <button
              key={`${result.type}-${result.meta.id}-${idx}`}
              onClick={() => navigateTo(result)}
              onMouseEnter={() => setSelectedIndex(idx)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                width: "100%",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "none",
                background:
                  idx === selectedIndex
                    ? "rgba(16, 185, 129, 0.1)"
                    : "transparent",
                color: "var(--text-primary)",
                cursor: "pointer",
                textAlign: "right",
                fontFamily: "Cairo, sans-serif",
                transition: "background 0.15s ease",
              }}
            >
              {/* Icon */}
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "12px",
                  background: "rgba(16, 185, 129, 0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                  flexShrink: 0,
                }}
              >
                {result.icon}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {result.title}
                </div>
                <div
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {result.subtitle}
                </div>
              </div>

              {/* Detail */}
              {result.detail && (
                <div
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--accent-color)",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {result.detail}
                </div>
              )}

              {/* Arrow */}
              {idx === selectedIndex && (
                <span
                  style={{
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                    opacity: 0.5,
                  }}
                >
                  ←
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "10px 20px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
          }}
        >
          <div style={{ display: "flex", gap: "12px" }}>
            <span>
              <kbd style={kbdStyle}>↑↓</kbd> للتنقل
            </span>
            <span>
              <kbd style={kbdStyle}>Enter</kbd> للفتح
            </span>
            <span>
              <kbd style={kbdStyle}>Esc</kbd> للإغلاق
            </span>
          </div>
          {counts && counts.total > 0 && (
            <span>{counts.total} نتيجة</span>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes searchSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  padding: "2px 5px",
  background: "rgba(255,255,255,0.06)",
  borderRadius: "4px",
  border: "1px solid rgba(255,255,255,0.1)",
  fontSize: "0.7rem",
};
