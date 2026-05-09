"use client";
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
}

type ViewMode = "summary" | "detailed";
type ActiveTab = "sales" | "purchases";

export default function AccountStatementPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("sales");
  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("ALL");
  const [selectedPerson, setSelectedPerson] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (selectedProduct !== "ALL") params.set("productId", selectedProduct);
    if (selectedPerson !== "ALL") params.set("personId", selectedPerson);
    fetch(`/api/account-statement?${params}`)
      .then(r => r.json())
      .then(d => { if (d.success) setData(d); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [startDate, endDate, selectedProduct, selectedPerson]);

  const filteredSalesProducts = useMemo(() => {
    if (!data) return [];
    return data.salesByProduct.filter((p: any) =>
      !searchTerm || p.name.includes(searchTerm)
    );
  }, [data, searchTerm]);

  const filteredPurchaseProducts = useMemo(() => {
    if (!data) return [];
    return data.purchasesByProduct.filter((p: any) =>
      !searchTerm || p.name.includes(searchTerm)
    );
  }, [data, searchTerm]);

  const filteredSalesItems = useMemo(() => {
    if (!data) return [];
    return data.allSalesItems.filter((i: any) =>
      !searchTerm || i.productName.includes(searchTerm) || i.personName.includes(searchTerm) || (i.invoiceNumber || "").includes(searchTerm)
    );
  }, [data, searchTerm]);

  const filteredPurchaseItems = useMemo(() => {
    if (!data) return [];
    return data.allPurchaseItems.filter((i: any) =>
      !searchTerm || i.productName.includes(searchTerm) || i.personName.includes(searchTerm) || (i.invoiceNumber || "").includes(searchTerm)
    );
  }, [data, searchTerm]);

  const exportToExcel = (type: "sales" | "purchases") => {
    if (!data) return;
    const items = type === "sales" ? data.allSalesItems : data.allPurchaseItems;
    const rows = items.map((i: any) => ({
      "التاريخ": new Date(i.date).toLocaleDateString("ar-EG"),
      "رقم الفاتورة": i.invoiceNumber || "",
      "النوع": i.invoiceType === "SALES" ? "بيع" : i.invoiceType === "PURCHASES" ? "شراء" : i.invoiceType === "SALES_RETURN" ? "مرتجع بيع" : "مرتجع شراء",
      "العميل/المورد": i.personName,
      "الصنف": i.productName,
      "التصنيف": i.category,
      "الكمية": i.quantity,
      "الوحدة": i.unitType === "SECONDARY" ? "ثانوية" : "أساسية",
      "السعر": i.price,
      "الإجمالي": i.total,
      ...(type === "sales" ? { "سعر التكلفة": i.costPrice, "الربح": i.total - (i.costPrice * i.quantity) } : {}),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, type === "sales" ? "المبيعات" : "المشتريات");
    XLSX.writeFile(wb, `كشف_حساب_${type === "sales" ? "المبيعات" : "المشتريات"}.xlsx`);
  };

  const exportProductSummary = (type: "sales" | "purchases") => {
    if (!data) return;
    const products = type === "sales" ? data.salesByProduct : data.purchasesByProduct;
    const rows = products.map((p: any) => ({
      "الصنف": p.name,
      "التصنيف": p.category,
      "عدد الفواتير": p.invoiceCount,
      "إجمالي الكمية": p.totalQty,
      "متوسط السعر": Number(p.avgPrice.toFixed(2)),
      "إجمالي القيمة": Number(p.totalValue.toFixed(2)),
      ...(type === "sales" ? { "إجمالي التكلفة": Number((p.totalCost || 0).toFixed(2)), "الربح": Number(((p.totalValue || 0) - (p.totalCost || 0)).toFixed(2)) } : {}),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!views"] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, type === "sales" ? "ملخص المبيعات" : "ملخص المشتريات");
    XLSX.writeFile(wb, `ملخص_${type === "sales" ? "المبيعات" : "المشتريات"}_بالأصناف.xlsx`);
  };

  if (loading) return (
    <div style={{ padding: "5rem", textAlign: "center", minHeight: "100vh", color: "var(--text-secondary)" }}>
      <div className="loader" style={{ marginBottom: "1rem" }}></div>
      <p style={{ fontSize: "1.2rem", fontWeight: "bold" }}>⏳ جاري تحميل كشف الحساب المفصل...</p>
    </div>
  );

  if (!data) return <div style={{ padding: "3rem", textAlign: "center" }}>❌ خطأ في تحميل البيانات</div>;

  const { summary } = data;

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "1rem" }}>
      {/* Header */}
      <div className="glass-panel" style={{ marginBottom: "1.5rem", borderRight: "5px solid var(--accent-color)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 className="gradient-text" style={{ margin: 0, fontSize: "1.8rem" }}>📋 كشف حساب مفصل</h1>
            <p style={{ color: "var(--text-secondary)", margin: "8px 0 0 0" }}>مراجعة شاملة لجميع المبيعات والمشتريات بالأصناف</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ marginBottom: "1.5rem", padding: "1rem 1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1", minWidth: "140px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>من تاريخ</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field" style={{ padding: "8px 12px" }} />
          </div>
          <div style={{ flex: "1", minWidth: "140px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>إلى تاريخ</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field" style={{ padding: "8px 12px" }} />
          </div>
          <div style={{ flex: "1", minWidth: "160px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>العميل / المورد</label>
            <select value={selectedPerson} onChange={e => setSelectedPerson(e.target.value)} className="input-field" style={{ padding: "8px 12px" }}>
              <option value="ALL">الكل</option>
              {data.filters.people.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.type === "CUSTOMER" ? "عميل" : "مورد"})</option>)}
            </select>
          </div>
          <div style={{ flex: "1", minWidth: "160px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>الصنف</label>
            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="input-field" style={{ padding: "8px 12px" }}>
              <option value="ALL">كل الأصناف</option>
              {data.filters.products.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{ flex: "1.5", minWidth: "180px" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>🔍 بحث</label>
            <input type="text" placeholder="اسم صنف، عميل، أو رقم فاتورة..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-field" style={{ padding: "8px 12px" }} />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid" style={{ marginBottom: "1.5rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="stat-card" style={{ borderTop: "3px solid var(--success-color)" }}>
          <div className="stat-title">صافي المبيعات</div>
          <div className="stat-value" style={{ fontSize: "1.6rem", color: "var(--success-color)" }}>{fmt(summary.netSales)}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{summary.salesInvoiceCount} فاتورة • {summary.uniqueSalesProducts} صنف</div>
        </div>
        <div className="stat-card" style={{ borderTop: "3px solid var(--danger-color)" }}>
          <div className="stat-title">صافي المشتريات</div>
          <div className="stat-value" style={{ fontSize: "1.6rem", color: "var(--danger-color)" }}>{fmt(summary.netPurchases)}</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-secondary)" }}>{summary.purchaseInvoiceCount} فاتورة • {summary.uniquePurchaseProducts} صنف</div>
        </div>
        <div className="stat-card" style={{ borderTop: "3px solid var(--warning-color)" }}>
          <div className="stat-title">مرتجعات المبيعات</div>
          <div className="stat-value" style={{ fontSize: "1.6rem", color: "var(--warning-color)" }}>{fmt(summary.totalSalesReturnValue)}</div>
        </div>
        <div className="stat-card" style={{ borderTop: "3px solid #8b5cf6" }}>
          <div className="stat-title">مرتجعات المشتريات</div>
          <div className="stat-value" style={{ fontSize: "1.6rem", color: "#8b5cf6" }}>{fmt(summary.totalPurchasesReturnValue)}</div>
        </div>
      </div>

      {/* Tabs & View Mode */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.75rem" }}>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button onClick={() => setActiveTab("sales")} className={`btn ${activeTab === "sales" ? "btn-primary" : ""}`} style={{ padding: "10px 20px" }}>
            💚 المبيعات ({summary.salesItemCount})
          </button>
          <button onClick={() => setActiveTab("purchases")} className={`btn ${activeTab === "purchases" ? "btn-primary" : ""}`} style={{ padding: "10px 20px" }}>
            📥 المشتريات ({summary.purchaseItemCount})
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button onClick={() => setViewMode("summary")} className={`btn ${viewMode === "summary" ? "btn-primary" : ""}`} style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
            📊 ملخص بالأصناف
          </button>
          <button onClick={() => setViewMode("detailed")} className={`btn ${viewMode === "detailed" ? "btn-primary" : ""}`} style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
            📝 تفصيلي بالفواتير
          </button>
          <button onClick={() => viewMode === "summary" ? exportProductSummary(activeTab) : exportToExcel(activeTab)} className="btn" style={exportBtnStyle}>
            📥 تصدير Excel
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === "sales" ? (
        viewMode === "summary" ? (
          <SummaryTable products={filteredSalesProducts} type="sales" expandedProduct={expandedProduct} setExpandedProduct={setExpandedProduct} />
        ) : (
          <DetailedTable items={filteredSalesItems} type="sales" />
        )
      ) : (
        viewMode === "summary" ? (
          <SummaryTable products={filteredPurchaseProducts} type="purchases" expandedProduct={expandedProduct} setExpandedProduct={setExpandedProduct} />
        ) : (
          <DetailedTable items={filteredPurchaseItems} type="purchases" />
        )
      )}

      <style jsx>{`
        table th { background: rgba(16, 185, 129, 0.06); padding: 12px; text-align: right; font-weight: 700; white-space: nowrap; }
        table td { padding: 10px 12px; border-bottom: 1px solid var(--border-color); text-align: right; }
        tr:hover { background: rgba(16, 185, 129, 0.04); }
        .expand-row { cursor: pointer; transition: all 0.2s; }
        .expand-row:hover { background: rgba(16, 185, 129, 0.08) !important; }
        .sub-row td { background: rgba(0,0,0,0.15); font-size: 0.85rem; }
        [data-theme='light'] .sub-row td { background: rgba(0,0,0,0.02); }
        .return-row { opacity: 0.7; }
        .return-badge { background: var(--danger-color); color: #fff; padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; margin-right: 6px; }
      `}</style>
    </div>
  );
}

function SummaryTable({ products, type, expandedProduct, setExpandedProduct }: { products: any[]; type: string; expandedProduct: number | null; setExpandedProduct: (id: number | null) => void }) {
  if (products.length === 0) return <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", opacity: 0.5 }}>لا توجد بيانات</div>;

  const grandTotalQty = products.reduce((s, p) => s + p.totalQty, 0);
  const grandTotalValue = products.reduce((s, p) => s + p.totalValue, 0);
  const grandTotalCost = type === "sales" ? products.reduce((s, p) => s + (p.totalCost || 0), 0) : 0;

  return (
    <div className="glass-panel" style={{ padding: "1rem" }}>
      <div className="table-responsive">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>التصنيف</th>
              <th>عدد الفواتير</th>
              <th>إجمالي الكمية</th>
              <th>متوسط السعر</th>
              <th>إجمالي القيمة</th>
              {type === "sales" && <th>التكلفة</th>}
              {type === "sales" && <th>الربح</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p, idx) => {
              const isExpanded = expandedProduct === p.productId;
              const profit = type === "sales" ? (p.totalValue - (p.totalCost || 0)) : 0;
              return (
                <SummaryRow key={p.productId} p={p} idx={idx} type={type} isExpanded={isExpanded} profit={profit}
                  onClick={() => setExpandedProduct(isExpanded ? null : p.productId)} />
              );
            })}
            {/* Grand Total */}
            <tr style={{ fontWeight: "bold", borderTop: "3px solid var(--accent-color)", background: "rgba(16, 185, 129, 0.08)" }}>
              <td></td>
              <td>الإجمالي</td>
              <td>{products.length} صنف</td>
              <td>{products.reduce((s, p) => s + p.invoiceCount, 0)}</td>
              <td>{fmt(grandTotalQty)}</td>
              <td>—</td>
              <td style={{ color: "var(--accent-color)" }}>{fmt(grandTotalValue)}</td>
              {type === "sales" && <td style={{ color: "var(--danger-color)" }}>{fmt(grandTotalCost)}</td>}
              {type === "sales" && <td style={{ color: grandTotalValue - grandTotalCost >= 0 ? "var(--success-color)" : "var(--danger-color)" }}>{fmt(grandTotalValue - grandTotalCost)}</td>}
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryRow({ p, idx, type, isExpanded, profit, onClick }: any) {
  return (
    <>
      <tr className="expand-row" onClick={onClick} style={{ cursor: "pointer" }}>
        <td>{idx + 1}</td>
        <td style={{ fontWeight: "bold" }}>{p.name}</td>
        <td style={{ fontSize: "0.8rem", opacity: 0.7 }}>{p.category}</td>
        <td>{p.invoiceCount}</td>
        <td>{fmt(p.totalQty)}</td>
        <td>{fmt(p.avgPrice)}</td>
        <td style={{ fontWeight: "bold" }}>{fmt(p.totalValue)}</td>
        {type === "sales" && <td style={{ color: "var(--danger-color)" }}>{fmt(p.totalCost || 0)}</td>}
        {type === "sales" && <td style={{ fontWeight: "bold", color: profit >= 0 ? "var(--success-color)" : "var(--danger-color)" }}>{fmt(profit)}</td>}
        <td style={{ fontSize: "1.2rem" }}>{isExpanded ? "▲" : "▼"}</td>
      </tr>
      {isExpanded && p.items.map((item: any, i: number) => (
        <tr key={i} className={`sub-row ${item.isReturn ? "return-row" : ""}`}>
          <td></td>
          <td>
            {item.isReturn && <span className="return-badge">مرتجع</span>}
            <span style={{ fontSize: "0.8rem", color: "var(--accent-color)" }}>{item.invoiceNumber}</span>
          </td>
          <td style={{ fontSize: "0.8rem" }}>{fmtDate(item.date)}</td>
          <td>{item.personName}</td>
          <td style={{ color: item.qty < 0 ? "var(--danger-color)" : "inherit" }}>{fmt(item.qty)}</td>
          <td>{fmt(item.price)}</td>
          <td style={{ color: item.total < 0 ? "var(--danger-color)" : "inherit" }}>{fmt(item.total)}</td>
          {type === "sales" && <td style={{ fontSize: "0.8rem" }}>{fmt(item.costPrice)}</td>}
          {type === "sales" && <td style={{ fontSize: "0.8rem", color: (item.total - item.costPrice * Math.abs(item.qty)) >= 0 ? "var(--success-color)" : "var(--danger-color)" }}>{fmt(item.total - item.costPrice * Math.abs(item.qty))}</td>}
          <td></td>
        </tr>
      ))}
    </>
  );
}

function DetailedTable({ items, type }: { items: any[]; type: string }) {
  if (items.length === 0) return <div className="glass-panel" style={{ padding: "3rem", textAlign: "center", opacity: 0.5 }}>لا توجد بيانات</div>;

  const totalValue = items.reduce((s, i) => s + i.total, 0);

  return (
    <div className="glass-panel" style={{ padding: "1rem" }}>
      <div style={{ marginBottom: "0.75rem", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
        عرض {items.length} سطر
      </div>
      <div className="table-responsive">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>#</th>
              <th>التاريخ</th>
              <th>رقم الفاتورة</th>
              <th>النوع</th>
              <th>{type === "sales" ? "العميل" : "المورد"}</th>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>السعر</th>
              <th>الإجمالي</th>
              {type === "sales" && <th>التكلفة</th>}
              {type === "sales" && <th>الربح</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isReturn = item.invoiceType.includes("RETURN");
              const profit = type === "sales" ? (item.total - item.costPrice * item.quantity) : 0;
              return (
                <tr key={item.id || idx} className={isReturn ? "return-row" : ""}>
                  <td>{idx + 1}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(item.date)}</td>
                  <td style={{ color: "var(--accent-color)", fontWeight: "bold", fontSize: "0.85rem" }}>{item.invoiceNumber}</td>
                  <td>
                    {isReturn && <span className="return-badge">مرتجع</span>}
                    {!isReturn && (type === "sales" ? "بيع" : "شراء")}
                  </td>
                  <td>{item.personName}</td>
                  <td style={{ fontWeight: "600" }}>{item.productName}</td>
                  <td>{fmt(item.quantity)}</td>
                  <td>{fmt(item.price)}</td>
                  <td style={{ fontWeight: "bold" }}>{fmt(item.total)}</td>
                  {type === "sales" && <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{fmt(item.costPrice)}</td>}
                  {type === "sales" && <td style={{ fontWeight: "bold", color: profit >= 0 ? "var(--success-color)" : "var(--danger-color)" }}>{fmt(profit)}</td>}
                </tr>
              );
            })}
            <tr style={{ fontWeight: "bold", borderTop: "3px solid var(--accent-color)", background: "rgba(16, 185, 129, 0.08)" }}>
              <td colSpan={type === "sales" ? 8 : 8}>الإجمالي ({items.length} سطر)</td>
              <td style={{ color: "var(--accent-color)", fontWeight: "bold" }}>{fmt(totalValue)}</td>
              {type === "sales" && <td>{fmt(items.reduce((s, i) => s + (i.costPrice * i.quantity), 0))}</td>}
              {type === "sales" && <td style={{ color: "var(--success-color)" }}>{fmt(totalValue - items.reduce((s, i) => s + (i.costPrice * i.quantity), 0))}</td>}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const exportBtnStyle: React.CSSProperties = {
  padding: "8px 16px",
  fontSize: "0.85rem",
  background: "rgba(16, 185, 129, 0.15)",
  border: "1px solid rgba(16, 185, 129, 0.3)",
  color: "#34d399",
  borderRadius: "8px",
  cursor: "pointer",
  fontWeight: "600",
  whiteSpace: "nowrap",
};
