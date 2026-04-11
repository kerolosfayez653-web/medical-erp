"use client";
import { useState, useEffect, useRef } from "react";

interface Payment {
  id: number;
  personId: number;
  person: { name: string; type: string };
  amount: number;
  type: string;
  method: string;
  notes: string;
  date: string;
  invoice?: { invoiceNumber: string };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "IN" | "OUT">("ALL");
  
  // Edit State
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  
  // Print Ref
  const printRef = useRef<HTMLDivElement>(null);

  const fetchPayments = () => {
    setLoading(true);
    fetch("/api/payments")
      .then(r => r.json())
      .then(d => {
        if (d.success) setPayments(d.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPayments(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا السند؟ سيتم عكس الأثر المالي في مديونية العميل آلياً.")) return;
    try {
      const r = await fetch(`/api/payments?id=${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.success) {
        setPayments(prev => prev.filter(p => p.id !== id));
      } else {
        alert("خطأ: " + d.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    try {
      const r = await fetch("/api/payments", {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPayment)
      });
      const d = await r.json();
      if (d.success) {
        setEditingPayment(null);
        fetchPayments();
      } else {
        alert("خطأ: " + d.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = (payment: Payment) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl">
        <head>
          <title>سند ${payment.type === 'IN' ? 'قبض' : 'صرف'} - ${payment.id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; }
            .voucher { border: 2px solid #000; padding: 30px; border-radius: 15px; position: relative; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 1.2rem; }
            .footer { margin-top: 50px; display: flex; justify-content: space-between; }
            .stamp { width: 150px; height: 150px; border: 2px dashed #ccc; display: flex; align-items: center; justify-content: center; opacity: 0.5; font-size: 0.8rem; }
            .amount-box { background: #f0f0f0; padding: 10px 20px; border-radius: 8px; font-weight: bold; font-size: 1.5rem; }
          </style>
        </head>
        <body>
          <div class="voucher">
            <div class="header">
              <h1>Antigravity ERP - سند ${payment.type === 'IN' ? 'قبض نقدية' : 'صرف نقدية'}</h1>
              <p>تاريخ السند: ${new Date(payment.date).toLocaleDateString("ar-EG")}</p>
            </div>
            <div class="row">
              <span>رقم السند: <strong>VOU-${payment.id}</strong></span>
              <span>طريقة الدفع: <strong>${payment.method}</strong></span>
            </div>
            <div class="row" style="margin-top: 20px;">
              <span>${payment.type === 'IN' ? 'استلمنا من السيد' : 'تم صرفه للسيد'}:</span>
              <span style="font-weight: bold; font-size: 1.4rem;">${payment.person.name}</span>
            </div>
            <div class="row">
              <span>مبلغ وقدره:</span>
              <div class="amount-box">${payment.amount.toLocaleString()} ج.م</div>
            </div>
            <div class="row" style="margin-top: 20px;">
              <span>وذلك مقابل:</span>
              <span style="border-bottom: 1px dotted #000; flex: 1; margin-right: 15px;">${payment.notes || '---'}</span>
            </div>
            ${payment.invoice ? `
            <div class="row" style="font-size: 0.9rem; opacity: 0.7;">
              <span>مرتبط بفاتورة رقم: ${payment.invoice.invoiceNumber}</span>
            </div>
            ` : ''}
            <div class="footer">
              <div>
                <p>توقيع المستلم:</p>
                <p>..........................</p>
              </div>
              <div class="stamp">ختم الشركة</div>
              <div>
                <p>توقيع المحاسب:</p>
                <p>..........................</p>
              </div>
            </div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filtered = payments.filter(p => {
    const matchesSearch = p.person.name.toLowerCase().includes(search.toLowerCase()) || (p.notes || "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filterType === "ALL" || p.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    collections: payments.filter(p => p.type === 'IN').reduce((s, p) => s + p.amount, 0),
    payments: payments.filter(p => p.type === 'OUT').reduce((s, p) => s + p.amount, 0)
  };

  if (loading) return (
    <div style={{ padding: '5rem', textAlign: 'center', background: 'var(--bg-color)', minHeight: '100vh', color: 'var(--text-secondary)' }}>
      <div className="loader" style={{ marginBottom: '1rem' }}></div>
      <p style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>⏳ جاري تحميل سجل التحصيلات والسندات...</p>
    </div>
  );

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Header & Stats */}
      <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="gradient-text" style={{ margin: 0, fontSize: '1.8rem' }}>💰 سجل التحصيلات والسندات المالية</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0' }}>إدارة سندات القبض والصرف وعكس الأثر المالي</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>إجمالي المقبوضات (IN)</div>
            <div style={{ fontWeight: 'bold', color: 'var(--success-color)' }}>{fmt(stats.collections)} ج.م</div>
          </div>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>إجمالي المدفوعات (OUT)</div>
            <div style={{ fontWeight: 'bold', color: 'var(--danger-color)' }}>{fmt(stats.payments)} ج.م</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1.5rem' }}>
        <input 
          type="text" 
          placeholder="🔍 ابحث بالاسم أو الملاحظات..." 
          className="input-field"
          style={{ flex: 1, minWidth: '250px' }}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={() => setFilterType("ALL")} className={`btn ${filterType === 'ALL' ? 'btn-primary' : ''}`} style={{ padding: '0.6rem 1rem' }}>الكل</button>
          <button onClick={() => setFilterType("IN")} className={`btn ${filterType === 'IN' ? 'btn-primary' : ''}`} style={{ padding: '0.6rem 1rem' }}>سندات القبض (عملاء)</button>
          <button onClick={() => setFilterType("OUT")} className={`btn ${filterType === 'OUT' ? 'btn-primary' : ''}`} style={{ padding: '0.6rem 1rem' }}>سندات الصرف (موردين)</button>
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
          <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
            <tr>
              <th style={thStyle}>التاريخ</th>
              <th style={thStyle}>الاسم</th>
              <th style={thStyle}>النوع</th>
              <th style={thStyle}>المبلغ</th>
              <th style={thStyle}>الوسيلة</th>
              <th style={thStyle}>ملاحظات</th>
              <th style={thStyle}>العمليات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                <td style={tdStyle}>{new Date(p.date).toLocaleDateString("ar-EG")}</td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{p.person.name}</td>
                <td style={tdStyle}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    fontSize: '0.8rem',
                    background: p.type === 'IN' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: p.type === 'IN' ? 'var(--success-color)' : 'var(--danger-color)'
                  }}>
                    {p.type === 'IN' ? 'قبض' : 'صرف'}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 'bold' }}>{fmt(p.amount)} ج.م</td>
                <td style={tdStyle}>{p.method}</td>
                <td style={{ ...tdStyle, fontSize: '0.85rem', opacity: 0.7 }}>{p.notes || '---'}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => handlePrint(p)} className="btn" title="طباعة السند" style={{ padding: '8px', background: 'rgba(255,255,255,0.05)' }}>🖨️</button>
                    <button onClick={() => setEditingPayment(p)} className="btn" title="تعديل" style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success-color)' }}>✏️</button>
                    <button onClick={() => handleDelete(p.id)} className="btn" title="حذف" style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)' }}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>لا توجد تحصيلات مطابقة للبحث.</div>}
      </div>

      {/* Edit Modal */}
      {editingPayment && (
        <div style={modalOverlay}>
          <div className="glass-panel" style={{ width: '90%', maxWidth: '500px', padding: '2rem' }}>
            <h2 style={{ marginBottom: '1.5rem', textAlign: 'right' }}>تعديل سند مالي</h2>
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>المبلغ (ج.م)</label>
                <input 
                  type="number" 
                  step="any"
                  className="input-field" 
                  value={editingPayment.amount}
                  onChange={e => setEditingPayment({...editingPayment, amount: parseFloat(e.target.value)})}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>التاريخ</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={editingPayment.date.split('T')[0]}
                    onChange={e => setEditingPayment({...editingPayment, date: e.target.value})}
                  />
                </div>
                <div>
                  <label style={labelStyle}>الوسيلة</label>
                  <select 
                    className="input-field"
                    value={editingPayment.method}
                    onChange={e => setEditingPayment({...editingPayment, method: e.target.value})}
                  >
                    <option value="كاش">كاش</option>
                    <option value="انستاباي">انستاباي</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="بنك">بنك</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>ملاحظات</label>
                <textarea 
                  className="input-field" 
                  style={{ minHeight: '80px' }}
                  value={editingPayment.notes}
                  onChange={e => setEditingPayment({...editingPayment, notes: e.target.value})}
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>حفظ التغييرات</button>
                <button type="button" onClick={() => setEditingPayment(null)} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        th, td { padding: 16px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        tr:hover { background: rgba(255,255,255,0.02); }
      `}</style>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'right', padding: '16px', color: 'var(--text-secondary)', fontSize: '0.85rem' };
const tdStyle: React.CSSProperties = { padding: '16px', fontSize: '0.95rem' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', opacity: 0.7, marginBottom: '5px', textAlign: 'right' };
const modalOverlay: React.CSSProperties = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, backdropFilter: 'blur(10px)'
};
