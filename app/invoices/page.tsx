"use client";
import React, { useState, useEffect } from 'react';
import ExportBtn from '@/components/ExportBtn';

export default function InvoicesHistoryPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [personId, setPersonId] = useState('ALL');
  const [paymentStatus, setPaymentStatus] = useState('ALL');
  const [creationType, setCreationType] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');
  
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);

  // Modals
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [viewingHistory, setViewingHistory] = useState<any | null>(null);
  const [editReason, setEditReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [addingItemSearch, setAddingItemSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Payment states
  const [recordingPayment, setRecordingPayment] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('كاش');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    fetch('/api/people')
      .then(r => r.json())
      .then(d => { if (d.success) setPeople(d.data); });
      
    fetch('/api/products')
      .then(r => r.json())
      .then(d => { if (d.success) setProducts(d.data); });
  }, []);

  const fetchInvoices = () => {
    setLoading(true);
    const params = new URLSearchParams({
      type: filterType,
      paymentStatus,
      personId,
      startDate,
      endDate,
      creationType,
      method: methodFilter
    });
    
    fetch(`/api/invoices?${params.toString()}`)
      .then(r => r.json())
      .then(data => {
         if (data.success) setInvoices(data.data);
         else console.error(data.error);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInvoices();
  }, [filterType, paymentStatus, personId, startDate, endDate, creationType, methodFilter]);

  const safeFmt = (val: any) => { const n = Number(val); return isNaN(n) ? '0.00' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  const filtered = invoices.filter(inv => {
     if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
           !inv.invoiceNumber?.toLowerCase().includes(q) &&
           !inv.person?.name?.toLowerCase().includes(q)
        ) return false;
     }
     return true;
  });

   const stats = filtered.reduce((acc, inv) => {
      const invNet = inv.netAmount || 0;
      const invPaid = inv.paidAmount || 0;
      acc.total += invNet;
      acc.paid += invPaid;
      if (inv.type === 'SALES') acc.sales += invNet;
      if (inv.type === 'PURCHASES') acc.purchases += invNet;
      return acc;
   }, { total: 0, paid: 0, sales: 0, purchases: 0 });

   const currentDebt = stats.total - stats.paid;

   return (
    <div className="main-content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h1 className="gradient-text" style={{ margin: 0 }}>سجل الفواتير</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <ExportBtn type="invoices" params={{ invType: filterType }} />
            <button onClick={() => window.print()} className="btn" style={{ background: '#f43f5e', color: 'white' }}>
              📄 تصدير PDF
            </button>
            <input 
                type="text" 
                placeholder="🔍 ابحث برقم الفاتورة أو العميل..." 
                className="input-field"
                style={{ width: '300px' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
             />
          </div>
       </div>

        {/* Stats Summary */}
        <div className="stats-grid" style={{ marginBottom: '2rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
           <div className="stat-card" style={{ borderTop: '4px solid var(--accent-color)', padding: '1rem' }}>
              <span className="stat-title" style={{ fontSize: '0.9rem' }}>إجمالي المبيعات</span>
              <span className="stat-value" style={{ fontSize: '1.4rem' }}>{safeFmt(stats.sales)} ج.م</span>
           </div>
           <div className="stat-card" style={{ borderTop: '4px solid #8b5cf6', padding: '1rem' }}>
              <span className="stat-title" style={{ fontSize: '0.9rem' }}>إجمالي المشتريات</span>
              <span className="stat-value" style={{ fontSize: '1.4rem' }}>{safeFmt(stats.purchases)} ج.م</span>
           </div>
           <div className="stat-card" style={{ borderTop: '4px solid #f59e0b', padding: '1rem' }}>
              <span className="stat-title" style={{ fontSize: '0.9rem' }}>إجمالي المحصل</span>
              <span className="stat-value" style={{ fontSize: '1.4rem' }}>{safeFmt(stats.paid)} ج.م</span>
           </div>
             <div className="stat-card" style={{ borderTop: '4px solid var(--danger-color)', padding: '1rem' }}>
                <span className="stat-title" style={{ fontSize: '0.9rem' }}>صافي المديونية</span>
                <span className="stat-value" style={{ fontSize: '1.4rem' }}>
                   {safeFmt(currentDebt)} ج.م
                </span>
             </div>
        </div>

        {/* Filters Panel */}
       <div className="glass-panel" style={{ marginBottom: '2rem' }}>
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
              <div className="input-group">
                 <label>نوع الفاتورة</label>
                 <select className="input-field" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option value="ALL">الكل</option>
                    <option value="SALES">مبيعات</option>
                    <option value="PURCHASES">مشتريات</option>
                 </select>
              </div>
              <div className="input-group">
                 <label>حالة الدفع</label>
                 <select className="input-field" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                    <option value="ALL">الكل</option>
                    <option value="CASH">نقدي</option>
                    <option value="CREDIT">آجل</option>
                    <option value="PARTIAL">مدفوعة جزئياً</option>
                 </select>
              </div>
              <div className="input-group">
                 <label>نوع الإنشاء</label>
                 <select className="input-field" value={creationType} onChange={(e) => setCreationType(e.target.value)}>
                    <option value="ALL">الكل</option>
                    <option value="INIT_CASH">نقدي فوراً</option>
                    <option value="INIT_CREDIT">آجل وتحصيلات</option>
                 </select>
              </div>
              <div className="input-group">
                 <label>طريقة السداد</label>
                 <select className="input-field" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                    <option value="ALL">الكل</option>
                    <option value="كاش">كاش</option>
                    <option value="انستاباي">انستاباي</option>
                    <option value="فودافون كاش">فودافون كاش</option>
                    <option value="اكسيس باي">اكسيس باي</option>
                 </select>
              </div>
              <div className="input-group">
                 <label>العميل/المورد</label>
                 <select className="input-field" value={personId} onChange={(e) => setPersonId(e.target.value)}>
                    <option value="ALL">الكل</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                 </select>
              </div>
              <div className="input-group">
                 <label>من تاريخ</label>
                 <input type="date" className="input-field" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="input-group">
                 <label>إلى تاريخ</label>
                 <input type="date" className="input-field" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
           </div>
       </div>

        {loading ? (
           <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>جاري تحميل البيانات...</div>
        ) : (
           <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.85rem' }}>
                 <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border-color)' }}>
                       <th style={{ padding: '16px 8px' }}>التاريخ</th>
                       <th style={{ padding: '16px 8px' }}>رقم الفاتورة</th>
                       <th style={{ padding: '16px 8px' }}>الطرف الثاني</th>
                       <th style={{ padding: '16px 8px' }}>الخصم</th>
                       <th style={{ padding: '16px 8px' }}>التوصيل</th>
                       <th style={{ padding: '16px 8px' }}>الصافي</th>
                       <th style={{ padding: '16px 8px' }}>المدفوع</th>
                       <th style={{ padding: '16px 8px' }}>تفاصيل السداد</th>
                       <th style={{ padding: '16px 8px' }}>إجراءات</th>
                    </tr>
                 </thead>
                 <tbody>
                    {filtered.map((inv) => (
                       <React.Fragment key={inv.id}>
                          <tr 
                             style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'background 0.2s' }}
                             onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                             onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                             onClick={() => setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id)}
                          >
                             <td style={{ padding: '12px 8px' }}>{new Date(inv.date).toLocaleDateString('ar-EG')}</td>
                             <td style={{ padding: '12px 8px' }}>
                                <div style={{ color: inv.totalAmount < 0 ? 'var(--danger-color)' : 'var(--accent-color)', fontWeight: 'bold' }}>{inv.invoiceNumber || '-'}</div>
                                <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{inv.type === 'SALES' ? 'مبيعات' : 'مشتريات'}</div>
                             </td>
                             <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                                <a 
                                  href={`/people/${inv.personId}/statement`} 
                                  style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {inv.person?.name || '-'}
                                </a>
                             </td>
                             <td style={{ padding: '12px 8px', color: 'var(--danger-color)' }}>{safeFmt(inv.discount)}</td>
                             <td style={{ padding: '12px 8px', color: 'var(--success-color)' }}>{safeFmt(inv.deliveryFee)}</td>
                             <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>{safeFmt(inv.netAmount)}</td>
                             <td style={{ padding: '12px 8px', color: 'var(--success-color)' }}>{safeFmt(inv.paidAmount)}</td>
                                                           <td style={{ padding: '12px 8px' }}>
                                 {((inv.netAmount - (inv.paidAmount || 0)) <= 0.1) ? (
                                    <div style={{ fontSize: '0.8rem' }}>
                                       <span style={{ color: 'var(--success-color)', display: 'block' }}>✅ {inv.paymentMethod || 'خالص'}</span>
                                       <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{new Date(inv.date).toLocaleDateString('ar-EG')}</span>
                                    </div>
                                 ) : (
                                    (inv.paidAmount || 0) > 0 ? (
                                       <div style={{ fontSize: '0.8rem' }}>
                                          <span style={{ color: '#f59e0b', display: 'block', fontWeight: 'bold' }}>🔸 سداد جزئي</span>
                                          <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>المتبقي: {safeFmt(inv.netAmount - (inv.paidAmount || 0))} ج.م</span>
                                       </div>
                                    ) : (
                                       <span style={{ color: 'var(--danger-color)', fontSize: '0.8rem' }}>❌ آجل</span>
                                    )
                                 )}
                              </td>
                             <td style={{ padding: '12px 8px' }}>
                                <div style={{ display: 'flex', gap: '5px' }}>
                                  <button onClick={(e) => { e.stopPropagation(); window.open(`/invoices/${inv.id}/print`, '_blank'); }} className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#3b82f6', color: '#fff', border: 'none' }} title="طباعة">🖨️</button>
                                  <button onClick={(e) => { e.stopPropagation(); window.open(`/invoices/${inv.id}/print`, '_blank'); }} className="btn" style={{ padding: '4px 8px', fontSize: '0.8rem', background: '#f43f5e', color: '#fff', border: 'none' }} title="PDF">📄</button>
                                  <button onClick={(e) => { e.stopPropagation(); setExpandedInvoiceId(expandedInvoiceId === inv.id ? null : inv.id); }} className="btn" style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)' }}>{expandedInvoiceId === inv.id ? "▲" : "▼"}</button>
                                </div>
                             </td>
                          </tr>
                          {expandedInvoiceId === inv.id && (
                             <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                                <td colSpan={9} style={{ padding: '20px', textAlign: 'right' }}>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '1rem' }}>
                                      <div>
                                         <strong>تفاصيل التكاليف:</strong>
                                         <div style={{ marginTop: '5px', display: 'flex', gap: '15px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                            <span>إجمالي الأصناف: <font color="#fff">{safeFmt(inv.totalAmount)} ج.م</font></span>
                                            {inv.discount > 0 && <span>الخصم: <font color="#ef4444">{safeFmt(inv.discount)} ج.م</font></span>}
                                            <span>التوصيل: <font color="#10b981">{safeFmt(inv.deliveryFee)} ج.م</font></span>
                                            <span>الإجمالي النهائي: <font color="#fff" style={{fontWeight:'bold', borderBottom: '1px solid #fff'}}>{safeFmt(inv.netAmount)} ج.م</font></span>
                                         </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                         <button onClick={() => setViewingHistory(inv)} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>📜 السجل</button>
                                         <button onClick={() => { setEditingInvoice(JSON.parse(JSON.stringify(inv))); setEditReason(''); }} style={{ padding: '6px 12px', background: 'var(--accent-color)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>✏️ تعديل</button>
                                         {inv.netAmount - inv.paidAmount > 0.5 && (
                                            <button onClick={() => { setRecordingPayment(inv); setPaymentAmount(Math.max(0, inv.netAmount - inv.paidAmount).toString()); }} style={{ padding: '6px 12px', background: 'var(--success-color)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff', fontWeight: 'bold' }}>💰 تحصيل</button>
                                         )}
                                         <button onClick={async () => { if (window.confirm('حذف؟')) { await fetch(`/api/invoices/${inv.id}`, { method: 'DELETE' }); fetchInvoices(); } }} style={{ padding: '6px 12px', background: 'var(--danger-color)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: '#fff' }}>🗑️ حذف</button>
                                      </div>
                                   </div>
                                   
                                   <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '20px' }}>
                                      <thead>
                                         <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                            <th style={{ padding: '10px', textAlign: 'right' }}>الصنف</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>الكمية</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>السعر</th>
                                            <th style={{ padding: '10px', textAlign: 'center' }}>الإجمالي</th>
                                         </tr>
                                      </thead>
                                      <tbody>
                                         {inv.items?.map((item: any) => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                               <td style={{ padding: '8px', textAlign: 'right' }}>{item.product?.name}</td>
                                               <td style={{ padding: '8px', textAlign: 'center' }}>{item.unitType === 'SECONDARY' ? item.quantity : (item.quantity / (item.product?.conversionFactor || 1))} {item.unitType === 'SECONDARY' ? (item.product?.secondaryUnit || 'وحدة') : (item.product?.unit || 'وحدة')}</td>
                                               <td style={{ padding: '8px', textAlign: 'center' }}>{safeFmt(item.price)}</td>
                                               <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{safeFmt(item.total)}</td>
                                            </tr>
                                         ))}
                                      </tbody>
                                   </table>

                                   <div style={{ padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                      <div style={{ fontWeight: 'bold', marginBottom: '10px', color: 'var(--accent-color)' }}>💳 تفاصيل السداد والتحصيل:</div>
                                      {inv.payments && inv.payments.length > 0 ? (
                                         <div className="table-responsive">
                                           <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                              <thead>
                                                 <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                    <th style={{ padding: '5px' }}>تاريخ التحصيل</th>
                                                    <th style={{ padding: '5px' }}>الطريقة</th>
                                                    <th style={{ padding: '5px' }}>المبلغ</th>
                                                    <th style={{ padding: '5px' }}>ملاحظات</th>
                                                 </tr>
                                              </thead>
                                              <tbody>
                                                 {inv.payments.map((p: any) => (
                                                    <tr key={p.id}>
                                                       <td style={{ padding: '5px' }}>{new Date(p.date).toLocaleDateString('ar-EG')}</td>
                                                       <td style={{ padding: '5px' }}>{p.method}</td>
                                                       <td style={{ padding: '5px', color: 'var(--success-color)', fontWeight: 'bold' }}>{safeFmt(p.amount)} ج.م</td>
                                                       <td style={{ padding: '5px', opacity: 0.7 }}>{p.notes || '-'}</td>
                                                    </tr>
                                                 ))}
                                              </tbody>
                                           </table>
                                         </div>
                                      ) : (
                                         <div style={{ color: inv.paymentMethod ? 'var(--success-color)' : 'var(--danger-color)' }}>
                                            {inv.paymentMethod ? `✅ تم سدادها نقداً عبر: ${inv.paymentMethod}` : '⚠️ لم يتم تحصيل مبالغ بعد.'}
                                         </div>
                                      )}
                                   </div>
                                </td>
                             </tr>
                          )}
                       </React.Fragment>
                    ))}
                 </tbody>
              </table>
           </div>
        )}

        {/* Sub-Modals */}
        {viewingHistory && (
           <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>سجل التعديلات: {viewingHistory.invoiceNumber}</h2>
                    <button onClick={() => setViewingHistory(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                 </div>
                 {viewingHistory.logs?.map((log: any) => (
                    <div key={log.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '10px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{log.action}</strong>
                          <small>{new Date(log.createdAt).toLocaleString('ar-EG')}</small>
                       </div>
                       <p>السبب: {log.reason}</p>
                    </div>
                 ))}
                 <button className="btn" onClick={() => setViewingHistory(null)}>إغلاق</button>
              </div>
           </div>
        )}

         {editingInvoice && (
           <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px' }}>
              <div className="glass-panel" style={{ width: '100%', maxWidth: '1000px', maxHeight: '95vh', overflowY: 'auto', padding: '2rem' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0 }}>تعديل شامل للفاتورة: {editingInvoice.invoiceNumber}</h2>
                    <button onClick={() => setEditingInvoice(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                 </div>
                 
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="input-group">
                       <label>العميل/المورد</label>
                       <select className="input-field" value={editingInvoice.personId} onChange={e => setEditingInvoice({...editingInvoice, personId: parseInt(e.target.value)})}>
                          {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                       </select>
                    </div>
                    <div className="input-group">
                       <label>التاريخ</label>
                       <input type="date" className="input-field" value={new Date(editingInvoice.date).toISOString().split('T')[0]} onChange={e => setEditingInvoice({...editingInvoice, date: e.target.value})} />
                    </div>
                    <div className="input-group">
                       <label>نوع الفاتورة</label>
                       <select className="input-field" value={editingInvoice.type} onChange={e => setEditingInvoice({...editingInvoice, type: e.target.value})}>
                          <option value="SALES">مبيعات</option>
                          <option value="PURCHASES">مشتريات</option>
                       </select>
                    </div>
                 </div>

                 <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>الأصناف والكميات:</label>
                    <div className="glass-panel" style={{ padding: '0', overflowX: 'auto', background: 'rgba(255,255,255,0.02)' }}>
                       <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                             <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--border-color)' }}>
                                <th style={{ padding: '12px' }}>الصنف</th>
                                <th style={{ padding: '12px' }}>الكمية</th>
                                <th style={{ padding: '12px' }}>الوحدة</th>
                                <th style={{ padding: '12px' }}>السعر</th>
                                <th style={{ padding: '12px' }}>الإجمالي</th>
                                <th style={{ padding: '12px' }}>-</th>
                             </tr>
                          </thead>
                          <tbody>
                             {editingInvoice.items?.map((item: any, idx: number) => (
                                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                   <td style={{ padding: '8px' }}>{item.product?.name || "صنف غير معرف"}</td>
                                   <td style={{ padding: '8px' }}>
                                      <input 
                                         type="number" 
                                         className="input-field" 
                                         style={{ width: '80px', padding: '4px 8px' }} 
                                         value={item.quantity} 
                                         onChange={e => {
                                            const newItems = [...editingInvoice.items];
                                            newItems[idx].quantity = parseFloat(e.target.value);
                                            newItems[idx].total = newItems[idx].quantity * newItems[idx].price;
                                            setEditingInvoice({...editingInvoice, items: newItems});
                                         }}
                                      />
                                   </td>
                                   <td style={{ padding: '8px' }}>
                                      <select 
                                         className="input-field" 
                                         style={{ padding: '4px 8px' }} 
                                         value={item.unitType}
                                         onChange={e => {
                                            const newItems = [...editingInvoice.items];
                                            newItems[idx].unitType = e.target.value;
                                            setEditingInvoice({...editingInvoice, items: newItems});
                                         }}
                                      >
                                         <option value="PRIMARY">{item.product?.unit || 'وحدة'}</option>
                                         <option value="SECONDARY">{item.product?.secondaryUnit || 'قطعة'}</option>
                                      </select>
                                   </td>
                                   <td style={{ padding: '8px' }}>
                                      <input 
                                         type="number" 
                                         className="input-field" 
                                         style={{ width: '100px', padding: '4px 8px' }} 
                                         value={item.price}
                                         onChange={e => {
                                            const newItems = [...editingInvoice.items];
                                            newItems[idx].price = parseFloat(e.target.value);
                                            newItems[idx].total = newItems[idx].quantity * newItems[idx].price;
                                            setEditingInvoice({...editingInvoice, items: newItems});
                                         }}
                                      />
                                   </td>
                                   <td style={{ padding: '8px', fontWeight: 'bold' }}>{safeFmt(item.total)}</td>
                                   <td style={{ padding: '8px' }}>
                                      <button 
                                         className="btn" 
                                         style={{ padding: '4px 8px', background: 'var(--danger-color)', color: '#fff' }}
                                         onClick={() => {
                                            const newItems = editingInvoice.items.filter((_: any, i: number) => i !== idx);
                                            setEditingInvoice({...editingInvoice, items: newItems});
                                         }}
                                      >×</button>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                       <div style={{ padding: '15px', borderTop: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', gap: '10px' }}>
                             <input 
                                type="text" 
                                className="input-field" 
                                placeholder="🔍 إضافة صنف جديد للفاتورة..." 
                                style={{ flex: 1 }}
                                value={addingItemSearch}
                                onChange={e => {
                                   setAddingItemSearch(e.target.value);
                                   if (e.target.value.length > 1) {
                                      const results = products.filter(p => p.name.includes(e.target.value)).slice(0, 5);
                                      setSearchResults(results);
                                   } else {
                                      setSearchResults([]);
                                   }
                                }}
                             />
                          </div>
                          {searchResults.length > 0 && (
                             <div className="glass-panel" style={{ marginTop: '5px', padding: '10px', position: 'absolute', zIndex: 100, width: '400px' }}>
                                {searchResults.map(p => (
                                   <div 
                                      key={p.id} 
                                      className="clickable-row" 
                                      style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}
                                      onClick={() => {
                                         const newItem = {
                                            productId: p.id,
                                            product: p,
                                            quantity: 1,
                                            unitType: 'PRIMARY',
                                            price: p.defaultSellingPrice || 0,
                                            total: p.defaultSellingPrice || 0
                                         };
                                         setEditingInvoice({...editingInvoice, items: [...(editingInvoice.items || []), newItem]});
                                         setAddingItemSearch('');
                                         setSearchResults([]);
                                      }}
                                   >
                                      {p.name} - <small style={{ opacity: 0.7 }}>{p.code}</small>
                                   </div>
                                ))}
                             </div>
                          )}
                       </div>
                    </div>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem' }}>
                    <div className="input-group"><label>الخصم الكلي</label><input type="number" className="input-field" value={editingInvoice.discount} onChange={e => setEditingInvoice({...editingInvoice, discount: parseFloat(e.target.value)})} /></div>
                    <div className="input-group"><label>رسوم التوصيل</label><input type="number" className="input-field" value={editingInvoice.deliveryFee} onChange={e => setEditingInvoice({...editingInvoice, deliveryFee: parseFloat(e.target.value)})} /></div>
                    <div className="input-group">
                       <label>إجمالي الفاتورة</label>
                       <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                          {safeFmt((editingInvoice.items?.reduce((s: number, i: any) => s + (i.total || 0), 0) || 0) + (parseFloat(editingInvoice.deliveryFee) || 0) - (parseFloat(editingInvoice.discount) || 0))} ج.م
                       </div>
                    </div>
                    <div className="input-group">
                       <label>المبلغ المسدد حالياً</label>
                       <input type="number" className="input-field" value={editingInvoice.paidAmount} onChange={e => setEditingInvoice({...editingInvoice, paidAmount: parseFloat(e.target.value)})} />
                    </div>
                 </div>

                 <div className="input-group"><label>سبب التعديل (سيظهر في السجل)</label><textarea className="input-field" value={editReason} onChange={e => setEditReason(e.target.value)} /></div>
                 
                 <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button 
                       className="btn btn-primary" 
                       style={{ flex: 1, padding: '1rem' }}
                       disabled={submitting}
                       onClick={async () => {
                          setSubmitting(true);
                          const res = await fetch(`/api/invoices/${editingInvoice.id}`, { 
                             method: 'PATCH', 
                             headers: { 'Content-Type': 'application/json' }, 
                             body: JSON.stringify({ 
                                items: editingInvoice.items, 
                                discount: editingInvoice.discount, 
                                deliveryFee: editingInvoice.deliveryFee, 
                                paidAmount: editingInvoice.paidAmount, 
                                personId: editingInvoice.personId,
                                date: editingInvoice.date,
                                type: editingInvoice.type,
                                reason: editReason 
                             }) 
                          });
                          const data = await res.json();
                          if (data.success) {
                             setEditingInvoice(null); 
                             fetchInvoices();
                          } else {
                             alert('خطأ أثناء التعديل: ' + data.error);
                          }
                          setSubmitting(false);
                       }}
                    >{submitting ? 'جاري الحفظ...' : '📦 حفظ التعديلات الشاملة'}</button>
                    <button className="btn" style={{ padding: '12px 32px' }} onClick={() => setEditingInvoice(null)}>إلغاء</button>
                 </div>
              </div>
           </div>
         )}

        {recordingPayment && (
           <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div className="glass-panel" style={{ width: '100%', maxWidth: '500px' }}>
                 <h2>تحصيل دفعة - {recordingPayment.invoiceNumber}</h2>
                 <div className="input-group"><label>المبلغ</label><input type="number" className="input-field" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} /></div>
                 <div className="input-group"><label>الوسيلة</label><select className="input-field" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="كاش">كاش</option><option value="انستاباي">انستاباي</option><option value="فودافون كاش">فودافون كاش</option><option value="اكسيس باي">اكسيس باي</option></select></div>
                 <div className="input-group"><label>التاريخ</label><input type="date" className="input-field" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
                 <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={async () => {
                       setSubmitting(true);
                       await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ personId: recordingPayment.personId, invoiceId: recordingPayment.id, amount: paymentAmount, method: paymentMethod, date: paymentDate, notes: paymentNotes }) });
                       setRecordingPayment(null); fetchInvoices(); setSubmitting(false);
                    }}>تأكيد</button>
                    <button className="btn" onClick={() => setRecordingPayment(null)}>إلغاء</button>
                 </div>
              </div>
           </div>
        )}
    </div>
   );
}
