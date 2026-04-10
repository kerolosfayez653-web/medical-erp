"use client";
import React, { useState, useEffect } from 'react';

interface Expense {
  id: number;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  paymentMethod: string | null;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('ALL');
  
  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    amount: '',
    description: '',
    paymentMethod: 'كاش'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchExpenses();
  }, [filterCategory]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const resp = await fetch(`/api/expenses?category=${filterCategory}`);
      const json = await resp.json();
      if (json.success) {
        setExpenses(json.data);
        if (json.categories) setCategories(json.categories);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const resp = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await resp.json();
      if (json.success) {
        setForm({
          date: new Date().toISOString().split('T')[0],
          category: '',
          amount: '',
          description: '',
          paymentMethod: 'كاش'
        });
        fetchExpenses();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا المصروف؟')) return;
    const resp = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    const json = await resp.json();
    if (json.success) fetchExpenses();
  };

  const totalThisMonth = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="main-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="gradient-text">إدارة المصروفات</h1>
        <div className="stat-card" style={{ padding: '0.5rem 1rem', border: '1px solid var(--border-color)' }}>
           <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>إجمالي المعروض:</span>
           <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger-color)', marginRight: '0.5rem' }}>
             {totalThisMonth.toLocaleString('en-US')} ج.م
           </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '2rem' }}>
        {/* Add Expense Form */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1.5rem' }}>إضافة مصروف جديد</h3>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>التاريخ</label>
              <input 
                type="date" className="input-field" required
                value={form.date} onChange={e => setForm({...form, date: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>نوع المصروف</label>
              <input 
                list="expense-categories"
                className="input-field" required placeholder="مثلاً: إيجار، انتقالات..."
                value={form.category} onChange={e => setForm({...form, category: e.target.value})}
              />
              <datalist id="expense-categories">
                {categories.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div className="input-group">
              <label>المبلغ</label>
              <input 
                type="number" step="0.01" className="input-field" required
                value={form.amount} onChange={e => setForm({...form, amount: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>البيان / ملاحظات</label>
              <textarea 
                className="input-field" style={{ minHeight: '80px' }}
                value={form.description} onChange={e => setForm({...form, description: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label>طريقة الدفع</label>
              <select 
                className="input-field"
                value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value})}
              >
                <option value="كاش">كاش</option>
                <option value="انستاباي">انستاباي</option>
                <option value="اكسيس باي">اكسيس باي</option>
                <option value="فودافون كاش">فودافون كاش</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? 'جاري الحفظ...' : 'حفظ المصروف ✅'}
            </button>
          </form>
        </div>

        {/* Expenses Table */}
        <div className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>سجل المصروفات</h3>
            <select 
              className="input-field" style={{ width: '200px' }}
              value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="ALL">جميع التصنيفات</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? (
            <p>جاري التحميل...</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>التصنيف</th>
                  <th>البيان</th>
                  <th>المبلغ</th>
                  <th>الوسيلة</th>
                  <th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map(e => (
                  <tr key={e.id}>
                    <td>{new Date(e.date).toLocaleDateString('ar-EG')}</td>
                    <td><span className="badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)' }}>{e.category}</span></td>
                    <td>{e.description || '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>{e.amount.toLocaleString()}</td>
                    <td>{e.paymentMethod}</td>
                    <td>
                      <button onClick={() => handleDelete(e.id)} className="btn btn-danger" style={{ padding: '4px 8px' }}>🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
