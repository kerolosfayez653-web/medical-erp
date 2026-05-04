"use client";
import React, { useState, useEffect, use } from "react";

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProductStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [product, setProduct] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [customerSummary, setCustomerSummary] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"transactions" | "customers">("transactions");
  const [filterType, setFilterType] = useState("ALL");

  useEffect(() => {
    fetch(`/api/products/${id}/statement`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProduct(d.product);
          setTransactions(d.transactions);
          setCustomerSummary(d.customerSummary);
          setStats(d.stats);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  const filtered = transactions.filter(t => {
    if (filterType === "ALL") return true;
    return t.invoiceType === filterType;
  });

  if (loading) return <div style={{ padding: "3rem", color: "var(--text-secondary)", textAlign: "center" }}>⏳ جاري تحميل كشف حساب الصنف...</div>;
  if (!product) return <div style={{ padding: "2rem", color: "var(--danger-color)" }}>❌ لم يتم العثور على الصنف</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1.5rem" }}>
        <div style={{ flex: 1 }}>
          <a href="/inventory" style={{ color: "var(--accent-color)", textDecoration: "none", fontSize: "0.9rem" }}>← العودة للمخزون</a>
          <h1 style={{ margin: "0.5rem 0 0", fontSize: "2rem" }}>📦 كشف حساب صنف: {product.name}</h1>
          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            {product.barcode && <span>الكود: <strong>{product.barcode}</strong></span>}
            {product.category && <span>التصنيف: <strong>{product.category}</strong></span>}
            {product.unit && <span>الوحدة: <strong>{product.unit}</strong></span>}
          </div>
        </div>
        <button onClick={() => window.print()} className="btn" style={{ background: "#3b82f6", color: "white", border: "none" }}>
          🖨️ طباعة
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
          <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>عدد فواتير المبيعات</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--accent-color)" }}>{stats.salesInvoiceCount}</div>
          </div>
          <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>إجمالي الكمية المباعة</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--success-color)" }}>{stats.totalSalesQty} {product.secondaryUnit || "وحدة"}</div>
          </div>
          <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>إيراد المبيعات</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--success-color)" }}>{fmt(stats.totalSalesRevenue)} ج.م</div>
          </div>
          <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>عدد فواتير المشتريات</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#f59e0b" }}>{stats.purchasesInvoiceCount}</div>
          </div>
          <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>إجمالي الكمية المشتراة</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "#f59e0b" }}>{stats.totalPurchasesQty} {product.secondaryUnit || "وحدة"}</div>
          </div>
          <div className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: "4px" }}>عدد العملاء</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: "var(--text-primary)" }}>{stats.uniqueCustomers}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)" }}>
        {([["transactions", "📋 سجل الحركات"], ["customers", "👥 كشف العملاء والموردين"]] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: "none", border: "none", padding: "10px 20px", cursor: "pointer",
              color: activeTab === tab ? "var(--accent-color)" : "var(--text-secondary)",
              borderBottom: activeTab === tab ? "2px solid var(--accent-color)" : "2px solid transparent",
              fontFamily: "inherit", fontSize: "0.95rem", fontWeight: activeTab === tab ? "bold" : "normal",
              marginBottom: "-1px",
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <h3 style={{ margin: 0 }}>حركات الصنف ({filtered.length})</h3>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={() => setFilterType("ALL")} className={`btn ${filterType === "ALL" ? "btn-primary" : ""}`} style={{ padding: "6px 14px" }}>الكل</button>
              <button onClick={() => setFilterType("SALES")} className={`btn ${filterType === "SALES" ? "btn-primary" : ""}`} style={{ padding: "6px 14px" }}>مبيعات</button>
              <button onClick={() => setFilterType("PURCHASES")} className={`btn ${filterType === "PURCHASES" ? "btn-primary" : ""}`} style={{ padding: "6px 14px" }}>مشتريات</button>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "rgba(59,130,246,0.15)", textAlign: "center" }}>
                <th style={th}>التاريخ</th>
                <th style={th}>رقم الفاتورة</th>
                <th style={th}>النوع</th>
                <th style={{ ...th, textAlign: "right" }}>العميل/المورد</th>
                <th style={th}>الكمية</th>
                <th style={th}>السعر</th>
                <th style={th}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                  <td style={td}>{new Date(t.date).toLocaleDateString("ar-EG")}</td>
                  <td style={td}>
                    <a href={`/invoices/${t.invoiceId}/print`} target="_blank" style={{ color: "var(--accent-color)", textDecoration: "underline" }}>
                      {t.invoiceNumber}
                    </a>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: "3px 8px", borderRadius: "6px", fontSize: "0.75rem",
                      background: t.invoiceType === "SALES" ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                      color: t.invoiceType === "SALES" ? "var(--success-color)" : "#f59e0b"
                    }}>
                      {t.invoiceType === "SALES" ? "مبيعات" : "مشتريات"}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>
                    <a href={`/people/${t.personId}/statement`} style={{ color: "inherit", textDecoration: "underline" }}>
                      {t.personName}
                    </a>
                  </td>
                  <td style={td}>
                    {t.unitType === "SECONDARY" ? t.quantity : (t.quantity / (product.conversionFactor || 1))} {t.unitType === "SECONDARY" ? (product.secondaryUnit || "وحدة") : (product.unit || "وحدة")}
                  </td>
                  <td style={td}>{fmt(t.price)}</td>
                  <td style={{ ...td, fontWeight: "bold" }}>{fmt(t.total)} ج.م</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(59,130,246,0.2)", fontWeight: "bold", textAlign: "center" }}>
                <td colSpan={4} style={{ ...td, textAlign: "right" }}>الإجمالي ({filtered.length} حركة)</td>
                <td style={td}>{filtered.reduce((s, t) => s + t.quantity, 0)} {product.secondaryUnit || "وحدة"}</td>
                <td style={td}>-</td>
                <td style={{ ...td, fontWeight: "bold" }}>{fmt(filtered.reduce((s, t) => s + t.total, 0))} ج.م</td>
              </tr>
            </tfoot>
          </table>
          {filtered.length === 0 && <div style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>لا توجد حركات لهذا الصنف</div>}
        </div>
      )}

      {/* Customer Summary Tab */}
      {activeTab === "customers" && (
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          <h3 style={{ marginBottom: "1.5rem" }}>👥 ملخص العملاء والموردين لهذا الصنف ({customerSummary.length})</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "rgba(59,130,246,0.15)", textAlign: "center" }}>
                <th style={{ ...th, textAlign: "right" }}>الاسم</th>
                <th style={th}>النوع</th>
                <th style={th}>عدد الفواتير</th>
                <th style={th}>إجمالي الكمية</th>
                <th style={th}>إجمالي المبلغ</th>
                <th style={th}>آخر معاملة</th>
              </tr>
            </thead>
            <tbody>
              {customerSummary.map(c => (
                <tr key={c.personId} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                  <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>
                    <a href={`/people/${c.personId}/statement`} style={{ color: "inherit", textDecoration: "underline" }}>
                      {c.name}
                    </a>
                  </td>
                  <td style={td}>
                    <span style={{
                      padding: "3px 8px", borderRadius: "6px", fontSize: "0.75rem",
                      background: c.type === "CUSTOMER" ? "rgba(7,89,133,0.1)" : "rgba(107,114,128,0.1)",
                      color: c.type === "CUSTOMER" ? "#38bdf8" : "#94a3b8"
                    }}>
                      {c.type === "CUSTOMER" ? "عميل" : "مورد"}
                    </span>
                  </td>
                  <td style={td}>{c.invoiceCount}</td>
                  <td style={td}>{c.totalQty} {product.secondaryUnit || "وحدة"}</td>
                  <td style={{ ...td, fontWeight: "bold" }}>{fmt(c.totalAmount)} ج.م</td>
                  <td style={td}>{new Date(c.lastDate).toLocaleDateString("ar-EG")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {customerSummary.length === 0 && <div style={{ textAlign: "center", padding: "3rem", opacity: 0.5 }}>لا توجد معاملات لهذا الصنف</div>}
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "12px 8px", borderBottom: "2px solid var(--border-color)", fontWeight: "bold", fontSize: "0.82rem" };
const td: React.CSSProperties = { padding: "10px 8px" };
