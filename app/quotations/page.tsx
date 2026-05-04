"use client";
import { useState, useEffect } from "react";

interface Person {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
}

interface Product {
  id: number;
  name: string;
  avgSellPrice: number;
  unit: string | null;
  secondaryUnit: string | null;
  conversionFactor: number;
  secondaryPrice: number | null;
}

function fmt(n: number) {
  return n.toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function NewQuotationPage() {
  const [products, setProducts]           = useState<Product[]>([]);
  const [customers, setCustomers]         = useState<Person[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [cart, setCart]                   = useState<any[]>([]);
  const [discount, setDiscount]           = useState("0");
  const [deliveryFee, setDeliveryFee]     = useState("0");
  const [notes, setNotes]                 = useState("");
  const [expiryDate, setExpiryDate]       = useState("");
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading]             = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [custSearch, setCustSearch]       = useState("");
  const [lastQuotationId, setLastQuotationId] = useState<number | null>(null);
  const [lastAddedId, setLastAddedId]     = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/inventory").then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
    fetch("/api/people").then(r => r.json()).then(d => {
      if (d.success) setCustomers(d.data.filter((p: any) => p.type === "CUSTOMER"));
    });

    const draft = localStorage.getItem("draft_quotation");
    if (draft) {
      try {
        const data = JSON.parse(draft);
        if (data.cart) setCart(data.cart);
        if (data.selectedCustomerId) {
          setSelectedCustomerId(data.selectedCustomerId);
          setCustSearch(data.custSearch || "");
        }
        if (data.discount) setDiscount(data.discount);
        if (data.deliveryFee) setDeliveryFee(data.deliveryFee);
        if (data.notes) setNotes(data.notes);
        if (data.expiryDate) setExpiryDate(data.expiryDate);
        if (data.quotationDate) setQuotationDate(data.quotationDate);
      } catch (e) { console.error("Error restoring quotation draft", e); }
    }
  }, []);


  useEffect(() => {
    if (cart.length > 0 || selectedCustomerId || discount !== "0" || deliveryFee !== "0" || notes || expiryDate) {
      const data = { cart, selectedCustomerId, custSearch, discount, deliveryFee, notes, expiryDate, quotationDate };
      localStorage.setItem("draft_quotation", JSON.stringify(data));
    }
  }, [cart, selectedCustomerId, custSearch, discount, deliveryFee, notes, expiryDate, quotationDate]);


  const selectedCustomer = customers.find(c => String(c.id) === selectedCustomerId) || null;
  const filteredCustomersList = customers.filter(c => 
    c.name.includes(custSearch) || (c.phone && c.phone.includes(custSearch))
  );

  const addToCart = (product: Product) => {
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 800);

    const pId          = Number(product.id);
    const currentPrice = Number(product.avgSellPrice) || 0;
    const factor       = Number(product.conversionFactor) || 1;
    const sPrice       = typeof product.secondaryPrice === 'number' ? Number(product.secondaryPrice) : (currentPrice / factor);

    setCart(prev => {
      const existing = prev.find(i => Number(i.productId) === pId);
      if (existing) {
        return prev.map(i => Number(i.productId) === pId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { 
        productId: pId, 
        name: product.name, 
        price: currentPrice, 
        quantity: 1, 
        unitType: 'PRIMARY',
        unit: product.unit || 'وحدة',
        secondaryUnit: product.secondaryUnit,
        conversionFactor: factor,
        primaryPrice: currentPrice,
        secondaryPrice: sPrice
      }];
    });
  };

  const itemsTotal     = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountVal    = parseFloat(discount || "0");
  const deliveryVal    = parseFloat(deliveryFee || "0");
  const netAmount      = itemsTotal + deliveryVal - discountVal;

  const submitQuotation = async () => {
    if (cart.length === 0) return alert("عرض السعر فارغ!");
    setLoading(true);
    const res = await fetch("/api/quotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        personId: selectedCustomerId || null, 
        items: cart, 
        discount: discountVal, 
        deliveryFee: deliveryVal, 
        notes, 
        expiryDate,
        quotationDate
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setLastQuotationId(data.data.id);
      localStorage.removeItem("draft_quotation");
      
      setCart([]);

      setDiscount("0");
      setDeliveryFee("0");
      setNotes("");
      setExpiryDate("");
      setQuotationDate(new Date().toISOString().split('T')[0]);
      setSelectedCustomerId("");
      setCustSearch("");
    } else {
      alert("❌ حدث خطأ أثناء حفظ عرض السعر");
    }
    setLoading(false);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase())
  );

  return (
    <div>
      <h1 style={{ marginBottom: "2rem" }}>إنشاء عرض سعر جديد</h1>

      <div className="split-layout">
        {/* Left Side: Details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          
          {/* Customer Selection */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>👤 بيانات العميل (اختياري)</h3>
            <div className="input-group" style={{ position: 'relative' }}>
              <input 
                type="text" 
                placeholder="ابحث عن عميل..." 
                value={custSearch}
                onChange={e => {
                  setCustSearch(e.target.value);
                  if (selectedCustomerId) setSelectedCustomerId("");
                }}
                className="input-field"
              />
              
              {custSearch && !selectedCustomerId && (
                <div style={{ 
                  position: 'absolute', top: '100%', left: 0, right: 0, 
                  background: 'var(--bg-card)', border: '1px solid var(--accent-color)', 
                  borderRadius: '10px', marginTop: '5px', zIndex: 100, maxHeight: '200px', overflowY: 'auto'
                }}>
                  {filteredCustomersList.map(c => (
                    <div key={c.id} 
                      onClick={() => {
                        setSelectedCustomerId(String(c.id));
                        setCustSearch(c.name);
                      }}
                      style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                      className="hover-item"
                    >
                      <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                      {c.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>📞 {c.phone}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedCustomer && (
              <div style={{ marginTop: '1rem', padding: '14px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '10px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '1.05rem', marginBottom: '8px', color: 'var(--accent-color)' }}>
                  {selectedCustomer.name}
                </div>
                {selectedCustomer.phone && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    📞 {selectedCustomer.phone}
                  </div>
                )}
                {selectedCustomer.address && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    📍 {selectedCustomer.address}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quotation Details */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>📝 تفاصيل العرض</h3>
            <div className="input-group">
              <label>📅 تاريخ العرض</label>
              <input type="date" value={quotationDate} onChange={e => setQuotationDate(e.target.value)} className="input-field" />
            </div>
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>تاريخ الانتهاء (اختياري)</label>
              <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="input-field" />
            </div>
            <div className="input-group" style={{ marginTop: '1rem' }}>
              <label>ملاحظات / البيان</label>
              <textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                className="input-field" 
                rows={3} 
                placeholder="بيان عرض السعر..."
              />
            </div>
          </div>

          {/* Totals */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>💰 الإجماليات</h3>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span>إجمالي الأصناف:</span>
              <span>{fmt(itemsTotal)} ج.م</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="input-group">
                <label>توصيل (+)</label>
                <input type="number" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="input-field" />
              </div>
              <div className="input-group">
                <label>خصم (-)</label>
                <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="input-field" />
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', fontSize: '1.4rem', fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
              <span>الصافي النهائي:</span>
              <span style={{ color: 'var(--accent-color)' }}>{fmt(netAmount)} ج.م</span>
            </div>
            
            <button
               onClick={submitQuotation}
               disabled={loading || cart.length === 0}
               className="btn btn-primary"
               style={{ width: '100%', marginTop: '1.5rem', padding: '15px' }}
            >
              {loading ? "⏳ جاري الحفظ..." : "💾 حفظ عرض السعر"}
            </button>
          </div>
        </div>

        {/* Right Side: Cart and Products */}
        <div>
          {/* Cart Items */}
          {cart.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>🛒 الأصناف المختارة ({cart.length})</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'center' }}>
                    <th style={{ padding: '8px', textAlign: 'right' }}>الصنف</th>
                    <th style={{ padding: '8px' }}>الكمية</th>
                    <th style={{ padding: '8px' }}>السعر</th>
                    <th style={{ padding: '8px' }}>الإجمالي</th>
                    <th style={{ padding: '8px' }}>حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.productId} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                      <td style={{ padding: '8px', textAlign: 'right' }}>{item.name}</td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" step="any"
                          value={item.quantity} 
                          onChange={e => setCart(cart.map(i => i.productId === item.productId ? { ...i, quantity: parseFloat(e.target.value) || 0 } : i))}
                          className="input-field" 
                          style={{ width: '60px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>
                        <input 
                          type="number" 
                          value={item.price} 
                          onChange={e => setCart(cart.map(i => i.productId === item.productId ? { ...i, price: parseFloat(e.target.value) || 0 } : i))}
                          className="input-field" 
                          style={{ width: '80px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '8px' }}>{fmt(item.price * item.quantity)}</td>
                      <td style={{ padding: '8px' }}>
                        <button onClick={() => setCart(cart.filter(i => i.productId !== item.productId))} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Product List */}
          <div className="glass-panel">
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3>📦 المنتجات</h3>
                <input 
                  type="text" 
                  placeholder="بحث سريع..." 
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                  className="input-field"
                  style={{ width: '150px' }}
                />
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', maxHeight: '450px', overflowY: 'auto' }}>
                {filteredProducts.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)}
                    className={`product-card ${lastAddedId === p.id ? 'just-added' : ''}`}
                    style={{ padding: '10px', fontSize: '0.85rem' }}
                  >
                    <strong>{p.name}</strong>
                    <div style={{ opacity: 0.7 }}>{p.avgSellPrice} ج.م</div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {lastQuotationId && (
        <div className="modal-overlay">
          <div className="glass-panel" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h2>تم حفظ عرض السعر!</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '1.5rem' }}>
              <button 
                className="btn btn-primary"
                onClick={() => window.open(`/quotations/${lastQuotationId}/print`, '_blank')}
              >

                🖨️ طباعة عرض السعر
              </button>
              <button 
                className="btn" 
                style={{ background: 'rgba(255,255,255,0.1)' }}
                onClick={() => setLastQuotationId(null)}
              >
                إنشاء عرض جديد
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 1000;
          display: flex; alignItems: center; justifyContent: center;
        }
        .just-added {
          border-color: var(--accent-color) !important;
          animation: pulse 0.5s ease;
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
        .hover-item:hover {
          background: rgba(16,185,129,0.1);
        }
      `}</style>
    </div>
  );
}
