"use client";
import React, { useState, useEffect, use } from "react";

interface StatementEntry {
  date: string;
  type: "INVOICE" | "PAYMENT";
  invoiceId?: number;
  invoiceNumber?: string;
  invoiceType?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  // New financial fields
  totalAmount?: number;
  netAmount?: number;
  discount?: number;
  deliveryFee?: number;
  paidAmount?: number;
  paymentMethod?: string | null;
  items?: Array<{ id: number; name: string; quantity: number; unitType: string; product: any; price: number; total: number }>;
}

interface Monthly {
  month: string;
  sales: number;
  purchases: number;
  payments: number;
}

interface Person {
  id: number;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  initialBalance: number;
  currentBalance: number;
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const MONTHS_AR: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو", "06": "يونيو", "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر", "10": "أكتوبر", "11": "نوفمبر", "12": "ديسمبر",
};

function formatMonth(m: string) {
  const [y, mo] = m.split("-");
  return `${MONTHS_AR[mo] || mo} ${y}`;
}

export default function StatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [person, setPerson] = useState<Person | null>(null);
  const [statement, setStatement] = useState<StatementEntry[]>([]);
  const [monthly, setMonthly] = useState<Monthly[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"statement" | "monthly">("statement");
  const [filterMonth, setFilterMonth] = useState("ALL");
  const [expandedInvoice, setExpandedInvoice] = useState<number | null>(null);
  
  // Payment recording states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("كاش");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentNotes, setPaymentNotes] = useState("");
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string>("NONE");
  
  // Editing states
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [editReason, setEditReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    setLoading(true);
    fetch(`/api/people/${id}/statement`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPerson(d.person);
          setStatement(d.statement);
          setMonthly(d.monthly);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const filteredStatement = filterMonth === "ALL"
    ? statement
    : statement.filter(e => {
        const d = new Date(e.date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === filterMonth;
      });

  const handlePrint = () => window.print();

  if (loading) return <div style={{ padding: "2rem", color: "var(--text-secondary)" }}>⏳ جاري تحميل كشف الحساب...</div>;
  if (!person) return <div style={{ padding: "2rem", color: "var(--danger-color)" }}>❌ لم يتم العثور على العميل/المورد</div>;

  const availableMonths = Array.from(
    new Set(statement.map(e => {
      const d = new Date(e.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }))
  ).sort();

  return (
    <div>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .glass-panel { background: white !important; border: 1px solid #ddd !important; color: #000 !important; }
          body { background: white !important; }
          table { font-size: 11px !important; }
          .sidebar { display: none !important; }
          main { margin: 0 !important; padding: 0 !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1.5rem" }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <div className="no-print" style={{ marginBottom: "0.5rem" }}>
            <a href="/people" style={{ color: "var(--accent-color)", textDecoration: "none", fontSize: "0.9rem" }}>← دليل العملاء والموردين</a>
          </div>
          <h1 style={{ margin: 0, fontSize: '2.2rem' }}>كشف حساب: {person.name}</h1>
          
          <div style={{ 
            marginTop: "1rem", 
            padding: "1rem", 
            background: "rgba(255,255,255,0.03)", 
            border: "1px solid rgba(255,255,255,0.08)", 
            borderRadius: "12px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px"
          }}>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>نوع الجهة:</span>
              <div style={{ fontWeight: "bold" }}>{person.type === "CUSTOMER" ? "👤 عميل" : "🏢 مورد"}</div>
            </div>
            <div>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>رقم الهاتف:</span>
              <div style={{ fontWeight: "bold" }} dir="ltr">{person.phone || "غير مسجل"}</div>
            </div>
            <div style={{ gridColumn: "span 2", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>العنوان:</span>
              <div style={{ fontWeight: "bold" }}>{person.address || "غير مسجل"}</div>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }} className="no-print">
          <button onClick={() => window.location.href=`/api/export?type=statement&personId=${id}`} className="btn" style={{ background: '#10b981', color: 'white', padding: "10px 16px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
            📊 تصدير إكسيل
          </button>
          <button onClick={handlePrint} className="btn" style={{ background: '#3b82f6', color: 'white', border: 'none' }}>
            🖨️ طباعة الكشف
          </button>
          <button onClick={handlePrint} className="btn" style={{ background: '#f43f5e', color: 'white', border: 'none' }}>
            📄 تصدير PDF
          </button>
          <button 
            onClick={() => setShowPaymentModal(true)} 
            className="btn" 
            style={{ background: person.type === "CUSTOMER" ? "var(--accent-color)" : "var(--success-color)", color: "#fff", padding: "10px 16px", borderRadius: "8px", border: "none", cursor: "pointer" }}
          >
            💰 {person.type === "CUSTOMER" ? "تحصيل نقدية" : "صرف نقدية"}
          </button>
          <a href={`/people/${id}/invoice`} className="btn" style={{ background: "rgba(255,255,255,0.08)", textDecoration: "none", padding: "10px 16px", borderRadius: "8px" }}>
            ➕ فاتورة جديدة
          </a>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {[
          { label: "الرصيد الحالي", value: person.currentBalance, color: person.currentBalance > 0 ? "var(--danger-color)" : person.currentBalance < 0 ? "var(--success-color)" : "var(--text-secondary)" },
          { label: "إجمالي المبيعات", value: monthly.reduce((s, m) => s + m.sales, 0), color: "var(--success-color)" },
          { label: "إجمالي التحصيلات", value: monthly.reduce((s, m) => s + m.payments, 0), color: "var(--accent-color)" },
          { label: "عدد الفواتير", value: statement.filter(e => e.type === "INVOICE").length, color: "var(--text-primary)", noCurrency: true },
        ].map(card => (
          <div key={card.label} className="glass-panel" style={{ padding: "1rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: "6px" }}>{card.label}</div>
            <div style={{ fontSize: "1.4rem", fontWeight: "bold", color: card.color }}>
              {card.noCurrency ? card.value : `${fmt(card.value as number)} ج.م`}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="no-print" style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border-color)" }}>
        {([["statement", "📄 كشف الحساب التفصيلي"], ["monthly", "📊 ملخص شهري"]] as const).map(([tab, label]) => (
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

      {/* ── Statement Tab ── */}
      {activeTab === "statement" && (
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }} className="no-print">
            <h3 style={{ margin: 0 }}>الحركات ({filteredStatement.length})</h3>
            <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field" style={{ width: "200px" }}>
              <option value="ALL">كل الفترات</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{formatMonth(m)}</option>
              ))}
            </select>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "rgba(59,130,246,0.15)", textAlign: "center" }}>
                <th style={th}>التاريخ</th>
                <th style={{ ...th, textAlign: "right" }}>البيان</th>
                <th style={th}>مدين</th>
                <th style={th}>دائن</th>
                <th style={{ ...th, background: "rgba(59,130,246,0.2)" }}>الرصيد</th>
              </tr>
            </thead>
            <tbody>
              {filteredStatement.map((entry, idx) => {
                const date = new Date(entry.date);
                const isNegBal = entry.balance < 0;
                return (
                  <React.Fragment key={idx}>
                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center", cursor: entry.items ? "pointer" : "default" }}
                      onClick={() => entry.items && setExpandedInvoice(expandedInvoice === idx ? null : idx)}>
                      <td style={td}>{date.toLocaleDateString("ar-EG")}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        <span style={{ color: entry.type === "PAYMENT" ? "var(--success-color)" : entry.invoiceType === "PURCHASES" ? "#f59e0b" : "var(--text-primary)" }}>
                          {entry.type === "PAYMENT" ? "💳 " : entry.invoiceType === "PURCHASES" ? "📥 " : "🧾 "}
                          {entry.description}
                        </span>
                        {entry.invoiceNumber && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginRight: "6px" }}>({entry.invoiceNumber})</span>
                        )}
                        {entry.items && <span style={{ fontSize: "0.7rem", color: "var(--accent-color)", marginRight: "6px" }}>{expandedInvoice === idx ? "▲" : "▼"} التفاصيل</span>}
                      </td>
                      <td style={{ ...td, color: "var(--danger-color)", fontWeight: entry.debit > 0 ? "bold" : "normal" }}>
                        {entry.debit > 0 ? fmt(entry.debit) : "-"}
                      </td>
                      <td style={{ ...td, color: "var(--success-color)", fontWeight: entry.credit > 0 ? "bold" : "normal" }}>
                        {entry.credit > 0 ? fmt(entry.credit) : "-"}
                      </td>
                      <td style={{ ...td, fontWeight: "bold", color: isNegBal ? "var(--success-color)" : entry.balance > 0 ? "var(--danger-color)" : "var(--text-secondary)", background: "rgba(59,130,246,0.06)" }}>
                        {fmt(entry.balance)} ج.م
                        {isNegBal && <span style={{ fontSize: "0.7rem" }}> (له)</span>}
                        {entry.balance > 0 && <span style={{ fontSize: "0.7rem" }}> (عليه)</span>}
                      </td>
                    </tr>
                    {expandedInvoice === idx && entry.items && (
                      <tr key={`${idx}-detail`}>
                        <td colSpan={5} style={{ padding: "0 16px 16px 16px", background: "rgba(0,0,0,0.2)" }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px', marginBottom: '10px', flexWrap: 'wrap', gap: '1rem' }}>
                             <div>
                                <strong>ملخص الفاتورة:</strong>
                                <div style={{ marginTop: '5px', display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                   <span>إجمالي الأصناف: <font color="#fff">{fmt(entry.totalAmount || 0)} ج.م</font></span>
                                   {entry.discount! > 0 && <span>الخصم: <font color="#ef4444">{fmt(entry.discount || 0)} ج.م</font></span>}
                                   {entry.deliveryFee! > 0 && <span>التوصيل: <font color="#10b981">{fmt(entry.deliveryFee || 0)} ج.م</font></span>}
                                   <span>الصافي: <font color="#fff" style={{fontWeight:'bold'}}>{fmt(entry.netAmount || 0)} ج.م</font></span>
                                </div>
                             </div>
                             <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button onClick={(e) => { e.stopPropagation(); window.open(`/invoices/${entry.invoiceId}/print`, '_blank'); }} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>🖨️ طباعة</button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingInvoice(JSON.parse(JSON.stringify(entry))); setEditReason(''); }} style={{ padding: '6px 12px', background: 'var(--accent-color)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>✏️ تعديل</button>
                                <button onClick={async (e) => { e.stopPropagation(); if (window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) { await fetch(`/api/invoices/${entry.invoiceId}`, { method: 'DELETE' }); fetchData(); } }} style={{ padding: '6px 12px', background: 'var(--danger-color)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>🗑️ حذف</button>
                             </div>
                          </div>

                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", marginTop: "8px" }}>
                            <thead>
                              <tr style={{ color: "var(--text-secondary)", borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                <th style={{ padding: "8px", textAlign: "right" }}>الصنف</th>
                                <th style={{ padding: "8px", textAlign: "center" }}>الكمية</th>
                                <th style={{ padding: "8px", textAlign: "center" }}>السعر</th>
                                <th style={{ padding: "8px", textAlign: "center" }}>الإجمالي</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.items.map((item, i) => (
                                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                                  <td style={{ padding: "6px 8px" }}>{item.name}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                    {item.unitType === 'SECONDARY' ? item.quantity : (item.quantity / (item.product?.conversionFactor || 1))} {item.unitType === 'SECONDARY' ? (item.product?.secondaryUnit || 'شريط') : (item.product?.unit || 'علبة')}
                                  </td>
                                  <td style={{ padding: "6px 8px", textAlign: "center" }}>{fmt(item.price)}</td>
                                  <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: "bold" }}>{fmt(item.total)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(59,130,246,0.2)", fontWeight: "bold", textAlign: "center" }}>
                <td colSpan={2} style={{ padding: "12px 8px", textAlign: "right" }}>الإجمالي</td>
                <td style={td}>{fmt(filteredStatement.reduce((s, e) => s + e.debit, 0))} ج.م</td>
                <td style={td}>{fmt(filteredStatement.reduce((s, e) => s + e.credit, 0))} ج.م</td>
                <td style={{ ...td, color: person.currentBalance > 0 ? "var(--danger-color)" : "var(--success-color)" }}>
                  {fmt(person.currentBalance)} ج.م
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ── Monthly Tab ── */}
      {activeTab === "monthly" && (
        <div className="glass-panel">
          <h3 style={{ marginBottom: "1.5rem" }}>📊 ملخص شهري</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ background: "rgba(59,130,246,0.15)", textAlign: "center" }}>
                <th style={{ ...th, textAlign: "right" }}>الشهر</th>
                <th style={th}>المبيعات/المشتريات</th>
                <th style={th}>التحصيلات/المدفوعات</th>
                <th style={th}>صافي</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map(m => {
                const isCustomer = person.type === 'CUSTOMER';
                const revenue = isCustomer ? m.sales : m.purchases;
                const net = m.payments - revenue;
                return (
                  <tr key={m.month} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", textAlign: "center" }}>
                    <td style={{ ...td, textAlign: "right", fontWeight: "bold" }}>{formatMonth(m.month)}</td>
                    <td style={{ ...td, color: "var(--danger-color)" }}>{revenue > 0 ? fmt(revenue) : "-"}</td>
                    <td style={{ ...td, color: "var(--success-color)" }}>{m.payments > 0 ? fmt(m.payments) : "-"}</td>
                    <td style={{ ...td, fontWeight: "bold", color: net >= 0 ? "var(--success-color)" : "var(--danger-color)" }}>
                      {net !== 0 ? `${fmt(net)} ج.م` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: "rgba(59,130,246,0.2)", fontWeight: "bold", textAlign: "center" }}>
                <td style={{ ...td, textAlign: "right" }}>الإجمالي</td>
                <td style={td}>{fmt(monthly.reduce((s, m) => s + (person.type === "CUSTOMER" ? m.sales : m.purchases), 0))} ج.م</td>
                <td style={td}>{fmt(monthly.reduce((s, m) => s + m.payments, 0))} ج.م</td>
                <td style={td}>{fmt(monthly.reduce((s, m) => s + m.payments - (person.type === "CUSTOMER" ? m.sales : m.purchases), 0))} ج.م</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="no-print" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
          <div className="glass-panel" style={{ width: "100%", maxWidth: "500px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <h2 style={{ margin: 0 }}>{person.type === "CUSTOMER" ? "تسجيل سند قبض" : "تسجيل سند دفع"}</h2>
              <button onClick={() => setShowPaymentModal(false)} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.5rem", cursor: "pointer" }}>×</button>
            </div>

            <div className="input-group">
              <label>المبلغ {person.type === "CUSTOMER" ? "(المستلم)" : "(المدفوع)"}</label>
              <input type="number" className="input-field" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} placeholder="0.00" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
              <div className="input-group">
                <label>الطريقة</label>
                <select className="input-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                  <option value="كاش">كاش</option>
                  <option value="انستاباي">انستاباي</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="اكسيس باي">اكسيس باي</option>
                </select>
              </div>
              <div className="input-group">
                <label>التاريخ</label>
                <input type="date" className="input-field" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
              </div>
            </div>

            <div className="input-group" style={{ marginTop: "1rem" }}>
              <label>ربط بفاتورة معينة (اختياري)</label>
              <select className="input-field" value={paymentInvoiceId} onChange={e => setPaymentInvoiceId(e.target.value)}>
                <option value="NONE">--- سداد على الحساب العام ---</option>
                {statement.filter(e => e.type === "INVOICE" && ((person.type === 'CUSTOMER' && e.debit > 0) || (person.type === 'SUPPLIER' && e.credit > 0))).map(inv => (
                  <option key={inv.invoiceId} value={inv.invoiceId}>
                    فاتورة رقم {inv.invoiceNumber} (صافي: {person.type === 'CUSTOMER' ? inv.debit : inv.credit} ج.م)
                  </option>
                ))}
              </select>
            </div>

            <div className="input-group" style={{ marginTop: "1rem" }}>
              <label>ملاحظات</label>
              <textarea className="input-field" rows={2} value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="سبب الدفعة أو رقم العملية..." />
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "2rem" }}>
              <button onClick={() => setShowPaymentModal(false)} className="btn" style={{ background: "rgba(255,255,255,0.1)" }}>إلغاء</button>
              <button 
                disabled={!paymentAmount || parseFloat(paymentAmount) <= 0 || submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const res = await fetch("/api/payments", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        personId: person.id,
                        invoiceId: paymentInvoiceId === "NONE" ? null : paymentInvoiceId,
                        amount: paymentAmount,
                        method: paymentMethod,
                        date: paymentDate,
                        notes: paymentNotes
                      })
                    });
                    if (res.ok) {
                      setShowPaymentModal(false);
                      setPaymentAmount("");
                      setPaymentNotes("");
                      fetchData();
                    }
                  } catch (e) { console.error(e); }
                  setSubmitting(false);
                }}
                className="btn"
                style={{ background: person.type === "CUSTOMER" ? "var(--accent-color)" : "var(--success-color)", color: "#fff" }}
              >
                {submitting ? "جاري الحفظ..." : "تأكيد العملية"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing Modal */}
      {editingInvoice && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
           <div className="glass-panel" style={{ width: '100%', maxWidth: '900px', maxHeight: '95vh', overflowY: 'auto' }}>
              <h2>تعديل فاتورة: {editingInvoice.invoiceNumber}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                 <div className="input-group"><label>الخصم</label><input type="number" className="input-field" value={editingInvoice.discount} onChange={e => setEditingInvoice({...editingInvoice, discount: e.target.value})} /></div>
                 <div className="input-group"><label>التوصيل</label><input type="number" className="input-field" value={editingInvoice.deliveryFee} onChange={e => setEditingInvoice({...editingInvoice, deliveryFee: e.target.value})} /></div>
                 <div className="input-group"><label>المدفوع</label><input type="number" className="input-field" value={editingInvoice.paidAmount} onChange={e => setEditingInvoice({...editingInvoice, paidAmount: e.target.value})} /></div>
              </div>
              <div className="input-group"><label>سبب التعديل</label><textarea className="input-field" value={editReason} onChange={e => setEditReason(e.target.value)} /></div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                 <button className="btn btn-primary" onClick={async () => {
                    setSubmitting(true);
                    await fetch(`/api/invoices/${editingInvoice.invoiceId}`, { 
                      method: 'PATCH', 
                      headers: { 'Content-Type': 'application/json' }, 
                      body: JSON.stringify({ 
                        items: editingInvoice.items, 
                        discount: editingInvoice.discount, 
                        deliveryFee: editingInvoice.deliveryFee, 
                        paidAmount: editingInvoice.paidAmount, 
                        reason: editReason 
                      }) 
                    });
                    setEditingInvoice(null); fetchData(); setSubmitting(false);
                 }}>حفظ التعديلات</button>
                 <button className="btn" onClick={() => setEditingInvoice(null)}>إلغاء</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: "12px 8px", borderBottom: "2px solid var(--border-color)", fontWeight: "bold", fontSize: "0.82rem" };
const td: React.CSSProperties = { padding: "10px 8px" };
