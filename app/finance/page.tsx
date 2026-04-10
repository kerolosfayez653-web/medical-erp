"use client";
import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface BalanceYear {
  assets: { 
    inventory: number; 
    accountsReceivable: number; 
    cash: number;
    total: number;
    details?: {
      inventory: any[];
      receivables: any[];
      cashSummary: any;
    };
  };
  liabilities: { accountsPayable: number; otherLiabilities: number; totalLiabilities: number };
  equity: { openingCapital: number; netProfit?: number; drawings?: number; retainedEarnings: number; total: number };
}

interface FinanceData {
  year2025: BalanceYear;
  year2026: BalanceYear;
}

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<{ title: string; type: 'INV' | 'REC' | 'CSH' } | null>(null);

  useEffect(() => {
    fetch('/api/finance/balance-sheet')
      .then(r => r.json())
      .then(json => {
        if (json.success) setData(json.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="main-content"><p>جاري تحميل القوائم المالية التحليلية...</p></div>;
  if (!data) return <div className="main-content"><p>حدث خطأ أثناء تحميل البيانات.</p></div>;

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const renderSheet = (year: string, bs: BalanceYear, isCurrent: boolean) => (
    <div className="glass-panel" style={{ flex: 1, minWidth: '450px', borderTop: isCurrent ? '4px solid var(--accent-color)' : '4px solid var(--text-secondary)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: isCurrent ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
        قائمة المركز المالي - {year}
      </h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Assets Section */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--success-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
            <h4 style={{ margin: 0 }}>الأصول (Assets)</h4>
            {isCurrent && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>💡 اضغط للتحليل</span>}
          </div>
          
          <div 
            onClick={() => isCurrent && setActiveModal({ title: 'تحليل المخزون السلعي التفصيلي', type: 'INV' })}
            className={isCurrent ? 'report-row-clickable' : ''}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 0.5rem', cursor: isCurrent ? 'pointer' : 'default', borderRadius: '8px', transition: 'all 0.2s' }}
          >
            <span>📦 مخزون البضاعة (Inventory)</span>
            <span style={{ fontWeight: 'bold' }}>{fmt(bs.assets.inventory)}</span>
          </div>
          
          <div 
            onClick={() => isCurrent && setActiveModal({ title: 'تحليل مديونيات العملاء (Receivables)', type: 'REC' })}
            className={isCurrent ? 'report-row-clickable' : ''}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 0.5rem', cursor: isCurrent ? 'pointer' : 'default', borderRadius: '8px', transition: 'all 0.2s' }}
          >
            <span>👥 مديونيات العملاء (Receivables)</span>
            <span style={{ fontWeight: 'bold' }}>{fmt(bs.assets.accountsReceivable)}</span>
          </div>
          
          <div 
            onClick={() => isCurrent && setActiveModal({ title: 'تحليل حركة السيولة والنقدية', type: 'CSH' })}
            className={isCurrent ? 'report-row-clickable' : ''}
            style={{ display: 'flex', justifyContent: 'space-between', padding: '0.85rem 0.5rem', cursor: isCurrent ? 'pointer' : 'default', borderRadius: '8px', transition: 'all 0.2s' }}
          >
            <span>💰 نقدية الصندوق والبنوك (Cash)</span>
            <span style={{ fontWeight: 'bold' }}>{fmt(bs.assets.cash || 0)}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.2rem 0.5rem', fontWeight: 'bold', borderTop: '2px double var(--border-color)', marginTop: '0.5rem' }}>
            <span>إجمالي الأصول</span>
            <span style={{ color: 'var(--success-color)', fontSize: '1.4rem' }}>{fmt(bs.assets.total)} ج.م</span>
          </div>
        </section>

        {/* Liabilities & Equity Section */}
        <section>
          <h4 style={{ borderBottom: '2px solid var(--danger-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>الخصوم وحقوق الملكية (Liabilities & Equity)</h4>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0.5rem' }}>
            <span>🏳️ مديونيات الموردين (Payables)</span>
            <span style={{ fontWeight: 'bold', color: bs.liabilities.accountsPayable > 0 ? 'var(--danger-color)' : 'inherit' }}>{fmt(bs.liabilities.accountsPayable)}</span>
          </div>
          {bs.liabilities.otherLiabilities > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0.5rem' }}>
              <span> التزامات قانونية أخرى</span>
              <span>{fmt(bs.liabilities.otherLiabilities)}</span>
            </div>
          )}
          
          <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <h5 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>حقوق الملكية (Owner's Equity)</h5>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '1rem' }}>
              <span>رأس المال الابتدائي (Capital)</span>
              <span>{fmt(bs.equity.openingCapital)}</span>
            </div>
            {bs.equity.netProfit !== undefined && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '1rem' }}>
                  <span>صافي أرباح الفترة الحالية</span>
                  <span style={{ color: 'var(--success-color)', fontWeight: 'bold' }}>+ {fmt(bs.equity.netProfit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontSize: '1rem', color: 'var(--danger-color)' }}>
                  <span>(-) المسحوبات الشخصية</span>
                  <span style={{ fontWeight: 'bold' }}>- {fmt(bs.equity.drawings || 0)}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 0', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '0.5rem', fontSize: '1.1rem' }}>
              <span>صافي حقوق الملكية</span>
              <span className="gradient-text">{fmt(bs.equity.retainedEarnings)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.2rem 0.5rem', fontWeight: 'bold', borderTop: '2px double var(--border-color)', marginTop: '1.5rem' }}>
            <span>إجمالي الخصوم وحقوق الملكية</span>
            <span style={{ color: 'var(--accent-color)', fontSize: '1.4rem' }}>{fmt(bs.assets.total)} ج.م</span>
          </div>
        </section>
      </div>

      <style jsx>{`
        .report-row-clickable:hover {
          background: rgba(255,255,255,0.08) !important;
          transform: translateX(-5px);
        }
      `}</style>
    </div>
  );

  const Modal = () => {
    if (!activeModal || !data) return null;
    const details = data.year2026.assets.details;
    if (!details) return null;

    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(10px)' }}>
        <div className="glass-panel" style={{ maxWidth: '850px', width: '100%', maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--accent-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--accent-color)', paddingBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>🔍 {activeModal.title} (2026)</h2>
            <button onClick={() => setActiveModal(null)} className="btn" style={{ background: 'var(--danger-color)', padding: '0.5rem 1rem' }}>إغلاق ✕</button>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, paddingRight: '5px' }}>
            {activeModal.type === 'INV' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '15px' }}>اسم الصنف</th>
                    <th style={{ padding: '15px', textAlign: 'center' }}>الكمية المتاحة</th>
                    <th style={{ padding: '15px', textAlign: 'center' }}>القيمة (WAC)</th>
                  </tr>
                </thead>
                <tbody>
                  {details.inventory.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px' }}>{item.name}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{item.qty.toFixed(2)} {item.unit}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: 'var(--warning-color)' }}>{fmt(item.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeModal.type === 'REC' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.05)', position: 'sticky', top: 0 }}>
                    <th style={{ padding: '15px' }}>اسم العميل</th>
                    <th style={{ padding: '15px', textAlign: 'center' }}>صافي المديونية المستحقة</th>
                  </tr>
                </thead>
                <tbody>
                  {details.receivables.length > 0 ? details.receivables.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{p.name}</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: 'var(--danger-color)' }}>{fmt(p.balance)} ج.م</td>
                    </tr>
                  )) : <tr><td colSpan={2} style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>لا توجد مديونيات معلقة حالياً.</td></tr>}
                </tbody>
              </table>
            )}

            {activeModal.type === 'CSH' && (
              <div style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.2rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>رصيد افتتاحي (1/1/2026)</span>
                    <span style={{ fontWeight: 'bold' }}>{fmt(details.cashSummary.opening)} ج.م</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.2rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '10px', color: 'var(--success-color)', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
                    <span>+ إجمالي التحصيلات والمقبوضات</span>
                    <span style={{ fontWeight: 'bold' }}>{fmt(details.cashSummary.inflows)} ج.م</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1.2rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', color: 'var(--danger-color)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                    <span>- إجمالي المدفوعات والمصاريف</span>
                    <span style={{ fontWeight: 'bold' }}>{fmt(details.cashSummary.outflows)} ج.م</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2rem 1.2rem', borderTop: '3px double var(--border-color)', fontSize: '1.8rem', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
                    <span>الرصيد النقدي الحالي</span>
                    <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{fmt(data.year2026.assets.cash)} ج.م</span>
                  </div>
                </div>
                <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
                   <Link href="/reports" className="btn btn-primary" style={{ display: 'inline-block', padding: '1rem 2rem', fontSize: '1.1rem' }}>عرض سجل الحركة التفصيلي 📊</Link>
                </div>
              </div>
            )}
          </div>
          
          <div style={{ marginTop: '1.5rem', textAlign: 'center', opacity: 0.4, fontSize: '0.8rem', padding: '10px' }}>
            * هذه القوائم محدثة لحظياً بناءً على آخر القيود المسجلة
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="main-content" style={{ direction: 'rtl', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem', borderRight: '8px solid var(--accent-color)', paddingRight: '1.5rem' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem', margin: 0 }}>المركز المالي والقوائم الختامية</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '10px 0 0 0' }}>مقارنة تحليلية بين الافتتاحية والنشاط السنوي المتراكم</p>
        </div>
        <div className="badge" style={{ padding: '0.8rem 1.5rem', background: 'var(--accent-color)', fontSize: '1rem' }}>نظام المحاسبة المتطور</div>
      </div>

      <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {renderSheet("ميزانية 2025 (افتتاحية)", data.year2025, false)}
        {renderSheet("ميزانية 2026 (تراكمية)", data.year2026, true)}
      </div>

      <div className="glass-panel" style={{ marginTop: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(59, 130, 246, 0.08)', padding: '2.5rem', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
        <div>
          <h3 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📈 تحليل النمو والتدفقات</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>تقييم صافي حقوق الملكية وقدرة النشاط على توليد أرباح بعد المسحوبات الشخصية.</p>
        </div>
        <div style={{ display: 'flex', gap: '3rem', textAlign: 'left' }}>
           <div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>معدل نمو الأصول</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--success-color)' }}>+{(((data.year2026.assets.total / data.year2025.assets.total) - 1) * 100).toFixed(1)}%</div>
           </div>
           <div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>صافي ربح النشاط</div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{fmt(data.year2026.equity.netProfit || 0)}</div>
           </div>
        </div>
      </div>

      <Modal />
    </div>
  );
}

