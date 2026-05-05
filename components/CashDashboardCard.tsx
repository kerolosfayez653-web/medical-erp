"use client";
import React, { useState } from "react";
import * as XLSX from "xlsx";

export default function CashDashboardCard({ cashAccounts, totalAvailableCash }: { cashAccounts: Record<string, number>, totalAvailableCash: number }) {
  const [showModal, setShowModal] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  const openLedger = async (method: string) => {
    setSelectedMethod(method);
    setLoadingLedger(true);
    try {
      const res = await fetch(`/api/cash-ledger?method=${encodeURIComponent(method)}`);
      const data = await res.json();
      if (data.success) {
        setLedgerData(data.ledger);
      } else {
        alert("خطأ في جلب السجل");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLedger(false);
    }
  };

  const closeLedger = () => {
    setSelectedMethod(null);
    setLedgerData([]);
  };

  const exportCash = () => {
    const rows = Object.entries(cashAccounts).map(([method, amount]) => ({
      'الحساب': method,
      'الرصيد المتاح (ج.م)': amount
    }));
    rows.push({ 'الحساب': 'إجمالي النقدية', 'الرصيد المتاح (ج.م)': totalAvailableCash });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'الأرصدة النقدية');
    XLSX.writeFile(wb, `الأرصدة_النقدية_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`);
  };

  return (
    <>
      <div onClick={() => setShowModal(true)} className="stat-card clickable-card" style={{ borderTop: '4px solid #10b981', cursor: 'pointer', background: 'rgba(16, 185, 129, 0.08)' }}>
        <span className="stat-title" style={{ fontWeight: 'bold' }}>النقدية المتاحة (سيولة) 💵</span>
        <span className="stat-value" style={{ color: '#10b981' }}>{totalAvailableCash.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ج.م</span>
        <small style={{ color: 'var(--text-secondary)' }}>اضغط لعرض تفاصيل الحسابات البنكية والخزينة</small>
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowModal(false)}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: selectedMethod ? '800px' : '500px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            
            {!selectedMethod ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>💵 تفاصيل الأرصدة النقدية</h2>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={exportCash} className="btn" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981' }}>📥 Excel</button>
                    <button onClick={() => setShowModal(false)} className="btn btn-primary" style={{ background: 'var(--danger-color)' }}>إغلاق</button>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <th style={{ padding: '12px', borderBottom: '2px solid var(--border-color)' }}>الحساب / الخزينة</th>
                      <th style={{ padding: '12px', borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>الرصيد المتاح (ج.م)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(cashAccounts).sort((a,b) => b[1]-a[1]).map(([method, amount]) => (
                      <tr 
                        key={method} 
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} 
                        onClick={() => openLedger(method)}
                        title="اضغط لعرض تفاصيل الحركات"
                      >
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>
                          {method} <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginRight: '10px' }}>📄 عرض السجل</span>
                        </td>
                        <td style={{ padding: '12px', textAlign: 'left', color: amount < 0 ? 'var(--danger-color)' : 'var(--success-color)' }}>
                          {amount.toLocaleString('en-US')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ padding: '15px 12px', fontWeight: 'bold', fontSize: '1.2rem', color: '#10b981' }}>إجمالي السيولة</td>
                      <td style={{ padding: '15px 12px', textAlign: 'left', fontWeight: 'bold', fontSize: '1.2rem', color: '#10b981' }}>
                        {totalAvailableCash.toLocaleString('en-US')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                  <h2 style={{ margin: 0 }}>📄 سجل حركات: {selectedMethod}</h2>
                  <button onClick={closeLedger} className="btn btn-primary" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>⬅️ رجوع للخزن</button>
                </div>

                {loadingLedger ? (
                  <div style={{ padding: '2rem', textAlign: 'center' }}>⏳ جاري تحميل السجل...</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table" style={{ margin: 0 }}>
                      <thead style={{ background: 'var(--bg-secondary)' }}>
                        <tr>
                          <th>التاريخ</th>
                          <th>البيان</th>
                          <th>وارد (+)</th>
                          <th>منصرف (-)</th>
                          <th>الرصيد التراكمي</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledgerData.length === 0 ? (
                          <tr><td colSpan={5} style={{ textAlign: 'center', padding: '1rem' }}>لا توجد حركات مسجلة</td></tr>
                        ) : (
                          ledgerData.map((row, idx) => (
                            <tr key={idx} style={{ background: row.type === 'OPENING' ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                              <td style={{ fontSize: '0.85rem' }}>{new Date(row.date).toLocaleDateString('ar-EG')}</td>
                              <td>
                                <div style={{ fontWeight: 'bold' }}>{row.description}</div>
                                {row.notes && <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{row.notes}</div>}
                              </td>
                              <td style={{ color: 'var(--success-color)' }}>{row.debit > 0 ? row.debit.toLocaleString() : '-'}</td>
                              <td style={{ color: 'var(--danger-color)' }}>{row.credit > 0 ? row.credit.toLocaleString() : '-'}</td>
                              <td style={{ fontWeight: 'bold' }}>{row.balance.toLocaleString()}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
