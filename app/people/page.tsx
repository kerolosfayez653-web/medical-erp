"use client";
import { useState, useEffect } from 'react';
import ExportBtn from '@/components/ExportBtn';

interface Person {
  id: number;
  name: string;
  type: string;
  phone: string | null;
  address: string | null;
  initialBalance: number;
  currentBalance: number;
}

function getBalanceColor(balance: number): string {
  if (balance > 0) return 'var(--danger-color)';
  if (balance < 0) return 'var(--success-color)';
  return 'var(--text-secondary)';
}

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('CUSTOMER');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('ALL');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchPeople = async () => {
    try {
      const res = await fetch('/api/people');
      const json = await res.json();
      if (json.success) setPeople(json.data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { 
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    if (filter) setBalanceFilter(filter);
    fetchPeople(); 
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await fetch('/api/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, phone, address, initialBalance }),
    });
    setName('');
    setPhone('');
    setAddress('');
    setInitialBalance('');
    setLoading(true);
    fetchPeople();
  };

  const q = searchQuery.toLowerCase();
  const filtered = people.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(q) || p.type.toLowerCase().includes(q);
    if (!matchesSearch) return false;

    if (balanceFilter === 'DEBT') return p.currentBalance > 0;
    if (balanceFilter === 'CREDIT') return p.currentBalance < 0;
    if (balanceFilter === 'ZERO') return p.currentBalance === 0;
    return true;
  });

  const totalCustomerDebt = people
    .filter((p) => p.type === 'CUSTOMER' && p.currentBalance > 0)
    .reduce((s, p) => s + p.currentBalance, 0);

  const totalSupplierDebt = people
    .filter((p) => p.type === 'SUPPLIER' && p.currentBalance > 0)
    .reduce((s, p) => s + p.currentBalance, 0);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h1 style={{ marginBottom: 0 }}>دليل العملاء والموردين</h1>
        <ExportBtn type="people" label="📊 تصدير إكسيل" />
      </div>
      
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        إجمالي مستحقات العملاء:{" "}
        <strong style={{ color: 'var(--danger-color)' }}>
          {totalCustomerDebt.toLocaleString('en-US')} ج.م
        </strong>
        &nbsp;|&nbsp; إجمالي مستحقات الموردين:{" "}
        <strong style={{ color: '#f59e0b' }}>
          {totalSupplierDebt.toLocaleString('en-US')} ج.م
        </strong>
      </p>

      <div className="split-layout">
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1rem' }}>إضافة جهة جديدة</h3>
          <form onSubmit={handleAdd}>
            <div className="input-group">
              <label>اسم العميل / المورد</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="مثال: صيدلية الأمل، د. أحمد..."
              />
            </div>
            <div className="input-group">
              <label>التصنيف</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="input-field">
                <option value="CUSTOMER">عميل (مبيعات)</option>
                <option value="SUPPLIER">مورد (مشتريات)</option>
              </select>
            </div>
            <div className="input-group">
              <label>رقم الهاتف</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-field"
                placeholder="01xxxxxxxxx"
              />
            </div>
            <div className="input-group">
              <label>العنوان</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="input-field"
                placeholder="مثال: القاهرة، شارع..."
              />
            </div>
            <div className="input-group">
              <label>الرصيد الافتتاحي (أجل / مديونية)</label>
              <input
                type="number"
                step="0.01"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                className="input-field"
                placeholder="0.00"
              />
              <small style={{ color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                موجب = عليه ديون، سالب = يُستحق له
              </small>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              تسجيل الجهة
            </button>
          </form>
        </div>

          <div style={{ padding: '20px', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0 }}>دليل المتعاملين ({filtered.length})</h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <select 
                  value={balanceFilter} 
                  onChange={(e) => setBalanceFilter(e.target.value)} 
                  className="input-field" 
                  style={{ width: '150px' }}
                >
                  <option value="ALL">كل الأرصدة</option>
                  <option value="DEBT">عليهم ديون</option>
                  <option value="CREDIT">ليهم رصيد</option>
                  <option value="ZERO">رصيد صفري</option>
                </select>
                <input
                  type="text"
                  placeholder="🔍 ابحث بالاسم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ width: '250px' }}
                />
              </div>
            </div>

            <div className="table-responsive">

            {loading ? (
              <p style={{ color: 'var(--text-secondary)' }}>جاري تحميل الدليل...</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ ...thStyle, width: '25%' }}>الاسم الكامل</th>
                    <th style={{ ...thStyle, width: '15%' }}>التصنيف</th>
                    <th style={{ ...thStyle, width: '15%' }}>الهاتف</th>
                    <th style={{ ...thStyle, width: '20%' }}>العنوان</th>
                    <th style={{ ...thStyle, width: '12%' }}>الرصيد الحقيقي</th>
                    <th style={{ ...thStyle, width: '13%', textAlign: 'center' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '16px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                        لا توجد نتائج مطابقة.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => (
                      <tr key={p.id} className="clickable-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '16px 12px', fontWeight: 'bold' }}>
                          <a href={`/people/${p.id}/statement`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                            {p.name}
                          </a>
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '0.85rem' }}>
                          <span style={{ padding: '4px 8px', borderRadius: '4px', background: p.type === 'CUSTOMER' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: p.type === 'CUSTOMER' ? 'var(--success-color)' : 'var(--warning-color)' }}>
                            {p.type === 'CUSTOMER' ? '👤 عميل' : '🏢 مورد'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 12px', whiteSpace: 'nowrap', fontSize: '0.85rem' }} dir="ltr">
                          {p.phone || '-'}
                        </td>
                        <td style={{ padding: '16px 12px', fontSize: '0.85rem', opacity: 0.8 }}>
                          {p.address || '-'}
                        </td>
                        <td style={{ padding: '16px 12px', fontWeight: 'bold', fontSize: '1rem', color: getBalanceColor(p.currentBalance), whiteSpace: 'nowrap' }}>
                          {p.currentBalance.toLocaleString()} ج.م
                        </td>
                        <td style={{ padding: '16px 12px', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => setEditingPerson(p)}
                            className="btn"
                            style={{ color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', padding: '6px 12px', fontSize: '0.8rem' }}
                          >
                            ✏️ تعديل
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {editingPerson && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>تعديل بيانات: {editingPerson.name}</h2>
              <button onClick={() => setEditingPerson(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <div className="input-group">
              <label>الاسم</label>
              <input 
                className="input-field" 
                value={editingPerson.name} 
                onChange={e => setEditingPerson({...editingPerson, name: e.target.value})} 
              />
            </div>
            <div className="input-group">
              <label>التصنيف</label>
              <select 
                className="input-field" 
                value={editingPerson.type} 
                onChange={e => setEditingPerson({...editingPerson, type: e.target.value})}
              >
                <option value="CUSTOMER">عميل</option>
                <option value="SUPPLIER">مورد</option>
              </select>
            </div>
            <div className="input-group">
              <label>الهاتف</label>
              <input 
                className="input-field" 
                value={editingPerson.phone || ''} 
                onChange={e => setEditingPerson({...editingPerson, phone: e.target.value})} 
              />
            </div>
            <div className="input-group">
              <label>العنوان</label>
              <input 
                className="input-field" 
                value={editingPerson.address || ''} 
                onChange={e => setEditingPerson({...editingPerson, address: e.target.value})} 
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button onClick={() => setEditingPerson(null)} className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>إلغاء</button>
              <button 
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const res = await fetch(`/api/people/${editingPerson.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(editingPerson)
                    });
                    if (res.ok) {
                      setEditingPerson(null);
                      fetchPeople();
                    }
                  } catch (e) { console.error(e); }
                  setSubmitting(false);
                }}
                className="btn btn-primary"
              >
                {submitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '14px 12px',
  borderBottom: '2px solid var(--border-color)',
  textAlign: 'right',
  fontWeight: 'bold',
  fontSize: '0.9rem',
};
