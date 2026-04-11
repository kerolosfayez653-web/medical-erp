"use client";
import { useState, useEffect } from "react";

interface Totals {
  totalSales: number;
  totalPurchases: number;
  totalCOGS: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  totalPaymentsIn: number;
  totalPaymentsOut: number;
  salesCount: number;
  purchasesCount: number;
  totalDeliveryRevenue: number;
  totalDiscount: number;
  totalOpeningValue: number;
  openingCashBalance: number;
}

interface MonthlyData {
  month: string;
  sales: number;
  purchases: number;
  cogs: number;
  expenses: number;
}

const MONTHS_AR: Record<string, string> = {
  "01": "يناير", "02": "فبراير", "03": "مارس", "04": "أبريل",
  "05": "مايو",  "06": "يونيو",  "07": "يوليو", "08": "أغسطس",
  "09": "سبتمبر","10": "أكتوبر","11": "نوفمبر","12": "ديسمبر",
};

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface BalanceSheet {
  cashOnHand: number;
  receivables: number;
  payables: number;
  inventoryValue: number;
  previousProfit: number;
  currentProfit: number;
  totalAssets: number;
}

export default function ReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState("ALL");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [balanceSheetDetails, setBalanceSheetDetails] = useState<any>(null);
  const [expenseBreakdown, setExpenseBreakdown] = useState<Record<string, number>>({});
  const [monthly, setMonthly] = useState<MonthlyData[]>([]);
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [allExpenses, setAllExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"income" | "balance">("income");
  
  const startDate = month === "ALL" ? new Date(`${year}-01-01`) : new Date(`${year}-${month}-01`);
  const endDate = new Date(startDate);
  if (month === "ALL") {
    endDate.setFullYear(year + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  // Drill-down Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalData, setModalData] = useState<any[]>([]);
  const [modalType, setModalType] = useState<"invoices" | "expenses" | "customers" | "suppliers" | "inventory" | "cash" | "profit_summary" | "equity_breakdown">("invoices");

  const fetchReports = () => {
    setLoading(true);
    fetch(`/api/reports?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTotals(d.totals);
          setBalanceSheet(d.balanceSheet);
          setBalanceSheetDetails(d.balanceSheetDetails);
          setExpenseBreakdown(d.expenseBreakdown);
          setMonthly(d.monthly);
          setAllInvoices(d.invoices || []);
          setAllExpenses(d.expenses || []);
        } else {
          console.error("Reports error:", d.error);
        }
      })
      .catch(err => {
        console.error("Fetch reports failed:", err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchReports(); }, [year, month]);

  const openDrillDown = (title: string, data: any[], type: any) => {
    setModalTitle(title);
    setModalData(data);
    setModalType(type);
    setShowModal(true);
  };

  if (loading) return (
    <div style={{ padding: '5rem', textAlign: 'center', background: 'var(--bg-color)', minHeight: '100vh', color: 'var(--text-secondary)' }}>
      <div className="loader" style={{ marginBottom: '1rem' }}></div>
      <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>⏳ جاري تحليل البيانات المالية وإنتاج التقارير...</p>
    </div>
  );

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '1rem' }}>
      <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRight: '5px solid var(--accent-color)', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="gradient-text" style={{ margin: 0, fontSize: '1.8rem' }}>📊 التقارير والمركز المالي</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>تحليل شامل - الفترة: {month === 'ALL' ? year : `${MONTHS_AR[month]} ${year}`}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input-field" style={{ width: '90px', padding: '6px' }}>
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
          <select value={month} onChange={e => setMonth(e.target.value)} className="input-field" style={{ width: '120px', padding: '6px' }}>
            <option value="ALL">كل الشهور</option>
            {Object.entries(MONTHS_AR).map(([mo, name]) => <option key={mo} value={mo}>{name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="stack-mobile" style={{ gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab("income")}
          className={`btn ${activeTab === 'income' ? 'btn-primary' : ''}`}
          style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: activeTab === 'income' ? '' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(16, 185, 129, 0.1)', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
        >
          📈 قائمة الدخل (P&L)
        </button>
        <button 
          onClick={() => setActiveTab("balance")}
          className={`btn ${activeTab === 'balance' ? 'btn-primary' : ''}`}
          style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: activeTab === 'balance' ? '' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(16, 185, 129, 0.1)', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ⚖️ المركز المالي (Balance Sheet)
        </button>
      </div>

      {activeTab === "income" ? (
        <div className="stats-grid" style={{ gap: '2rem' }}>
          
          {/* Statement 1: Income Statement */}
          <div className="glass-panel" style={{ padding: '2rem', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--accent-color)', paddingBottom: '0.8rem' }}>
              <h2 style={{ margin: 0 }}>📊 قائمة الأرباح والخسائر</h2>
              <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>القيمة بالجنيه المصري (ج.م)</span>
            </div>
            
            <div 
              onClick={() => openDrillDown("تفاصيل المبيعات", allInvoices.filter(i => i.type === 'SALES'), "invoices")}
              style={reportRowClickable}
            >
              <span>إجمالي قيمة المنتجات</span>
              <span>{fmt((totals?.totalSales || 0) - (totals?.totalDeliveryRevenue || 0) + (totals?.totalDiscount || 0))}</span>
            </div>

            <div 
              onClick={() => openDrillDown("رسوم التوصيل المحصلة", allInvoices.filter(i => i.type === 'SALES' && i.deliveryFee > 0), "invoices")}
              style={{ ...reportRowClickable, color: 'var(--success-color)' }}
            >
              <span>(+) رسوم التوصيل المحصلة</span>
              <span>{fmt(totals?.totalDeliveryRevenue || 0)}</span>
            </div>

            <div 
              onClick={() => openDrillDown("إجمالي الخصومات الممنوحة", allInvoices.filter(i => i.type === 'SALES' && i.discount > 0), "invoices")}
              style={{ ...reportRowClickable, color: 'var(--danger-color)' }}
            >
              <span>(-) إجمالي الخصومات الممنوحة</span>
              <span>{fmt(totals?.totalDiscount || 0)}</span>
            </div>

            <div style={{ ...reportRow, fontWeight: 'bold', margin: '1rem 0', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
              <span>صافي المبيعات (Net Sales)</span>
              <span className="gradient-text">{fmt(totals?.totalSales || 0)}</span>
            </div>

            <div 
              onClick={() => openDrillDown("تكلفة البضاعة المباعة (حسب الأصناف)", allInvoices.filter(i => i.type === 'SALES'), "invoices")}
              style={{ ...reportRowClickable, color: 'var(--danger-color)' }}
            >
              <span>تكلفة البضاعة المباعة (WAC)</span>
              <span>({fmt(totals?.totalCOGS || 0)})</span>
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />
            
            <div 
              onClick={() => openDrillDown("تحليل الربح الإجمالي", [], "profit_summary")}
              style={{ ...reportRowClickable, fontWeight: 'bold', fontSize: '1.4rem', color: 'var(--success-color)', padding: '10px' }}
            >
              <span>مجمل الربح (Gross Profit)</span>
              <span>{fmt(totals?.grossProfit || 0)}</span>
            </div>

            <div style={{ marginTop: '2.5rem' }}>
              <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', paddingBottom: '5px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>المصروفات التشغيلية:</h4>
              {Object.entries(expenseBreakdown).map(([cat, amt]) => (
                <div 
                  key={cat} 
                  onClick={() => openDrillDown(`مصروفات: ${cat}`, allExpenses.filter(e => e.category === cat), "expenses")}
                  style={reportRowClickable}
                >
                  <span>{cat}</span>
                  <span>{fmt(amt)}</span>
                </div>
              ))}
              <div 
                onClick={() => openDrillDown("كافة المصروفات", allExpenses, "expenses")}
                style={{ ...reportRowClickable, fontWeight: 'bold', color: 'var(--danger-color)', marginTop: '0.5rem', background: 'rgba(239, 68, 68, 0.05)' }}
              >
                <span>إجمالي المصروفات التشغيلية</span>
                <span>{fmt(totals?.totalExpenses || 0)}</span>
              </div>
            </div>

            <hr style={{ border: 'none', borderTop: '3px double var(--border-color)', margin: '2rem 0' }} />
            
            <div 
              onClick={() => openDrillDown("تحليل صافي الربح", [], "profit_summary")}
              style={{ 
                ...reportRowClickable, 
                fontWeight: 'bold', 
                fontSize: '1.8rem', 
                color: totals?.netProfit! >= 0 ? 'var(--accent-color)' : 'var(--danger-color)',
                background: 'rgba(255,255,255,0.05)',
                padding: '20px',
                borderRadius: '12px'
              }}>
              <span>صافي الربح / الخسارة</span>
              <span>{fmt(totals?.netProfit || 0)}</span>
            </div>
          </div>

          {/* Statement 2: Cash Flow & Assets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            <div className="glass-panel" style={{ padding: '2rem', borderLeft: '5px solid var(--success-color)' }}>
              <h2 style={{ borderBottom: '2px solid var(--success-color)', paddingBottom: '0.8rem', marginBottom: '1.5rem' }}>💰 ملخص التدفقات النقدية</h2>
              
              <div style={reportRow}>
                <span>رصيد نقدية أول المدة (١/١/{year})</span>
                <span style={{ fontWeight: 'bold' }}>{fmt(totals?.openingCashBalance || 0)}</span>
              </div>

              <div 
                onClick={() => openDrillDown("المقبوضات (تحصيلات الفترة)", balanceSheetDetails?.cash?.filter((p:any) => p.type === 'IN' && new Date(p.date) >= new Date(startDate) && new Date(p.date) < new Date(endDate)), "cash")}
                style={reportRowClickable}
              >
                <span>(+) إجمالي المقبوضات (تحصيل عملاء)</span>
                <span style={{ color: 'var(--success-color)' }}>{fmt(totals?.totalPaymentsIn || 0)}</span>
              </div>
              
              <div 
                onClick={() => openDrillDown("المدفوعات (مصاريف وموردين)", [...allExpenses, ...balanceSheetDetails?.cash?.filter((p:any) => p.type === 'OUT' && new Date(p.date) >= new Date(startDate) && new Date(p.date) < new Date(endDate))], "cash")}
                style={reportRowClickable}
              >
                <span>(-) إجمالي المدفوعات (موردين ومصاريف)</span>
                <span style={{ color: 'var(--danger-color)' }}>{fmt((totals?.totalPaymentsOut || 0) + (totals?.totalExpenses || 0))}</span>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />

              <div 
                onClick={() => openDrillDown("تفاصيل حركات النقدية (الخزينة)", balanceSheetDetails?.cash || [], "cash")}
                style={{ ...reportRowClickable, fontWeight: 'bold', fontSize: '1.3rem', padding: '15px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px' }}
              >
                <span>رصيد النقدية النهائي</span>
                <span>{fmt((totals?.openingCashBalance || 0) + (totals?.totalPaymentsIn || 0) - (totals?.totalPaymentsOut || 0) - (totals?.totalExpenses || 0))}</span>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '2rem', borderLeft: '5px solid var(--warning-color)' }}>
              <h2 style={{ borderBottom: '2px solid var(--warning-color)', paddingBottom: '0.8rem', marginBottom: '1.5rem' }}>📦 حالة المخزون والسلع</h2>
              <div style={reportRow}>
                <span>رصيد أول المدة (١/١/{year})</span>
                <span>{fmt(totals?.totalOpeningValue || 0)}</span>
              </div>
              <div onClick={() => openDrillDown("تفاصيل المشتريات", allInvoices.filter(i => i.type === 'PURCHASES'), "invoices")} style={reportRowClickable}>
                <span>إجمالي المشتريات (الإضافة)</span>
                <span style={{ color: 'var(--success-color)' }}>{fmt(totals?.totalPurchases || 0)}</span>
              </div>
              <div style={reportRow}>
                <span>تكلفة البضاعة الخارجة (مباعة)</span>
                <span style={{ color: 'var(--danger-color)' }}>{fmt(totals?.totalCOGS || 0)}</span>
              </div>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />
              <div 
                onClick={() => openDrillDown("تحليل مخزون السلع", balanceSheetDetails?.inventory || [], "inventory")}
                style={{ ...reportRowClickable, fontWeight: 'bold', fontSize: '1.3rem', color: 'var(--warning-color)', padding: '15px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px' }}
              >
                <span>قيمة المخزون بنهاية الفترة</span>
                <span>{fmt((totals?.totalOpeningValue || 0) + (totals?.totalPurchases || 0) - (totals?.totalCOGS || 0))}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Statement 3: Balance Sheet (Snapshot at EndDate) */
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '3px solid var(--accent-color)', paddingBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>⚖️ قائمة المركز المالي (الميزانية العمومية)</h2>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>كما هي في {month === 'ALL' ? `٣١/١٢/${year}` : `${new Date(year, parseInt(month), 0).toLocaleDateString("ar-EG")}`}</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>حسابات تراكمية حتى تاريخ التقرير</div>
            </div>
          </div>

          <div className="stats-grid" style={{ gap: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
            {/* Left Column: Assets */}
            <div>
              <h3 style={{ borderBottom: '1px solid var(--success-color)', color: 'var(--success-color)', paddingBottom: '8px' }}>الأصول (Assets)</h3>
              <div 
                onClick={() => openDrillDown("تحليل السيولة النقدية", balanceSheetDetails?.cash || [], "cash")}
                style={reportRowClickable}
              >
                <span>الخزينة (النقدية المتوفرة)</span>
                <span>{fmt(balanceSheet?.cashOnHand || 0)}</span>
              </div>
              <div 
                onClick={() => openDrillDown("تحليل مديونيات العملاء", balanceSheetDetails?.customers || [], "customers")}
                style={reportRowClickable}
              >
                <span>مديونيات العملاء (Receivables)</span>
                <span>{fmt(balanceSheet?.receivables || 0)}</span>
              </div>
              <div 
                onClick={() => openDrillDown("تحليل مخزون السلع", balanceSheetDetails?.inventory || [], "inventory")}
                style={reportRowClickable}
              >
                <span>مخزون السلع (Inventory)</span>
                <span>{fmt(balanceSheet?.inventoryValue || 0)}</span>
              </div>
              <div style={{ ...reportRow, padding: '12px 1rem', borderTop: '1px solid var(--border-color)', marginTop: '2rem', fontWeight: 'bold', fontSize: '1.4rem' }}>
                <span>إجمالي الأصول</span>
                <span className="gradient-text">{fmt(balanceSheet?.totalAssets || 0)}</span>
              </div>
            </div>

            {/* Right Column: Liabilities & Equity */}
            <div>
              <h3 style={{ borderBottom: '1px solid var(--danger-color)', color: 'var(--danger-color)', paddingBottom: '8px' }}>الخصوم وحقوق الملكية</h3>
              <div 
                onClick={() => openDrillDown("تحليل مديونيات الموردين", balanceSheetDetails?.suppliers || [], "suppliers")}
                style={reportRowClickable}
              >
                <span>مديونيات الموردين (Payables)</span>
                <span>{fmt(balanceSheet?.payables || 0)}</span>
              </div>
              <div 
                onClick={() => openDrillDown("الأرباح المرحلة (سابقاً)", [], "profit_summary")}
                style={reportRowClickable}
              >
                <span style={{ opacity: 0.7 }}>الأرباح المرحلة (Previous Profits)</span>
                <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>{fmt(balanceSheet?.previousProfit || 0)}</span>
              </div>
              <div 
                onClick={() => openDrillDown("صافي ربح العام الحالي", [], "profit_summary")}
                style={reportRowClickable}
              >
                <span style={{ opacity: 0.7 }}>صافي ربح العام الحالي</span>
                <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>{fmt(balanceSheet?.currentProfit || 0)}</span>
              </div>
              <div 
                onClick={() => openDrillDown("تحليل حقوق الملكية والفرق الموازن", [], "equity_breakdown")}
                style={reportRowClickable}
              >
                <span style={{ opacity: 0.7 }}>رأس المال الموازن (Equity Carry)</span>
                <span>{fmt((balanceSheet?.totalAssets || 0) - (balanceSheet?.payables || 0) - (balanceSheet?.previousProfit || 0) - (balanceSheet?.currentProfit || 0))}</span>
              </div>
              <div style={{ ...reportRow, padding: '12px 1rem', borderTop: '1px solid var(--border-color)', marginTop: '2rem', fontWeight: 'bold', fontSize: '1.4rem' }}>
                <span>إجمالي الخصوم وحقوق الملكية</span>
                <span>{fmt(balanceSheet?.totalAssets || 0)}</span>
              </div>
              <p style={{ fontSize: '0.7rem', opacity: 0.5, marginTop: '2rem', textAlign: 'center' }}>* يجب أن يتوازن إجمالي الأصول مع إجمالي الخصوم وحقوق الملكية</p>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal Overlay */}
      {showModal && (
        <div style={modalOverlay} onClick={() => setShowModal(false)} className="fade-in">
          <div className="glass-panel" style={{ ...modalContent, padding: '1.5rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>🔍 {modalTitle}</h2>
              <button onClick={() => setShowModal(false)} className="btn btn-primary" style={{ padding: '0.6rem 1.2rem', background: 'var(--danger-color)' }}>إغلاق</button>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {modalType === "invoices" && (
                <div className="table-responsive">
                  <table style={detailTable}>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>رقم الفاتورة</th>
                      <th>العميل/المورد</th>
                      <th>القيمة</th>
                      <th>الخصم</th>
                      <th>الصافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map(inv => (
                      <tr key={inv.id}>
                        <td>{new Date(inv.date).toLocaleDateString("ar-EG")}</td>
                        <td style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{inv.invoiceNumber}</td>
                        <td>{inv.person?.name}</td>
                        <td>{fmt(inv.totalAmount)}</td>
                        <td style={{ color: 'var(--danger-color)' }}>{fmt(inv.discount)}</td>
                        <td style={{ fontWeight: 'bold' }}>{fmt(inv.netAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}

              {modalType === "expenses" && (
                <div className="table-responsive">
                  <table style={detailTable}>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>التصنيف</th>
                      <th>البيان</th>
                      <th>المبلغ</th>
                      <th>الوسيلة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((exp, idx) => (
                      <tr key={idx}>
                        <td>{new Date(exp.date).toLocaleDateString("ar-EG")}</td>
                        <td>{exp.category}</td>
                        <td>{exp.description}</td>
                        <td style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}>{fmt(exp.amount)}</td>
                        <td>{exp.paymentMethod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}

              {modalType === "cash" && (
                <div className="table-responsive">
                  <table style={detailTable}>
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>الشخص</th>
                      <th>النوع</th>
                      <th>المبلغ (ج.م)</th>
                      <th>ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((pay, idx) => (
                      <tr key={idx}>
                        <td>{new Date(pay.date).toLocaleDateString("ar-EG")}</td>
                        <td>{pay.person?.name || '---'}</td>
                        <td style={{ color: pay.type === 'IN' ? 'var(--success-color)' : 'var(--danger-color)' }}>
                          {pay.type === 'IN' ? 'إيداع / تحصيل' : 'صرف / دفع'}
                        </td>
                        <td style={{ fontWeight: 'bold' }}>{fmt(pay.amount)}</td>
                        <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>{pay.notes}</td>
                      </tr>
                    ))}
                    {/* Explicit Opening Balance Row at the bottom (Starting point) */}
                    {totals?.openingCashBalance! > 0 && (
                      <tr style={{ background: 'rgba(16, 185, 129, 0.05)', borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                        <td>٠١/٠١/٢٠٢٦</td>
                        <td style={{ fontWeight: 'bold' }}>رصيد أول المدة</td>
                        <td style={{ color: 'var(--success-color)' }}>رصيد افتتاحي (نقدية)</td>
                        <td style={{ fontWeight: 'bold' }}>{fmt(totals?.openingCashBalance!)}</td>
                        <td style={{ fontSize: '0.8rem', opacity: 0.7 }}>الخزينة الافتتاحية من الإكسيل</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              )}

              {modalType === "customers" && (
                <div className="table-responsive">
                  <table style={detailTable}>
                  <thead>
                    <tr>
                      <th>اسم العميل</th>
                      <th>الرصيد الافتتاحي</th>
                      <th>إجمالي المبيعات (+)</th>
                      <th>إجمالي التحصيل (-)</th>
                      <th>الرصيد الحالي (=)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalData.map((c, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold' }}>{c.name}</td>
                        <td>{fmt(c.initial)}</td>
                        <td style={{ color: 'var(--success-color)' }}>{fmt(c.sales)}</td>
                        <td style={{ color: 'var(--danger-color)' }}>{fmt(c.paid)}</td>
                        <td style={{ fontWeight: 'bold', background: 'rgba(255,255,255,0.03)' }}>{fmt(c.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              )}

              {modalType === "suppliers" && (
                <div className="table-responsive">
                  <table style={detailTable}>
                    <thead>
                      <tr>
                        <th>اسم المورد</th>
                        <th>الرصيد الافتتاحي</th>
                        <th>إجمالي المشتريات (+)</th>
                        <th>إجمالي المدفوعات (-)</th>
                        <th>الرصيد الحالي (=)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalData.map((s, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 'bold' }}>{s.name}</td>
                          <td>{fmt(s.initial)}</td>
                          <td style={{ color: 'var(--success-color)' }}>{fmt(s.purchases)}</td>
                          <td style={{ color: 'var(--danger-color)' }}>{fmt(s.paid)}</td>
                          <td style={{ fontWeight: 'bold', background: 'rgba(255,255,255,0.03)' }}>{fmt(s.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {modalType === "profit_summary" && (
                <div style={{ padding: '1rem' }}>
                  <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px' }}>
                      <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-color)' }}>كيف يتم حساب هذه القيمة؟</h3>
                      <div style={reportRow}>
                        <span>إجمالي المبيعات</span>
                        <span>{fmt(totals?.totalSales || 0)}</span>
                      </div>
                      <div style={{ ...reportRow, color: 'var(--danger-color)' }}>
                        <span>(-) تكلفة البضاعة المباعة (WAC)</span>
                        <span>{fmt(totals?.totalCOGS || 0)}</span>
                      </div>
                      <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />
                      <div style={{ ...reportRow, fontWeight: 'bold' }}>
                        <span>(=) مجمل الربح</span>
                        <span>{fmt(totals?.grossProfit || 0)}</span>
                      </div>
                      <div style={{ ...reportRow, color: 'var(--danger-color)', marginTop: '1rem' }}>
                        <span>(-) إجمالي المصاريف التشغيلية</span>
                        <span>{fmt(totals?.totalExpenses || 0)}</span>
                      </div>
                      <hr style={{ border: 'none', borderTop: '3px double var(--border-color)', margin: '1rem 0' }} />
                      <div style={{ ...reportRow, fontWeight: 'bold', fontSize: '1.5rem', color: 'var(--success-color)' }}>
                        <span>(=) صافي الربح النهائي</span>
                        <span>{fmt(totals?.netProfit || 0)}</span>
                      </div>
                    </div>
                    <p style={{ opacity: 0.6, fontSize: '0.8rem' }}>* يتم حساب تكلفة البضاعة المباعة بناءً على المتوسط المرجح المتحرك (WAC) لكل صنف بشكل دقيق لضمان عدالة الربح.</p>
                  </div>
                </div>
              )}

              {modalType === "equity_breakdown" && (
                <div style={{ padding: '1rem' }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '12px' }}>
                    <h3 style={{ margin: '0 0 1rem 0', color: 'var(--accent-color)' }}>معادلة الميزانية العمومية</h3>
                    <div style={reportRow}>
                      <span>إجمالي الأصول (نقدية + مخزون + مديونيات)</span>
                      <span>{fmt(balanceSheet?.totalAssets || 0)}</span>
                    </div>
                    <div style={{ ...reportRow, color: 'var(--danger-color)' }}>
                      <span>(-) إجمالي الخصوم (مديونيات الموردين)</span>
                      <span>{fmt(balanceSheet?.payables || 0)}</span>
                    </div>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '1rem 0' }} />
                    <div style={{ ...reportRow, fontWeight: 'bold' }}>
                      <span>(=) صافي قيمة حقوق الملكية</span>
                      <span>{fmt((balanceSheet?.totalAssets || 0) - (balanceSheet?.payables || 0))}</span>
                    </div>
                    
                    <div style={{ marginTop: '2rem' }}>
                      <h4 style={{ opacity: 0.7 }}>مكونات حقوق الملكية:</h4>
                      <div style={reportRow}>
                        <span>الأرباح المرحلة</span>
                        <span>{fmt(balanceSheet?.previousProfit || 0)}</span>
                      </div>
                      <div style={reportRow}>
                        <span>صافي ربح العام الحالي</span>
                        <span>{fmt(balanceSheet?.currentProfit || 0)}</span>
                      </div>
                      <div style={reportRow}>
                        <span>رأس المال المكمل (الفروقات التراكمية)</span>
                        <span>{fmt((balanceSheet?.totalAssets || 0) - (balanceSheet?.payables || 0) - (balanceSheet?.previousProfit || 0) - (balanceSheet?.currentProfit || 0))}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {modalType === "inventory" && (
                <div className="table-responsive">
                  <table style={detailTable}>
                    <thead>
                      <tr>
                        <th>اسم الصنف</th>
                        <th>الكمية المتاحة</th>
                        <th>متوسط التكلفة (WAC)</th>
                        <th>إجمالي القيمة (ج.م)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalData.map((p, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 'bold' }}>{p.name}</td>
                          <td style={{ color: p.qty < 0 ? 'var(--danger-color)' : 'inherit' }}>{p.qty}</td>
                          <td>{fmt(p.wac)}</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--warning-color)' }}>{fmt(p.value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            {modalData.length === 0 && <div style={{ textAlign: 'center', padding: '2rem', opacity: 0.5 }}>لم يتم العثور على بيانات تفصيلية.</div>}
          </div>
        </div>
      )}

      <style jsx>{`
        .clickable-row {
          cursor: pointer;
          transition: all 0.2s;
          border-radius: 6px;
        }
        .clickable-row:hover {
          background: rgba(255,255,255,0.08);
          transform: translateX(-5px);
          padding-right: 10px !important;
        }
        table th {
          background: rgba(255,255,255,0.05);
          padding: 12px;
          text-align: right;
        }
        table td {
          padding: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          text-align: right;
        }
        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const reportRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '0.6rem 0.5rem',
  fontSize: '1rem'
};

const reportRowClickable: React.CSSProperties = {
  ...reportRow,
  cursor: 'pointer',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  margin: '2px 0',
  transition: 'all 0.2s',
  background: 'rgba(255,255,255,0.02)'
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(10px)'
};

const modalContent: React.CSSProperties = {
  width: '90%',
  maxWidth: '900px',
  padding: '2.5rem',
  maxHeight: '85vh',
  overflowY: 'auto'
};

const detailTable: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  marginTop: '1rem',
  fontSize: '0.9rem'
};
