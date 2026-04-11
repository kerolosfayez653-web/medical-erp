"use client";
import { useState, useEffect } from "react";

interface Person {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  currentBalance: number;
  lastInvoice: {
    invoiceNumber: string | null;
    totalAmount: number;
    date: string;
    paymentStatus: string;
  } | null;
}

interface Product {
  id: number;
  name: string;
  weightedAvgCost: number;
  avgSellPrice: number;
  currentQty: number;
  unit: string | null;
  secondaryUnit: string | null;
  conversionFactor: number;
  secondaryPrice: number | null;
  lastSellPrice: number;
  lots: Array<{ sellingPrice: number; quantity: number }>;
}

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function SalesPage() {
  const [products, setProducts]           = useState<Product[]>([]);
  const [customers, setCustomers]         = useState<Person[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [cart, setCart]                   = useState<any[]>([]);
  const [paidAmount, setPaidAmount]       = useState("0");
  const [discount, setDiscount]           = useState("0");
  const [deliveryFee, setDeliveryFee]     = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("كاش");
  const [loading, setLoading]             = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [lastInvoiceId, setLastInvoiceId] = useState<number | null>(null);
  const [custSearch, setCustSearch]       = useState("");
  const [lastAddedId, setLastAddedId]     = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/inventory").then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
    fetch("/api/people").then(r => r.json()).then(d => {
      if (d.success) setCustomers(d.data.filter((p: any) => p.type === "CUSTOMER"));
    });
  }, []);

  const selectedCustomer = customers.find(c => String(c.id) === selectedCustomerId) || null;
  const filteredCustomersList = customers.filter(c => 
    c.name.includes(custSearch) || (c.phone && c.phone.includes(custSearch))
  );

  const addToCart = (product: Product) => {
    // Visual feedback
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 800);

    const calcPrice = Number(product.avgSellPrice) || Number(product.lots[0]?.sellingPrice) || 0;
    const factor = Number(product.conversionFactor) || 1;

    setCart(prev => {
      const existing = prev.find(i => i.productId === product.id);
      if (existing) {
        return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        productId: product.id, 
        name: product.name, 
        price: calcPrice, 
        quantity: 1, 
        maxQty: product.currentQty > 0 ? product.currentQty : 999999,
        unitType: 'PRIMARY',
        unit: product.unit || 'وحدة',
        secondaryUnit: product.secondaryUnit,
        conversionFactor: factor,
        primaryPrice: calcPrice,
        secondaryPrice: Number(product.secondaryPrice) || (calcPrice / factor)
      }];
    });
  };

  const itemsTotal     = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountVal    = parseFloat(discount || "0");
  const deliveryVal    = parseFloat(deliveryFee || "0");
  const totalAmount    = itemsTotal + deliveryVal - discountVal;
  const paid           = parseFloat(paidAmount || "0");
  const remaining      = totalAmount - paid;

  const submitInvoice = async () => {
    if (cart.length === 0) return alert("الفاتورة فارغة!");
    if (!selectedCustomerId) return alert("يرجى تحديد العميل");
    setLoading(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "SALES", personId: selectedCustomerId, items: cart, paidAmount: paid, discount: discountVal, deliveryFee: deliveryVal, paymentMethod }),
    });
    if (res.ok) {
      const data = await res.json();
      setLastInvoiceId(data.data.id);
      
      setCart([]);
      setPaidAmount("0");
      setDiscount("0");
      setDeliveryFee("0");
      setSelectedCustomerId("");
      // Refresh products
      fetch("/api/inventory").then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
    } else {
      alert("❌ حدث خطأ أثناء حفظ الفاتورة");
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ marginBottom: "2rem" }}>فاتورة مبيعات جديدة</h1>

      <div className="split-layout">

        {/* ── Left Panel: Customer + Payment ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Customer selector */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>👤 بيانات العميل</h3>
            <div className="input-group">
              <label>🔍 بحث عن عميل / اختيار</label>
              <input 
                type="text" 
                placeholder="ابحث بالاسم أو الهاتف..." 
                value={custSearch}
                onChange={e => setCustSearch(e.target.value)}
                className="input-field"
                style={{ marginBottom: '10px', fontSize: '0.9rem' }}
              />
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="input-field"
              >
                <option value="">-- {filteredCustomersList.length === 0 ? "لا يوجد نتائج" : "اختر العميل"} --</option>
                {filteredCustomersList.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name} {c.phone ? `(${c.phone})` : ""}</option>
                ))}
              </select>
            </div>

            {/* Customer Info Card */}
            {selectedCustomer && (
              <div style={{ marginTop: "1rem", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ fontWeight: "bold", fontSize: "1.05rem", marginBottom: "8px", color: "var(--accent-color)" }}>
                  {selectedCustomer.name}
                </div>
                {selectedCustomer.phone && (
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    📞 {selectedCustomer.phone}
                  </div>
                )}
                {selectedCustomer.address && (
                  <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                    📍 {selectedCustomer.address}
                  </div>
                )}
                {selectedCustomer.currentBalance !== 0 && (
                  <div style={{ fontSize: "0.85rem", marginTop: "6px", padding: "4px 8px", background: "rgba(239,68,68,0.15)", borderRadius: "6px" }}>
                    💳 مديونية حالية:{" "}
                    <strong style={{ color: "var(--danger-color)" }}>
                      {fmt(selectedCustomer.currentBalance)} ج.م
                    </strong>
                  </div>
                )}
                {selectedCustomer.lastInvoice && (
                  <div style={{ marginTop: "8px", fontSize: "0.82rem", color: "var(--text-secondary)", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px" }}>
                    آخر فاتورة:{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {fmt(selectedCustomer.lastInvoice.totalAmount)} ج.م
                    </strong>
                    {" · "}
                    {new Date(selectedCustomer.lastInvoice.date).toLocaleDateString("ar-EG")}
                    {selectedCustomer.lastInvoice.invoiceNumber && (
                      <span style={{ marginRight: "6px", opacity: 0.7 }}>
                        ({selectedCustomer.lastInvoice.invoiceNumber})
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>💰 الدفع</h3>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.95rem" }}>
              <span>إجمالي الأصناف:</span>
              <span>{fmt(itemsTotal)} ج.م</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div className="input-group">
                <label>توصيل (+)</label>
                <input type="number" step="0.01" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="input-field" style={{ padding: "6px" }} />
              </div>
              <div className="input-group">
                <label>خصم (-)</label>
                <input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className="input-field" style={{ padding: "6px" }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "1.2rem", fontWeight: "bold", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "8px" }}>
              <span>الصافي المطلوب:</span>
              <span style={{ color: "var(--text-primary)" }}>{fmt(totalAmount)} ج.م</span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div className="input-group">
                <label>المبلغ المدفوع</label>
                <input
                  type="number" step="0.01" value={paidAmount}
                  onChange={e => setPaidAmount(e.target.value)}
                  className="input-field"
                  style={{ borderColor: "var(--success-color)", fontSize: "1.1rem" }}
                />
              </div>
              <div className="input-group">
                <label>وسيلة الدفع</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field" style={{ padding: "6px" }}>
                  <option value="كاش">كاش</option>
                  <option value="انستاباي">انستاباي</option>
                  <option value="اكسيس باي">اكسيس باي</option>
                  <option value="شيك">شيك</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", color: remaining > 0 ? "var(--danger-color)" : "var(--success-color)" }}>
              <span>{remaining > 0 ? "الباقي (يسجل آجل):" : "✅ مدفوع بالكامل"}</span>
              <strong>{remaining > 0 ? fmt(remaining) + " ج.م" : ""}</strong>
            </div>

            <button
              onClick={submitInvoice}
              disabled={loading || cart.length === 0}
              className="btn btn-primary"
              style={{ width: "100%", fontSize: "1.1rem", padding: "16px" }}
            >
              {loading ? "⏳ جاري التنفيذ..." : "✅ تأكيد وإصدار الفاتورة"}
            </button>
          </div>
        </div>

        {/* ── Right Panel: Cart + Products ── */}
        <div>
          {/* Cart */}
          {cart.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: "1.5rem", border: "1px solid var(--accent-color)", padding: "16px" }}>
              <h3 style={{ marginBottom: "1rem", color: "var(--accent-color)" }}>
                🛒 عناصر الفاتورة ({cart.length} صنف)
              </h3>
                <div className="table-responsive">
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)", textAlign: "center" }}>
                      <th style={{ padding: "12px", textAlign: "right", color: 'var(--accent-color)' }}>الصنف</th>
                      <th style={{ padding: "12px" }}>الكمية</th>
                      <th style={{ padding: "12px" }}>سعر البيع</th>
                      <th style={{ padding: "12px" }}>الإجمالي</th>
                      <th style={{ padding: "12px" }}>حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.productId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                        <td style={{ padding: "12px", fontWeight: "bold", textAlign: "right" }}>{item.name}</td>
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <input
                              type="number" min="1" value={item.quantity}
                              onChange={e => setCart(cart.map(i => i.productId === item.productId ? { ...i, quantity: parseInt(e.target.value) || 1 } : i))}
                              className="input-field" style={{ width: "70px", padding: "4px", textAlign: "center" }}
                            />
                            <select 
                              value={item.unitType}
                              onChange={e => {
                                const ut = e.target.value;
                                setCart(cart.map(i => i.productId === item.productId ? { 
                                  ...i, 
                                  unitType: ut,
                                  price: ut === 'SECONDARY' ? i.secondaryPrice : i.primaryPrice 
                                } : i));
                              }}
                              style={{ fontSize: '0.75rem', padding: '4px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                            >
                              <option value="PRIMARY">{item.unit || 'علبة'}</option>
                              {item.secondaryUnit && <option value="SECONDARY">{item.secondaryUnit}</option>}
                            </select>
                          </div>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <input
                            type="number" step="0.01" value={item.price}
                            onChange={e => setCart(cart.map(i => i.productId === item.productId ? { ...i, price: parseFloat(e.target.value) || 0 } : i))}
                            className="input-field" style={{ width: "90px", padding: "4px", textAlign: "center" }}
                          />
                        </td>
                        <td style={{ padding: "12px", fontWeight: "bold", color: 'var(--success-color)' }}>{fmt(item.price * item.quantity)}</td>
                        <td style={{ padding: "12px" }}>
                          <button
                            onClick={() => setCart(cart.filter(i => i.productId !== item.productId))}
                            style={{ background: "transparent", color: "var(--danger-color)", border: "none", cursor: "pointer", fontSize: "1.2rem" }}
                          >✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          </div>
          )}

          {/* Product Catalog */}
          <div className="glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <h3 style={{ margin: 0 }}>📦 اختيار الأصناف للبيع</h3>
              <input
                type="text" placeholder="🔍 ابحث في الأصناف..."
                value={searchProduct} onChange={e => setSearchProduct(e.target.value)}
                className="input-field" style={{ width: "220px" }}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", maxHeight: "500px", overflowY: "auto" }}>
              {filteredProducts.map(p => {
                const inCart  = cart.find(i => i.productId === p.id);
                const isJustAdded = lastAddedId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className={`product-card ${inCart ? 'in-cart' : ''}`}
                    style={isJustAdded ? { transform: 'scale(0.9)', borderColor: 'var(--accent-color)', boxShadow: '0 0 20px var(--accent-color)' } : {}}
                  >
                    <strong style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", lineHeight: "1.3" }}>{p.name}</strong>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", marginBottom: "4px" }}>
                      سعر: {p.avgSellPrice > 0 ? p.avgSellPrice.toFixed(2) : "0"} ج.م
                    </div>
                    {p.lastSellPrice > 0 && (
                      <div style={{ fontSize: "0.72rem", color: "var(--accent-color)", marginBottom: "4px" }}>
                        آخر بيع: {p.lastSellPrice.toFixed(2)} ج.م
                      </div>
                    )}
                    <div style={{ fontSize: "0.78rem", color: p.currentQty > 0 ? "var(--success-color)" : "var(--danger-color)", fontWeight: "bold" }}>
                      رصيد: {p.currentQty}
                    </div>
                    
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       {inCart ? (
                         <span style={{ fontSize: "0.72rem", color: "var(--accent-color)" }}>✓ ({inCart.quantity})</span>
                       ) : (
                         <span style={{ fontSize: "0.72rem", opacity: 0.6 }}>🛒 {isJustAdded ? "تمت الإضافة" : "أضف للبيع"}</span>
                       )}
                       <span style={{ fontSize: '1rem', color: isJustAdded ? 'var(--success-color)' : 'var(--accent-color)' }}>{isJustAdded ? '✔' : '＋'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Success Modal with Print Option */}
      {lastInvoiceId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-panel" style={{ textAlign: 'center', maxWidth: '400px', width: '100%' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ marginBottom: '1rem' }}>تم إصدار الفاتورة بنجاح!</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
               <button 
                  onClick={() => {
                    window.open(`/invoices/${lastInvoiceId}/print`, '_blank');
                  }} 
                  className="btn btn-primary" 
                  style={{ width: '100%', padding: '12px' }}
               >
                 🖨️ طباعة الفاتورة الآن
               </button>
               <button 
                  onClick={() => setLastInvoiceId(null)} 
                  className="btn" 
                  style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.1)' }}
               >
                 🔄 إنشاء فاتورة جديدة
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
