"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface SubDetail {
  date: string;
  label: string;
  amount: number;
  method: string;
  note?: string;
}

interface FlowItem {
  category: string;
  amount: number;
  details: SubDetail[];
}

interface CashFlowData {
  openingCash: number;
  totalIn: number;
  totalOut: number;
  netChange: number;
  closingCash: number;
  inflows: FlowItem[];
  outflows: FlowItem[];
}

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [filterMethod, setFilterMethod] = useState("ALL");

  useEffect(() => {
    fetch('/api/finance/cash-flow')
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="main-content"><p>جاري تحليل التدفقات النقدية...</p></div>;
  if (!data) return <div className="main-content"><p>حدث خطأ أثناء تحميل البيانات.</p></div>;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Get unique payment methods from all details
  const allMethodsSet = new Set<string>();
  if (data) {
    [...data.inflows, ...data.outflows].forEach(cat => {
      cat.details.forEach(d => { if (d.method) allMethodsSet.add(d.method); });
    });
  }
  const methodList = Array.from(allMethodsSet);

  const filterFlowItems = (items: FlowItem[]) => {
    if (filterMethod === "ALL") return items;
    return items.map(cat => ({
      ...cat,
      details: cat.details.filter(d => d.method === filterMethod),
      amount: cat.details.filter(d => d.method === filterMethod).reduce((s, d) => s + d.amount, 0)
    })).filter(cat => cat.amount > 0);
  };

  const filteredInflows = data ? filterFlowItems(data.inflows) : [];
  const filteredOutflows = data ? filterFlowItems(data.outflows) : [];
  const filteredTotalIn = filteredInflows.reduce((s, i) => s + i.amount, 0);
  const filteredTotalOut = filteredOutflows.reduce((s, i) => s + i.amount, 0);

  const renderBarChart = (items: FlowItem[], title: string, color: string) => {
    const max = Math.max(...items.map(i => i.amount), 1);
    return (
      <div className="glass-panel" style={{ flex: 1, minWidth: '350px' }}>
        <h3 style={{ marginBottom: '1.5rem', color }}>{title}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>(اضغط على أي بند لإظهار التفاصيل 📊)</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          {items.map((item, idx) => (
            <div key={idx} 
                 onClick={() => setExpandedCategory(expandedCategory === item.category ? null : item.category)}
                 style={{ cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.9rem' }}>
                <span style={{ fontWeight: expandedCategory === item.category ? 'bold' : 'normal' }}>{item.category}</span>
                <span style={{ fontWeight: 'bold' }}>{fmt(item.amount)} ج.م</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.05)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${(item.amount / max) * 100}%`, 
                  height: '100%', 
                  background: color,
                  opacity: expandedCategory === item.category ? 1 : 0.7,
                  transition: 'width 1s ease-out'
                }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const currentDetails = [...filteredInflows, ...filteredOutflows].find(i => i.category === expandedCategory)?.details;

  const renderDrillDown = () => {
    if (!expandedCategory || !currentDetails) return null;

    // Analysis: Group by label
    const byLabel: Record<string, number> = {};
    currentDetails.forEach(d => {
      byLabel[d.label] = (byLabel[d.label] || 0) + d.amount;
    });
    const sortedLabels = Object.entries(byLabel).sort((a,b) => b[1] - a[1]);

    return (
      <div className="glass-panel animate-in" id="drilldown-section" style={{ marginTop: '2rem', borderTop: '4px solid var(--accent-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="gradient-text">تحليل تفصيلي: {expandedCategory}</h2>
          <button className="btn btn-secondary" onClick={() => setExpandedCategory(null)}>إغلاق التحليل ✕</button>
        </div>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Top Contributors */}
          <div style={{ flex: 1, minWidth: '300px' }}>
             <h4 style={{ marginBottom: '1rem', opacity: 0.8 }}>الجهات الأكثر مساهمة في هذا البند:</h4>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               {sortedLabels.slice(0, 10).map(([name, val], idx) => (
                 <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    <span>{name}</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{fmt(val)} ج.م</span>
                 </div>
               ))}
               {sortedLabels.length > 10 && <p style={{ fontSize: '0.8rem', opacity: 0.5 }}>... وأخرى</p>}
             </div>
          </div>

          {/* List of Transactions */}
          <div style={{ flex: 2, minWidth: '400px' }}>
             <h4 style={{ marginBottom: '1rem', opacity: 0.8 }}>سجل العمليات (Chronological):</h4>
             <table className="table" style={{ fontSize: '0.85rem' }}>
               <thead>
                 <tr>
                   <th>التاريخ</th>
                   <th>الجهة</th>
                   <th>الطريقة</th>
                   <th>المبلغ</th>
                   <th>ملاحظات</th>
                 </tr>
               </thead>
               <tbody>
                 {currentDetails.map((d, i) => (
                   <tr key={i}>
                     <td>{new Date(d.date).toLocaleDateString('ar-EG')}</td>
                     <td>{d.label}</td>
                     <td>{d.method}</td>
                     <td style={{ fontWeight: 'bold' }}>{fmt(d.amount)}</td>
                     <td style={{ fontSize: '0.75rem', opacity: 0.7 }}>{d.note || '-'}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="gradient-text">تحليل النقدية والسيولة</h1>
          <p style={{ color: 'var(--text-secondary)' }}>تتبع حركة الأموال الداخلة والخارجة لعام 2026</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <select 
            value={filterMethod} 
            onChange={e => setFilterMethod(e.target.value)} 
            className="input-field" 
            style={{ width: '200px', margin: 0, padding: '0.4rem' }}
          >
            <option value="ALL">كل طرق الدفع</option>
            {methodList.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <Link href="/finance" className="btn">العودة للمركز المالي</Link>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--accent-color)' }}>
          <div className="stat-label">نقدية افتتاحية (2025)</div>
          <div className="stat-value" style={{ color: 'var(--accent-color)' }}>{filterMethod === 'ALL' ? fmt(data.openingCash) : '-'}</div>
          {filterMethod !== 'ALL' && <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>يظهر في "الكل" فقط</div>}
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--success-color)' }}>
          <div className="stat-label">المقبوضات ({filterMethod === 'ALL' ? 'إجمالي' : filterMethod}) (+)</div>
          <div className="stat-value" style={{ color: 'var(--success-color)' }}>{fmt(filteredTotalIn)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--danger-color)' }}>
          <div className="stat-label">المدفوعات ({filterMethod === 'ALL' ? 'إجمالي' : filterMethod}) (-)</div>
          <div className="stat-value" style={{ color: 'var(--danger-color)' }}>{fmt(filteredTotalOut)}</div>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--accent-color)' }}>
          <div className="stat-label">صافي الحركة للفترة</div>
          <div className="stat-value" style={{ textDecoration: 'underline' }}>{fmt(filteredTotalIn - filteredTotalOut)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {renderBarChart(filteredInflows, `مصادر السيولة (${filterMethod === 'ALL' ? 'إجمالي' : filterMethod})`, "var(--success-color)")}
        {renderBarChart(filteredOutflows, `أوجه الصرف (${filterMethod === 'ALL' ? 'إجمالي' : filterMethod})`, "var(--danger-color)")}
      </div>

      {renderDrillDown()}

      <div className="glass-panel" style={{ marginTop: '2rem', textAlign: 'center', background: 'rgba(34, 197, 94, 0.05)' }}>
        <h3>مؤشر كفاءة التدفق النقدي</h3>
        <p style={{ fontSize: '1.2rem', marginTop: '1rem' }}>
            صافي التدفق النقدي للفترة الحالية هو: 
            <span style={{ fontWeight: 'bold', color: data.netChange >= 0 ? 'var(--success-color)' : 'var(--danger-color)', margin: '0 0.5rem' }}>
                {fmt(data.netChange)} ج.م
            </span>
            {data.netChange >= 0 ? "(نمو في السيولة ✅)" : "(سحب من السيولة الاحتياطية ⚠️)"}
        </p>
      </div>

      <div className="glass-panel animate-in" style={{ marginTop: '2rem' }}>
        <h3 className="gradient-text" style={{ marginBottom: '1.5rem' }}>دفتر حركة الخزينة الشامل (Ledger)</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>تسلسل جميع العمليات التي أثرت على السيولة منذ رصيد البداية وحتى الآن.</p>
        
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الطريقة</th>
                <th>ونوع الحركة</th>
                <th>البيان / الشخص</th>
                <th>داخل (+)</th>
                <th>خارج (-)</th>
                <th>الرصيد التراكمي</th>
                <th>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                 let allMoves: { date: string, label: string, amount: number, note?: string, category: string, type: 'IN' | 'OUT' }[] = [];
                data.inflows.forEach(inf => {
                   inf.details.forEach(d => allMoves.push({ ...d, type: 'IN', category: inf.category }));
                 });
                 data.outflows.forEach(outf => {
                   outf.details.forEach(d => allMoves.push({ ...d, type: 'OUT', category: outf.category }));
                 });

                 // Apply filtering
                 if (filterMethod !== "ALL") {
                   allMoves = allMoves.filter(m => m.method === filterMethod);
                 }

                 allMoves.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
               
                 let runBal = filterMethod === "ALL" ? data.openingCash : 0;
                 const ledger = allMoves.map(m => {
                   runBal += (m.type === 'IN' ? m.amount : -m.amount);
                   return { ...m, balance: runBal };
                 });
                 ledger.reverse();

                 return (
                   <>
                     {filterMethod === 'ALL' && (
                       <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                          <td colSpan={6} style={{ fontWeight: 'bold', textAlign: 'left', color: 'var(--text-secondary)' }}>الرصيد الافتتاحي (2025):</td>
                          <td style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{fmt(data.openingCash)} ج.م</td>
                          <td></td>
                       </tr>
                     )}
                     {ledger.map((m, i) => (
                       <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                         <td>{new Date(m.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                         <td style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{m.method}</td>
                         <td>
                            <span style={{ padding: '2px 6px', borderRadius: '4px', background: m.type === 'IN' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: m.type === 'IN' ? 'var(--success-color)' : 'var(--danger-color)', fontSize: '0.75rem' }}>
                               {m.category.split(' ')[0]}
                            </span>
                         </td>
                         <td>{m.label}</td>
                         <td style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>{m.type === 'IN' ? fmt(m.amount) : '-'}</td>
                         <td style={{ color: 'var(--danger-color)', fontWeight: 'bold' }}>{m.type === 'OUT' ? fmt(m.amount) : '-'}</td>
                         <td style={{ fontWeight: 'bold' }}>{fmt(m.balance)} ج.م</td>
                         <td style={{ color: 'var(--text-secondary)' }}>{m.note || '-'}</td>
                       </tr>
                     ))}
                   </>
                 );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
