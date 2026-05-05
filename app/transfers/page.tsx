"use client";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";

interface Transfer {
  id: number;
  amount: number;
  fromMethod: string;
  toMethod: string;
  date: string;
  notes: string;
}

export default function TransfersPage() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [amount, setAmount] = useState("");
  const [fromMethod, setFromMethod] = useState("كاش");
  const [toMethod, setToMethod] = useState("انستاباي");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [notes, setNotes] = useState("");

  const methods = ['كاش', 'انستاباي', 'فودافون كاش', 'اكسيس باي', 'شيك', 'تحويل بنكي'];

  const fetchTransfers = async () => {
    try {
      const r = await fetch('/api/transfers');
      const data = await r.json();
      setTransfers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransfers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return alert("الرجاء إدخال مبلغ صحيح");
    if (fromMethod === toMethod) return alert("لا يمكن التحويل لنفس الحساب");

    try {
      const r = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, fromMethod, toMethod, date, notes })
      });
      const data = await r.json();
      if (data.success) {
        setAmount("");
        setNotes("");
        fetchTransfers();
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء حفظ التحويل");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا التحويل؟")) return;
    try {
      const r = await fetch(`/api/transfers?id=${id}`, { method: 'DELETE' });
      const data = await r.json();
      if (data.success) {
        fetchTransfers();
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const exportExcel = () => {
    const rows = transfers.map(t => ({
      'رقم التحويل': `TR-${t.id}`,
      'التاريخ': new Date(t.date).toLocaleDateString('ar-EG'),
      'المبلغ (ج.م)': t.amount,
      'من حساب': t.fromMethod,
      'إلى حساب': t.toMethod,
      'الملاحظات': t.notes || ''
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, ws, 'التحويلات الداخلية');
    XLSX.writeFile(wb, `التحويلات_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.xlsx`);
  };

  if (loading) return (
    <div style={{ padding: '5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div className="loader" style={{ marginBottom: '1rem' }}></div>
      <p>⏳ جاري تحميل التحويلات...</p>
    </div>
  );

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem' }}>
      
      <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderRight: '5px solid var(--accent-color)' }}>
        <div>
          <h1 className="gradient-text" style={{ margin: 0, fontSize: '1.8rem' }}>🔄 التحويلات الداخلية</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '0.9rem' }}>تحويل السيولة بين الخزينة والحسابات البنكية</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={exportExcel} className="btn" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>📥</span> تصدير التحويلات
          </button>
          <Link href="/" className="btn btn-secondary">العودة للرئيسية</Link>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-start' }}>
        
        {/* Form Column */}
        <div className="glass-panel" style={{ flex: '1 1 300px', position: 'sticky', top: '2rem' }}>
          <h3 style={{ marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>➕ تحويل جديد</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>التاريخ</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="form-input" />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>المبلغ (ج.م)</label>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className="form-input" placeholder="0.00" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>من حساب (خصم)</label>
                <select value={fromMethod} onChange={e => setFromMethod(e.target.value)} className="form-input">
                  {methods.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>إلى حساب (إيداع)</label>
                <select value={toMethod} onChange={e => setToMethod(e.target.value)} className="form-input">
                  {methods.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>ملاحظات (اختياري)</label>
              <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className="form-input" placeholder="سبب التحويل..." />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', padding: '0.8rem', fontSize: '1.1rem' }}>
              تسجيل التحويل
            </button>
          </form>
        </div>

        {/* Table Column */}
        <div className="glass-panel" style={{ flex: '2 1 500px', padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table" style={{ margin: 0 }}>
              <thead style={{ background: 'var(--bg-secondary)' }}>
                <tr>
                  <th>التاريخ</th>
                  <th>من حساب</th>
                  <th>إلى حساب</th>
                  <th>المبلغ (ج.م)</th>
                  <th>ملاحظات</th>
                  <th style={{ width: '50px' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {transfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>لا توجد تحويلات مسجلة</td>
                  </tr>
                ) : (
                  transfers.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontSize: '0.85rem' }}>{new Date(t.date).toLocaleDateString('ar-EG')}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--danger-color)' }}>{t.fromMethod}</td>
                      <td style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>{t.toMethod}</td>
                      <td style={{ fontWeight: 'bold' }}>{t.amount.toLocaleString()}</td>
                      <td style={{ fontSize: '0.8rem', opacity: 0.8 }}>{t.notes || '---'}</td>
                      <td>
                        <button onClick={() => handleDelete(t.id)} className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: 'transparent', color: 'var(--danger-color)', border: '1px solid var(--danger-color)' }}>
                          حذف
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
