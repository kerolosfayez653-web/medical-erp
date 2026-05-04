"use client";
import { useState, useEffect } from 'react';
import ExportBtn from '@/components/ExportBtn';

interface Product {
  id: number;
  name: string;
  barcode: string | null;
  category: string | null;
  openingQty: number;
  openingWeightedAvg: number;
  purchasedQty: number;
  purchasedValue: number;
  soldQty: number;
  salesRevenue: number;
  currentQty: number;
  weightedAvgCost: number;
  unit: string | null;
  secondaryUnit: string | null;
  conversionFactor: number;
  secondaryPrice: number | null;
  avgSellPrice: number;
  lots: Array<{ id: number; batchNumber: string; expiryDate: string; quantity: number; costPrice: number }>;
}

interface Totals {
  totalInventoryValue: number;
  totalSalesRevenue: number;
  totalCOGS: number;
  totalGrossProfit: number;
  totalProducts: number;
  inStockCount: number;
  outOfStockCount: number;
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt0 = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [totals, setTotals]     = useState<Totals | null>(null);
  const [loading, setLoading]   = useState(true);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus]   = useState('ALL');
  const [activeTab, setActiveTab]         = useState<'table' | 'analysis'>('table');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/inventory')
      .then(r => r.json())
      .then(json => {
        if (json.success) {
          setProducts(json.data);
          setTotals(json.totals);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const filtered = products.filter(p => {
    if (filterCategory !== 'ALL' && p.category !== filterCategory) return false;
    if (filterStatus === 'IN_STOCK'     && p.currentQty <= 0)  return false;
    if (filterStatus === 'OUT_OF_STOCK' && p.currentQty > 0)   return false;
    if (filterStatus === 'NEGATIVE'     && p.currentQty >= 0)  return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.barcode?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Top products by value
  const topByValue    = [...products].sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, 10);
  const topByProfit   = [...products].filter(p => p.soldQty > 0).sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 10);
  const negativeStock = products.filter(p => p.currentQty < 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>تحليل المخزون</h1>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            نظام المتوسط المرجح المتحرك • بيانات 1/1/2026
          </p>
        </div>
        <a href="/import" className="btn btn-primary" style={{ textDecoration: 'none', padding: '10px 20px' }}>
          📥 استيراد / تحديث البيانات
        </a>
      </div>

      {/* KPI Cards */}
      {totals && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>قيمة المخزون الحالية</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>{fmt(totals.totalInventoryValue)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ج.م</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>إجمالي المبيعات</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success-color)' }}>{fmt(totals.totalSalesRevenue)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ج.م</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>تكلفة البضاعة المباعة (COGS)</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{fmt(totals.totalCOGS)}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ج.م</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>إجمالي الربح الإجمالي</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: totals.totalGrossProfit >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>
              {fmt(totals.totalGrossProfit)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>ج.م</div>
          </div>
          <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>إجمالي الأصناف</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{fmt0(totals.totalProducts)}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '4px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--success-color)' }}>✅ {totals.inStockCount} متوفر</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--danger-color)' }}>❌ {totals.outOfStockCount} نافذ</span>
            </div>
          </div>
          {totals.totalSalesRevenue > 0 && (
            <div className="glass-panel" style={{ padding: '1.25rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>نسبة الربح الإجمالي</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                {((totals.totalGrossProfit / totals.totalSalesRevenue) * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gross Margin</div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {([['table', '📋 جدول المخزون'], ['analysis', '📊 تحليل شامل']] as const).map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', padding: '10px 20px', cursor: 'pointer',
              color: activeTab === tab ? 'var(--accent-color)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
              fontFamily: 'inherit', fontSize: '0.95rem', fontWeight: activeTab === tab ? 'bold' : 'normal',
              transition: 'var(--transition)', marginBottom: '-1px'
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ===== TAB: INVENTORY TABLE ===== */}
      {activeTab === 'table' && (
        <div className="glass-panel" style={{ padding: '20px', minWidth: 0 }}>
          {/* Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <ExportBtn type="inventory" label="📊 تصدير إكسيل" />
              <h3 style={{ margin: 0 }}>دليل الأصناف ({filtered.length} صنف)</h3>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text" placeholder="🔍 ابحث بالاسم أو الكود"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="input-field" style={{ minWidth: '200px' }}
              />
              <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="input-field">
                <option value="ALL">جميع التصنيفات</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field">
                <option value="ALL">كل الحالات</option>
                <option value="IN_STOCK">✅ متوفر</option>
                <option value="OUT_OF_STOCK">❌ نافذ / صفر</option>
                <option value="NEGATIVE">⚠️ رصيد سالب</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            {loading ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>⏳ جاري تحميل بيانات المخزون...</p>
            ) : filtered.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                لا توجد نتائج. اذهب إلى <a href="/import" style={{ color: 'var(--accent-color)' }}>الاستيراد</a> لتحميل البيانات.
              </p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: 'rgba(59,130,246,0.15)', textAlign: 'center' }}>
                    <th style={th}>الكود</th>
                    <th style={{ ...th, textAlign: 'right', minWidth: '220px' }}>اسم الصنف</th>
                    <th style={th}>رصيد أول المدة</th>
                    <th style={th}>متوسط أول المدة</th>
                    <th style={th}>الوارد (مشتريات)</th>
                    <th style={th}>تكلفة المشتريات</th>
                    <th style={th}>المنصرف (مبيعات)</th>
                    <th style={th}>الرصيد الحالي</th>
                    <th style={{ ...th, background: 'rgba(59,130,246,0.25)' }}>المتوسط المرجح ✦</th>
                    <th style={th}>متوسط البيع</th>
                    <th style={th}>قيمة المخزون</th>
                    <th style={th}>إيراد المبيعات</th>
                    <th style={th}>COGS</th>
                    <th style={th}>الربح الإجمالي</th>
                    <th style={th}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const isNeg = p.currentQty < 0;
                    const isZero = p.currentQty === 0;
                    const profitColor = p.grossProfit > 0 ? 'var(--success-color)' : p.grossProfit < 0 ? 'var(--danger-color)' : 'var(--text-secondary)';
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                        <td style={td}><span style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>{p.barcode}</span></td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'normal' }}>
                          <a href={`/products/${p.id}/statement`} style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                            {p.name}
                          </a>
                        </td>
                        <td style={td}>{p.openingQty > 0 ? fmt0(p.openingQty) : <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                        <td style={td}>{p.openingWeightedAvg > 0 ? p.openingWeightedAvg.toFixed(3) : <span style={{ color: 'var(--text-secondary)' }}>-</span>}</td>
                        <td style={{ ...td, color: 'var(--success-color)' }}>{p.purchasedQty > 0 ? `+${fmt0(p.purchasedQty)}` : '-'}</td>
                        <td style={td}>{p.purchasedValue > 0 ? fmt(p.purchasedValue) : '-'}</td>
                        <td style={{ ...td, color: 'var(--danger-color)' }}>{p.soldQty > 0 ? `-${fmt0(p.soldQty)}` : '-'}</td>
                        <td style={{ ...td, fontWeight: 'bold', fontSize: '1rem', color: isNeg ? 'var(--danger-color)' : isZero ? '#f59e0b' : 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                             <span>{p.currentQty} <small style={{ fontWeight: 'normal' }}>{p.secondaryUnit || 'وحدة'}</small></span>
                             {p.conversionFactor > 1 && (
                                <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>
                                   {Math.floor(p.currentQty / p.conversionFactor)} {p.unit} ({p.currentQty % p.conversionFactor} {p.secondaryUnit})
                                </span>
                             )}
                          </div>
                          {isNeg && <span style={{ fontSize: '0.7rem', display: 'block' }}>⚠️ سالب</span>}
                        </td>
                        <td style={{ ...td, background: 'rgba(59,130,246,0.08)', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                          {p.weightedAvgCost > 0 ? (p.weightedAvgCost * (p.conversionFactor || 1)).toFixed(2) : '-'}
                        </td>
                        <td style={td}>
                          {p.avgSellPrice > 0 ? fmt(p.avgSellPrice * (p.conversionFactor || 1)) : '-'}
                        </td>
                        <td style={{ ...td, fontWeight: 'bold' }}>{p.inventoryValue !== 0 ? fmt(p.inventoryValue) : '-'}</td>
                        <td style={{ ...td, color: 'var(--success-color)' }}>{p.salesRevenue > 0 ? fmt(p.salesRevenue) : '-'}</td>
                        <td style={td}>{p.cogs > 0 ? fmt(p.cogs) : '-'}</td>
                        <td style={{ ...td, fontWeight: 'bold', color: profitColor }}>
                          {p.soldQty > 0 ? fmt(p.grossProfit) : '-'}
                        </td>
                        <td style={td}>
                          <button onClick={() => setEditingProduct(p)} style={{ padding: '6px 12px', background: 'var(--accent-color)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}>✏️ تعديل</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'rgba(59,130,246,0.2)', fontWeight: 'bold', textAlign: 'center', borderTop: '2px solid var(--border-color)' }}>
                    <td colSpan={10} style={{ ...td, textAlign: 'right' }}>إجمالي النتائج ({filtered.length} صنف)</td>
                    <td style={td}>{fmt(filtered.reduce((s, p) => s + p.inventoryValue, 0))}</td>
                    <td style={{ ...td, color: 'var(--success-color)' }}>{fmt(filtered.reduce((s, p) => s + p.salesRevenue, 0))}</td>
                    <td style={td}>{fmt(filtered.reduce((s, p) => s + p.cogs, 0))}</td>
                    <td style={{ ...td, color: 'var(--success-color)' }}>{fmt(filtered.reduce((s, p) => s + p.grossProfit, 0))}</td>
                    <td style={td}></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: ANALYSIS ===== */}
      {activeTab === 'analysis' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Top 10 by inventory value */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem' }}>🏆 Top 10 أصناف بأعلى قيمة مخزون</h3>
            <div className="table-responsive">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <th style={th}>#</th>
                  <th style={{ ...th, textAlign: 'right' }}>الصنف</th>
                  <th style={th}>الرصيد</th>
                  <th style={th}>المتوسط المرجح</th>
                  <th style={th}>قيمة المخزون</th>
                </tr>
              </thead>
              <tbody>
                {topByValue.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                    <td style={td}><span style={{ color: i < 3 ? '#f59e0b' : 'var(--text-secondary)' }}>{i + 1}</span></td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'normal' }}>{p.name}</td>
                    <td style={td}>{fmt0(p.currentQty)}</td>
                    <td style={{ ...td, color: 'var(--accent-color)' }}>{(p.weightedAvgCost * (p.conversionFactor || 1)).toFixed(2)}</td>
                    <td style={{ ...td, fontWeight: 'bold' }}>{fmt(p.inventoryValue)} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>

          {/* Top 10 by gross profit */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem' }}>💰 Top 10 أصناف بأعلى ربح إجمالي</h3>
            {topByProfit.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>لا توجد مبيعات مسجلة بعد.</p>
            ) : (
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <th style={th}>#</th>
                    <th style={{ ...th, textAlign: 'right' }}>الصنف</th>
                    <th style={th}>الكمية المباعة</th>
                    <th style={th}>إيراد المبيعات</th>
                    <th style={th}>COGS</th>
                    <th style={th}>الربح الإجمالي</th>
                    <th style={th}>هامش الربح %</th>
                  </tr>
                </thead>
                <tbody>
                  {topByProfit.map((p, i) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                      <td style={td}><span style={{ color: i < 3 ? '#f59e0b' : 'var(--text-secondary)' }}>{i + 1}</span></td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'normal' }}>{p.name}</td>
                      <td style={td}>{fmt0(p.soldQty)}</td>
                      <td style={{ ...td, color: 'var(--success-color)' }}>{fmt(p.salesRevenue)}</td>
                      <td style={td}>{fmt(p.cogs)}</td>
                      <td style={{ ...td, fontWeight: 'bold', color: 'var(--success-color)' }}>{fmt(p.grossProfit)}</td>
                      <td style={{ ...td, color: 'var(--accent-color)' }}>
                        {p.salesRevenue > 0 ? ((p.grossProfit / p.salesRevenue) * 100).toFixed(1) + '%' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </div>

          {/* Negative stock warning */}
          {negativeStock.length > 0 && (
            <div className="glass-panel" style={{ borderRight: '4px solid var(--danger-color)' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--danger-color)' }}>⚠️ أصناف برصيد سالب ({negativeStock.length})</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                هذه الأصناف بيانات المبيعات فيها أكبر من مجموع أول المدة + المشتريات. قد يكون السبب بيانات ناقصة في شيت المخزون.
              </p>
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(239,68,68,0.15)' }}>
                    <th style={{ ...th, textAlign: 'right' }}>الصنف</th>
                    <th style={th}>أول المدة</th>
                    <th style={th}>المشتريات</th>
                    <th style={th}>المبيعات</th>
                    <th style={th}>الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {negativeStock.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(239,68,68,0.1)', textAlign: 'center' }}>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', whiteSpace: 'normal' }}>{p.name}</td>
                      <td style={td}>{fmt0(p.openingQty)}</td>
                      <td style={{ ...td, color: 'var(--success-color)' }}>{fmt0(p.purchasedQty)}</td>
                      <td style={{ ...td, color: 'var(--danger-color)' }}>{fmt0(p.soldQty)}</td>
                      <td style={{ ...td, fontWeight: 'bold', color: 'var(--danger-color)' }}>{p.currentQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
          )}

          {/* Category breakdown */}
          {categories.length > 0 && (
            <div className="glass-panel">
              <h3 style={{ marginBottom: '1rem' }}>📂 تحليل حسب التصنيف</h3>
              <div className="table-responsive">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ background: 'rgba(59,130,246,0.15)' }}>
                    <th style={{ ...th, textAlign: 'right' }}>التصنيف</th>
                    <th style={th}>عدد الأصناف</th>
                    <th style={th}>قيمة المخزون</th>
                    <th style={th}>إيراد المبيعات</th>
                    <th style={th}>الربح الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => {
                    const catProducts = products.filter(p => p.category === cat);
                    const catInventory = catProducts.reduce((s, p) => s + p.inventoryValue, 0);
                    const catRevenue   = catProducts.reduce((s, p) => s + p.salesRevenue, 0);
                    const catProfit    = catProducts.reduce((s, p) => s + p.grossProfit, 0);
                    return (
                      <tr key={cat} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>{cat}</td>
                        <td style={td}>{catProducts.length}</td>
                        <td style={td}>{fmt(catInventory)}</td>
                        <td style={{ ...td, color: 'var(--success-color)' }}>{catRevenue > 0 ? fmt(catRevenue) : '-'}</td>
                        <td style={{ ...td, color: catProfit > 0 ? 'var(--success-color)' : 'var(--text-secondary)' }}>
                          {catRevenue > 0 ? fmt(catProfit) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}
        </div>
      )}
      {/* Edit Product Modal */}
      {editingProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>تعديل وحدات الصنف: {editingProduct.name}</h2>
              <button onClick={() => setEditingProduct(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            
            <div className="input-group">
              <label>الوحدة الكبرى (مثلاً: علبة)</label>
              <input 
                className="input-field" 
                value={editingProduct.unit || ''} 
                onChange={e => setEditingProduct({...editingProduct, unit: e.target.value})} 
              />
            </div>
            <div className="input-group">
               <label>الوحدة الصغرى (مثلاً: شريط / قرص)</label>
               <input 
                 className="input-field" 
                 value={editingProduct.secondaryUnit || ''} 
                 onChange={e => setEditingProduct({...editingProduct, secondaryUnit: e.target.value})} 
               />
            </div>
            <div className="input-group">
               <label>معامل التحويل (كم وحدة صغرى في الكبرى)</label>
               <input 
                 type="number"
                 className="input-field" 
                 value={editingProduct.conversionFactor} 
                 onChange={e => setEditingProduct({...editingProduct, conversionFactor: parseInt(e.target.value) || 1})} 
               />
            </div>
            <div className="input-group">
               <label>سعر بيع الوحدة الصغرى (ج.م)</label>
               <input 
                 type="number"
                 className="input-field" 
                 value={editingProduct.secondaryPrice || ''} 
                 onChange={e => setEditingProduct({...editingProduct, secondaryPrice: parseFloat(e.target.value) || 0})} 
               />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button 
                onClick={() => setEditingProduct(null)} 
                className="btn" 
                style={{ background: 'rgba(255,255,255,0.1)' }}
              >إلغاء</button>
              
              <button 
                disabled={submitting}
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    const res = await fetch(`/api/products/${editingProduct.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        unit: editingProduct.unit,
                        secondaryUnit: editingProduct.secondaryUnit,
                        conversionFactor: editingProduct.conversionFactor,
                        secondaryPrice: editingProduct.secondaryPrice
                      })
                    });
                    if (res.ok) {
                      setEditingProduct(null);
                      window.location.reload();
                    }
                  } catch (e) { console.error(e); }
                  setSubmitting(false);
                }}
                className="btn btn-primary"
              >
                {submitting ? 'جاري الحفظ...' : 'حفظ الوحدات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  padding: '12px 8px',
  borderBottom: '2px solid var(--border-color)',
  fontWeight: 'bold',
  textAlign: 'center',
  fontSize: '0.82rem',
};

const td: React.CSSProperties = {
  padding: '10px 8px',
  textAlign: 'center',
};
