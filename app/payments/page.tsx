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
  invoiceId?: number | null;
  invoice?: { invoiceNumber: string };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2 });
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [persons, setPersons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [activeTab, setActiveTab] = useState<"HISTORY" | "BALANCES">("HISTORY");
  
  // New Voucher State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVoucher, setNewVoucher] = useState({
    personId: "",
    amount: "",
    method: "كاش",
    notes: "",
    date: new Date().toISOString().split('T')[0],
    invoiceId: ""
  });
  const [personInvoices, setPersonInvoices] = useState<any[]>([]);
  const [isFetchingPersonInvoices, setIsFetchingPersonInvoices] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Edit State
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  
  // Print Ref
  const printRef = useRef<HTMLDivElement>(null);

  // New states for invoice preview
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const [isFetchingInvoice, setIsFetchingInvoice] = useState(false);

  const fetchPayments = () => {
    setLoading(true);
    fetch("/api/payments")
      .then(r => r.json())
      .then(d => {
        if (d.success) setPayments(d.data);
      })
      .finally(() => setLoading(false));
  };

  const fetchPersons = () => {
    fetch("/api/people")
      .then(r => r.json())
      .then(d => {
        if (d.success) setPersons(d.data);
      });
  };

  const handleViewInvoice = async (invoiceId: number) => {
    if (isFetchingInvoice) return;
    
    setViewingInvoice(null); // Clear previous data immediately
    
    if (!invoiceId || invoiceId === 0) {
      alert("⚠️ تنبيه: هذا السند لا يحتوي على معرف فاتورة صالح في قاعدة البيانات.");
      return;
    }
    
    setIsFetchingInvoice(true);
    try {
      // Use query param for better browser compatibility and add cache buster
      const res = await fetch(`/api/invoices?id=${invoiceId}&cb=${Date.now()}`);
      const d = await res.json();
      
      if (d.success) {
        // Robust data extraction: handles both [{...}] and {...}
        const inv = Array.isArray(d.data) ? d.data[0] : d.data;
        if (inv) {
          setViewingInvoice(inv);
        } else {
          alert("تنبيه: لم يتم العثور على بيانات الفاتورة المطلوبة");
        }
      } else {
        alert("فشل في جلب تفاصيل الفاتورة: " + (d.error || "خطأ مجهول"));
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء تحميل الفاتورة");
    } finally {
      setIsFetchingInvoice(false);
    }
  };

  useEffect(() => { 
    fetchPayments(); 
    fetchPersons();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVoucher.personId || !newVoucher.amount) return;
    setSubmitting(true);
    try {
      const r = await fetch("/api/payments", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVoucher)
      });
      const d = await r.json();
      if (d.success) {
        setShowAddModal(false);
        setNewVoucher({
          personId: "",
          amount: "",
          method: "كاش",
          notes: "",
          date: new Date().toISOString().split('T')[0],
          invoiceId: ""
        });
        setPersonInvoices([]);
        fetchPayments();
        fetchPersons();
      } else {
        alert("خطأ: " + d.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (newVoucher.personId) {
      const fetchInvoices = async () => {
        setIsFetchingPersonInvoices(true);
        try {
          const res = await fetch(`/api/invoices?personId=${newVoucher.personId}&paymentStatus=CREDIT`);
          const d = await res.json();
          if (d.success) {
            setPersonInvoices(d.data);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsFetchingPersonInvoices(false);
        }
      };
      fetchInvoices();
    } else {
      setPersonInvoices([]);
    }
  }, [newVoucher.personId]);

  const handleInvoiceSelect = (invId: string) => {
    const inv = personInvoices.find(i => i.id === Number(invId));
    if (inv) {
      setNewVoucher({
        ...newVoucher, 
        invoiceId: invId,
        notes: (newVoucher.notes ? newVoucher.notes + '\n' : '') + `سداد فاتورة رقم: ${inv.invoiceNumber}`
      });
    } else {
      setNewVoucher({...newVoucher, invoiceId: ""});
    }
  };

  const openVoucherFor = (personId: number) => {
    setNewVoucher(v => ({ ...v, personId: String(personId) }));
    setShowAddModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا السند؟ سيتم عكس الأثر المالي في مديونية العميل آلياً.")) return;
    try {
      const r = await fetch(`/api/payments?id=${id}`, { method: 'DELETE' });
      const d = await r.json();
      if (d.success) {
        setPayments(prev => prev.filter(p => p.id !== id));
        fetchPersons();
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
        fetchPersons();
      } else {
        alert("خطأ: " + d.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = (payment: Payment) => {
    window.open(`/payments/${payment.id}/print`, "_blank");
  };

  const filtered = payments.filter(p => {
    const matchesSearch = 
      p.person.name.toLowerCase().includes(search.toLowerCase()) || 
      (p.notes || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.invoice?.invoiceNumber || "").toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter = filterType === "ALL" || p.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const filteredBalances = persons.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'ALL' || (filterType === 'IN' ? p.type === 'CUSTOMER' : p.type === 'SUPPLIER');
    return matchesSearch && matchesType;
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
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '1rem' }}>
      
      {/* Header & Stats */}
      <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', borderRight: '5px solid var(--accent-color)' }}>
        <div style={{ minWidth: '250px' }}>
          <h1 className="gradient-text" style={{ margin: 0, fontSize: '1.8rem' }}>💰 التدفقات النقدية</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '5px 0 0 0', fontSize: '0.9rem' }}>إدارة شاملة للمقبوضات والمدفوعات</p>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '2px' }}>المقبوضات</div>
              <div style={{ fontWeight: 'bold', color: 'var(--success-color)', fontSize: '1.2rem' }}>{fmt(stats.collections)} ج.م</div>
            </div>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)', alignSelf: 'center' }}></div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '2px' }}>المدفوعات</div>
              <div style={{ fontWeight: 'bold', color: 'var(--danger-color)', fontSize: '1.2rem' }}>{fmt(stats.payments)} ج.م</div>
            </div>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary" 
            style={{ padding: '12px 24px', fontSize: '1rem', borderRadius: '12px', flex: '1 1 auto' }}
          >
            ➕ تسجيل سند جديد
          </button>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px', overflowX: 'auto', maxWidth: '100%' }}>
            <button 
              onClick={() => setActiveTab("HISTORY")}
              style={{ 
                padding: '10px 20px', 
                borderRadius: '8px', 
                border: 'none',
                background: activeTab === 'HISTORY' ? 'var(--accent-color)' : 'transparent',
                color: activeTab === 'HISTORY' ? '#000' : '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: '0.3s'
              }}
            >
              📜 سجل الحركات
            </button>
            <button 
              onClick={() => setActiveTab("BALANCES")}
              style={{ 
                padding: '10px 20px', 
                borderRadius: '8px', 
                border: 'none',
                background: activeTab === 'BALANCES' ? 'var(--accent-color)' : 'transparent',
                color: activeTab === 'BALANCES' ? '#000' : '#fff',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: '0.3s'
              }}
            >
              ⚖️ ملخص الأرصدة والمديونيات
            </button>
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: 'min(100%, 300px)', flexWrap: 'wrap' }}>
            <input 
              type="text" 
              placeholder={activeTab === 'HISTORY' ? "🔍 ابحث بالاسم، ملاحظات، أو رقم الفاتورة..." : "🔍 ابحث عن اسم الشخص..."}
              className="input-field"
              style={{ flex: 1, minWidth: '200px' }}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button onClick={() => setFilterType("ALL")} className={`btn ${filterType === 'ALL' ? 'btn-primary' : ''}`} style={{ padding: '0.6rem 1rem', flex: 1 }}>الكل</button>
              <button onClick={() => setFilterType("IN")} className={`btn ${filterType === 'IN' ? 'btn-primary' : ''}`} style={{ padding: '0.6rem 1rem', flex: 1 }}>عملاء</button>
              <button onClick={() => setFilterType("OUT")} className={`btn ${filterType === 'OUT' ? 'btn-primary' : ''}`} style={{ padding: '0.6rem 1rem', flex: 1 }}>موردين</button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === "HISTORY" ? (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>الاسم</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>رقم الفاتورة</th>
                <th style={thStyle}>المبلغ</th>
                <th style={thStyle}>الوسيلة</th>
                <th style={thStyle}>ملاحظات / البند</th>
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
                  <td style={tdStyle}>
                    {p.invoice ? (
                      <button 
                        onClick={() => handleViewInvoice(p.invoiceId)}
                        disabled={isFetchingInvoice}
                        style={{ 
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent-color)', 
                          fontWeight: 'bold',
                          textDecoration: 'underline',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 'inherit',
                          fontFamily: 'inherit'
                        }}
                      >
                        📄 {p.invoice.invoiceNumber}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>سند عام</span>
                    )}
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
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
              <tr>
                <th style={thStyle}>اسم الشخص</th>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>إجمالي الفواتير (+)</th>
                <th style={thStyle}>إجمالي المسدد (-)</th>
                <th style={thStyle}>الرصيد المتبقي (=)</th>
                <th style={thStyle}>العمليات القوية</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.map(p => (
                <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)', transition: '0.2s' }}>
                  <td style={{ ...tdStyle, fontWeight: 'bold' }}>{p.name}</td>
                  <td style={tdStyle}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '6px', 
                      fontSize: '0.8rem',
                      background: p.type === 'CUSTOMER' ? 'rgba(7, 89, 133, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                      color: p.type === 'CUSTOMER' ? '#38bdf8' : '#94a3b8'
                    }}>
                      {p.type === 'CUSTOMER' ? 'عميل' : 'مورد'}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{fmt(p.totalInvoiced)} ج.م</td>
                  <td style={{ ...tdStyle, color: 'var(--success-color)' }}>{fmt(p.totalPaid)} ج.م</td>
                  <td style={{ ...tdStyle, fontWeight: 'bold', background: 'rgba(255,255,255,0.01)' }}>
                    {fmt(p.currentBalance)} ج.م
                  </td>
                  <td style={tdStyle}>
                    <button 
                      onClick={() => openVoucherFor(p.id)}
                      className="btn" 
                      style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '6px 15px', borderRadius: '8px' }}
                    >
                      💳 تسجيل دفعة
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredBalances.length === 0 && <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.5 }}>لا توجد سجلات مطابقة للبحث.</div>}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div style={modalOverlay}>
           <div className="glass-panel" style={{ width: '90%', maxWidth: '550px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>➕ تسجيل سند مالي جديد</h2>
              <button onClick={() => setShowAddModal(false)} className="btn" style={{ background: 'none', border: 'none', fontSize: '1.5rem', color: '#fff' }}>×</button>
            </div>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={labelStyle}>اختر العميل أو المورد</label>
                <select 
                  className="input-field" 
                  value={newVoucher.personId}
                  onChange={e => setNewVoucher({...newVoucher, personId: e.target.value})}
                  required
                >
                  <option value="">-- ابحث عن الاسم --</option>
                  {persons.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type === 'CUSTOMER' ? 'عميل' : 'مورد'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>اربط السند بفاتورة (اختياري)</label>
                <select 
                  className="input-field" 
                  value={newVoucher.invoiceId}
                  onChange={e => handleInvoiceSelect(e.target.value)}
                  disabled={isFetchingPersonInvoices || !newVoucher.personId}
                >
                  <option value="">-- اختر فاتورة مديونية --</option>
                  {personInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      📄 {inv.invoiceNumber} (إجمالي: {fmt(inv.netAmount)} - متبقي: {fmt(inv.netAmount - inv.paidAmount)})
                    </option>
                  ))}
                </select>
                {isFetchingPersonInvoices && <span style={{ fontSize: '0.7rem', opacity: 0.5 }}>جاري تحميل الفواتير...</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>المبلغ (ج.م)</label>
                  <input 
                    type="number" 
                    step="any"
                    className="input-field"
                    value={newVoucher.amount}
                    onChange={e => setNewVoucher({...newVoucher, amount: e.target.value})}
                    required
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label style={labelStyle}>التاريخ</label>
                  <input 
                    type="date" 
                    className="input-field"
                    value={newVoucher.date}
                    onChange={e => setNewVoucher({...newVoucher, date: e.target.value})}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>طريقة الدفع</label>
                <select 
                  className="input-field"
                  value={newVoucher.method}
                  onChange={e => setNewVoucher({...newVoucher, method: e.target.value})}
                >
                  <option value="كاش">كاش</option>
                  <option value="انستاباي">انستاباي</option>
                  <option value="فودافون كاش">فودافون كاش</option>
                  <option value="بنك">تحويل بنكي</option>
                  <option value="اكسيس باي">اكسيس باي</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>ملاحظات / بيان السند</label>
                <textarea 
                  className="input-field"
                  style={{ minHeight: '80px' }}
                  value={newVoucher.notes}
                  onChange={e => setNewVoucher({...newVoucher, notes: e.target.value})}
                  placeholder="اكتب هنا سبب التحصيل أو رقم العملية..."
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" disabled={submitting} className="btn btn-primary" style={{ flex: 1, padding: '1rem' }}>
                  {submitting ? '⏳ جاري الحفظ...' : '✅ تأكيد وحفظ السند'}
                </button>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal (Existing) */}
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

      {/* Invoice Detail Modal */}
      {viewingInvoice && (
        <div style={modalOverlay}>
          <div className="glass-panel" style={{ width: '95%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 className="gradient-text" style={{ margin: 0 }}>تفاصيل الفاتورة: {viewingInvoice.invoiceNumber}</h2>
              <button 
                onClick={() => setViewingInvoice(null)} 
                className="btn" 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '10px' }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px' }}>
              <div>
                <div style={labelStyle}>العميل / المورد</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{viewingInvoice.person?.name}</div>
              </div>
              <div>
                <div style={labelStyle}>التاريخ</div>
                <div style={{ fontWeight: 'bold' }}>{new Date(viewingInvoice.date).toLocaleDateString('ar-EG')}</div>
              </div>
              <div>
                <div style={labelStyle}>حالة السداد</div>
                <div style={{ color: (viewingInvoice.netAmount - (viewingInvoice.paidAmount || 0)) <= 0.1 ? 'var(--success-color)' : 
                                   (viewingInvoice.paidAmount > 0) ? '#f59e0b' : 
                                   'var(--danger-color)', fontWeight: 'bold' }}>
                  {(viewingInvoice.netAmount - (viewingInvoice.paidAmount || 0)) <= 0.1 ? 'خالص' : (viewingInvoice.paidAmount > 0) ? 'سداد جزئي' : 'آجل'}
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <th style={{ padding: '12px' }}>الصنف</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>الكمية</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>السعر</th>
                    <th style={{ padding: '12px', textAlign: 'center' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {viewingInvoice.items?.map((item: any) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '12px' }}>
                        <div>{item.product?.name}</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>{item.product?.code}</div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        {item.unitType === 'SECONDARY' ? item.quantity : (item.quantity / (item.product?.conversionFactor || 1))} {item.unitType === 'SECONDARY' ? (item.product?.secondaryUnit || 'وحدة') : (item.product?.unit || 'وحدة')}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>{fmt(item.price)} ج.م</td>
                      <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>{fmt(item.total)} ج.م</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
              <div className="glass-panel" style={{ minWidth: '300px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ opacity: 0.7 }}>إجمالي الأصناف:</span>
                  <span>{fmt(viewingInvoice.totalAmount)} ج.م</span>
                </div>
                {viewingInvoice.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--danger-color)' }}>
                    <span>الخصم:</span>
                    <span>- {fmt(viewingInvoice.discount)} ج.م</span>
                  </div>
                )}
                {viewingInvoice.deliveryFee > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--success-color)' }}>
                    <span>التوصيل:</span>
                    <span>+ {fmt(viewingInvoice.deliveryFee)} ج.م</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '1.2rem', fontWeight: 'bold' }}>
                  <span>الصافي النهائي:</span>
                  <span className="gradient-text">{fmt(viewingInvoice.netAmount)} ج.م</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button onClick={() => window.open(`/invoices/${viewingInvoice.id}/print`, '_blank')} className="btn btn-primary" style={{ flex: 1 }}>🖨️ طباعة الفاتورة</button>
              <button onClick={() => setViewingInvoice(null)} className="btn" style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}>إغلاق النافذة</button>
            </div>
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
