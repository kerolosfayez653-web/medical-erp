"use client";
import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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

function SalesPageContent() {
  const [products, setProducts]           = useState<Product[]>([]);
  const [customers, setCustomers]         = useState<Person[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [cart, setCart]                   = useState<any[]>([]);
  const [paidAmount, setPaidAmount]       = useState("0");
  const [discount, setDiscount]           = useState("0");
  const [deliveryFee, setDeliveryFee]     = useState("0");
  const [invoiceDate, setInvoiceDate]     = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState("كاش");
  const [loading, setLoading]             = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [lastInvoiceId, setLastInvoiceId] = useState<number | null>(null);
  const [custSearch, setCustSearch]       = useState("");
  const [personPhone, setPersonPhone]     = useState("");
  const [personAddress, setPersonAddress] = useState("");
  const [editingContact, setEditingContact] = useState(false);
  const [lastAddedId, setLastAddedId]     = useState<number | null>(null);

  const searchParams = useSearchParams();
  const fromQuotation = searchParams.get("fromQuotation");

  useEffect(() => {
    fetch("/api/inventory").then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
    fetch("/api/people").then(r => r.json()).then(d => {
      if (d.success) setCustomers(d.data.filter((p: any) => p.type === "CUSTOMER"));
    });

    if (fromQuotation) {
      fetch(`/api/quotations/${fromQuotation}`).then(r => r.json()).then(d => {
        if (d.success) {
          const q = d.data;
          setSelectedCustomerId(String(q.personId || ""));
          setCustSearch(q.person?.name || "");
          setDiscount(String(q.discount));
          setDeliveryFee(String(q.deliveryFee));
          
          const newCart = q.items.map((i: any) => ({
            productId: i.productId,
            name: i.product?.name,
            price: i.price,
            quantity: i.quantity,
            maxQty: 999999,
            unitType: i.unitType || 'PRIMARY',
            unit: i.product?.unit || 'وحدة',
            secondaryUnit: i.product?.secondaryUnit,
            conversionFactor: i.product?.conversionFactor || 1,
            primaryPrice: i.product?.avgSellPrice || i.price,
            secondaryPrice: i.product?.secondaryPrice || (i.product?.avgSellPrice / (i.product?.conversionFactor || 1)) || i.price
          }));
          setCart(newCart);
        }
      });
    } else {
      const draft = localStorage.getItem("draft_sale");
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
          if (data.paidAmount) setPaidAmount(data.paidAmount);
          if (data.invoiceDate) setInvoiceDate(data.invoiceDate);
        } catch (e) { console.error("Error restoring sale draft", e); }
      }
    }
  }, [fromQuotation]);

  useEffect(() => {
    if (cart.length > 0 || selectedCustomerId || discount !== "0" || deliveryFee !== "0" || paidAmount !== "0") {
      const data = { cart, selectedCustomerId, custSearch, discount, deliveryFee, paidAmount, invoiceDate };
      localStorage.setItem("draft_sale", JSON.stringify(data));
    }
  }, [cart, selectedCustomerId, custSearch, discount, deliveryFee, paidAmount, invoiceDate]);

  const selectedCustomer = customers.find(c => String(c.id) === selectedCustomerId) || null;

  useEffect(() => {
    if (selectedCustomer) {
      setPersonPhone(selectedCustomer.phone || "");
      setPersonAddress(selectedCustomer.address || "");
      setEditingContact(false);
    } else {
      setPersonPhone("");
      setPersonAddress("");
    }
  }, [selectedCustomer]);

  // Validate selected customer (clear if deleted/stale)

  useEffect(() => {
    if (customers.length > 0 && selectedCustomerId) {
      const exists = customers.some(c => String(c.id) === selectedCustomerId);
      if (!exists) {
        console.warn("Customer ID not found in database, clearing stale selection.");
        setSelectedCustomerId("");
        setCustSearch("");
      }
    }
  }, [customers, selectedCustomerId]);
  const normalizeText = (text: string) => 
    text?.toLowerCase()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .trim() || "";

  const filteredCustomersList = customers.filter(c => {
    const search = normalizeText(custSearch);
    return normalizeText(c.name).includes(search) || (c.phone && c.phone.includes(search));
  });

  const addToCart = (product: Product) => {
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 800);

    const pId          = Number(product.id);
    const existing     = cart.find(i => Number(i.productId) === pId);
    
    if (existing) {
      setCart(cart.map(i => Number(i.productId) === pId ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      const currentPrice = typeof product.avgSellPrice === 'number' ? Number(product.avgSellPrice) : 0;
      const factor       = Number(product.conversionFactor) || 1;
      const sPrice       = typeof product.secondaryPrice === 'number' ? Number(product.secondaryPrice) : (currentPrice / factor);

      setCart([...cart, { 
        productId: pId, 
        name: product.name, 
        price: currentPrice, 
        quantity: 1, 
        maxQty: 999999,
        unitType: 'PRIMARY',
        unit: product.unit || 'وحدة',
        secondaryUnit: product.secondaryUnit,
        conversionFactor: factor,
        primaryPrice: currentPrice,
        secondaryPrice: sPrice
      }]);
    }
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
      body: JSON.stringify({ type: "SALES", personId: selectedCustomerId, items: cart, paidAmount: paid, discount: discountVal, deliveryFee: deliveryVal, paymentMethod, personPhone, personAddress, invoiceDate }),
    });
    if (res.ok) {
      const data = await res.json();
      setLastInvoiceId(data.data.id);
      localStorage.removeItem("draft_sale");
      
      setCart([]);
      setPaidAmount("0");
      setDiscount("0");
      setDeliveryFee("0");
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setSelectedCustomerId("");
      fetch("/api/inventory").then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
    } else {
      const errorData = await res.json();
      alert(`❌ حدث خطأ: ${errorData.error || errorData.details || "غير معروف"}`);
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
          
          {/* Customer Selector */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>👤 بيانات العميل</h3>
            <div className="input-group" style={{ position: 'relative' }}>
              <label>👤 ابحث عن عميل واختاره</label>
              <input 
                type="text" 
                placeholder="اكتب اسم العميل أو رقم الهاتف..." 
                value={custSearch}
                onChange={e => {
                  setCustSearch(e.target.value);
                  if (selectedCustomerId) setSelectedCustomerId("");
                }}
                onFocus={() => {
                  if (selectedCustomer) setCustSearch("");
                }}
                className="input-field"
                style={{ fontSize: '1rem', padding: '12px' }}
              />
              {custSearch && !selectedCustomerId && (
                <div style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, 
                    background: 'rgba(23, 23, 27, 0.98)', backdropFilter: 'blur(10px)',
                    border: '1px solid var(--accent-color)', borderRadius: '12px',
                    marginTop: '5px', zIndex: 9999, maxHeight: '200px', overflowY: 'auto',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                  {filteredCustomersList.length === 0 ? (
                    <div style={{ padding: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>لا توجد نتائج</div>
                  ) : (
                    filteredCustomersList.map(c => (
                      <div 
                        key={c.id} 
                        onClick={() => {
                          setSelectedCustomerId(String(c.id));
                          setCustSearch(c.name);
                        }}
                        style={{ 
                          padding: '12px', 
                          borderBottom: '1px solid rgba(255,255,255,0.05)', 
                          cursor: 'pointer', 
                          transition: '0.2s',
                          color: '#fff'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                        {c.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.phone}</div>}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Customer Info Card */}
            {selectedCustomer && (
              <div style={{ marginTop: "1rem", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontWeight: "bold", fontSize: "1.05rem", color: "var(--accent-color)" }}>
                    {selectedCustomer.name}
                  </div>
                  <button 
                    onClick={() => setEditingContact(!editingContact)}
                    style={{ 
                      background: editingContact ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)', 
                      border: '1px solid ' + (editingContact ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.15)'), 
                      color: editingContact ? 'var(--danger-color)' : 'var(--text-secondary)', 
                      borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem',
                      transition: '0.2s'
                    }}
                  >
                    {editingContact ? '✕ إلغاء' : '✏️ تعديل'}
                  </button>
                </div>

                {editingContact ? (
                  /* Editing Mode */
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '2px' }}>📞 رقم الهاتف</label>
                        <input 
                          type="text" 
                          placeholder="01xxxxxxxxx"
                          value={personPhone} 
                          onChange={e => setPersonPhone(e.target.value)} 
                          className="input-field" 
                          style={{ padding: '8px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)' }} 
                        />
                      </div>
                      <div className="input-group" style={{ marginBottom: 0 }}>
                        <label style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '2px' }}>📍 العنوان</label>
                        <input 
                          type="text" 
                          placeholder="العنوان التفصيلي..."
                          value={personAddress} 
                          onChange={e => setPersonAddress(e.target.value)} 
                          className="input-field" 
                          style={{ padding: '8px', fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)' }} 
                        />
                      </div>
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--success-color)', opacity: 0.8 }}>
                      💡 سيتم حفظ التعديلات في سجل العميل تلقائياً عند إصدار الفاتورة
                    </div>
                  </div>
                ) : (
                  /* Display Mode */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {personPhone ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>📞 {personPhone}</div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>📞 لا يوجد رقم هاتف — اضغط تعديل لإضافته</div>
                    )}
                    {personAddress ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>📍 {personAddress}</div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>📍 لا يوجد عنوان — اضغط تعديل لإضافته</div>
                    )}
                  </div>
                )}
                {selectedCustomer.currentBalance !== 0 && (
                  <div style={{ fontSize: "0.85rem", marginTop: "6px", padding: "4px 8px", background: "rgba(239,68,68,0.15)", borderRadius: "6px" }}>
                    💳 مديونية حالية:{" "}
                    <strong style={{ color: "var(--danger-color)" }}>
                      {fmt(Math.abs(selectedCustomer.currentBalance))} ج.م
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
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>💰 الدفع</h3>
            
            <div className="input-group" style={{ marginBottom: '12px' }}>
              <label>📅 تاريخ الفاتورة</label>
              <input 
                type="date" 
                value={invoiceDate} 
                onChange={e => setInvoiceDate(e.target.value)} 
                className="input-field" 
                style={{ padding: '8px', fontSize: '0.95rem' }}
              />
            </div>
            
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
                  style={{ borderColor: "var(--accent-color)", fontSize: "1.1rem" }}
                />
              </div>
              <div className="input-group">
                <label>وسيلة الدفع</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field" style={{ padding: "6px" }}>
                  <option value="كاش">كاش</option>
                  <option value="انستاباي">انستاباي</option>
                  <option value="اكسيس باي">اكسيس باي</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", color: remaining > 0 ? "var(--danger-color)" : "var(--success-color)" }}>
              <span>{remaining > 0 ? "المتبقي (يسجل آجل):" : "✅ مدفوع بالكامل"}</span>
              <strong>{remaining > 0 ? fmt(remaining) + " ج.م" : ""}</strong>
            </div>

            <button onClick={submitInvoice} disabled={loading || cart.length === 0} className="btn btn-primary" style={{ width: "100%", fontSize: "1.1rem", padding: "16px" }}>
              {loading ? "⏳ جاري التنفيذ..." : "✅ تأكيد وإصدار الفاتورة"}
            </button>
          </div>
        </div>

        {/* ── Right Panel: Cart + Products ── */}
        <div>
           {/* Cart Table */}
           {cart.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: "1.5rem", border: "1px solid var(--accent-color)", padding: "16px" }}>
              <h3 style={{ marginBottom: "1rem", color: "var(--accent-color)" }}>🛒 أصناف الفاتورة ({cart.length})</h3>
              <div className="table-responsive">
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                  <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)", textAlign: "center" }}>
                      <th style={{ padding: "12px", textAlign: "right", color: 'var(--accent-color)' }}>الصنف</th>
                      <th style={{ padding: "12px" }}>الكمية</th>
                      <th style={{ padding: "12px" }}>السعر</th>
                      <th style={{ padding: "12px" }}>الإجمالي</th>
                      <th style={{ padding: "12px" }}>حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map(item => (
                      <tr key={item.productId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                        <td style={{ padding: "12px", fontWeight: "bold", textAlign: "right" }}>{item.name}</td>
                        <td style={{ padding: "12px" }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                            <input type="number" value={item.quantity} onChange={e => setCart(cart.map(i => i.productId === item.productId ? { ...i, quantity: parseInt(e.target.value) || 1 } : i))} className="input-field" style={{ width: "60px", textAlign: "center", padding: "4px" }} />
                            <select 
                              value={item.unitType}
                              onChange={e => {
                                const newType = e.target.value;
                                const newPrice = newType === 'SECONDARY' ? item.secondaryPrice : item.primaryPrice;
                                setCart(cart.map(i => i.productId === item.productId ? { ...i, unitType: newType, price: newPrice } : i));
                              }}
                              style={{ fontSize: '0.75rem', padding: '2px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                            >
                              <option value="PRIMARY">{item.unit || 'وحدة'}</option>
                              {item.secondaryUnit && <option value="SECONDARY">{item.secondaryUnit}</option>}
                            </select>
                          </div>
                        </td>
                        <td style={{ padding: "12px" }}>
                          <input type="number" value={item.price} onChange={e => setCart(cart.map(i => i.productId === item.productId ? { ...i, price: parseFloat(e.target.value) || 0 } : i))} className="input-field" style={{ width: "80px", textAlign: "center", padding: "4px" }} />
                        </td>
                        <td style={{ padding: "12px", fontWeight: "bold", color: 'var(--success-color)' }}>{fmt(item.price * item.quantity)}</td>
                        <td style={{ padding: "12px" }}>
                          <button onClick={() => setCart(cart.filter(i => i.productId !== item.productId))}
                            style={{ background: "transparent", color: "var(--danger-color)", border: "none", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
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
              <h3 style={{ margin: 0 }}>📦 الأصناف المتاحة</h3>
              <input 
                type="text" placeholder="🔍 بحث عن صنف..." 
                value={searchProduct} onChange={e => setSearchProduct(e.target.value)} 
                className="input-field" style={{ width: "180px" }} 
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px", maxHeight: "450px", overflowY: "auto" }}>
              {filteredProducts.map(p => {
                const inCart = cart.find(i => Number(i.productId) === Number(p.id));
                const isJustAdded = lastAddedId === p.id;
                return (
                  <div 
                    key={p.id} 
                    onClick={() => addToCart(p)} 
                    className={`product-card ${inCart ? 'in-cart' : ''}`}
                    style={isJustAdded ? { transform: 'scale(0.9)', borderColor: 'var(--accent-color)', boxShadow: '0 0 20px var(--accent-color)' } : {}}
                  >
                    <strong style={{ display: "block", marginBottom: "6px", fontSize: "0.85rem", lineHeight: "1.3" }}>{p.name}</strong>
                    <div style={{ fontSize: "0.78rem", color: "var(--accent-color)", fontWeight: "bold" }}>{p.avgSellPrice} ج.م</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>المخزون: {p.currentQty}</div>
                    
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                       {inCart ? (
                         <span style={{ fontSize: "0.72rem", color: "var(--accent-color)" }}>✓ ({inCart.quantity})</span>
                       ) : (
                         <span style={{ fontSize: "0.72rem", opacity: 0.6 }}>أضف للسلة</span>
                       )}
                       <span style={{ fontSize: '1.1rem', color: isJustAdded ? 'var(--success-color)' : 'var(--accent-color)' }}>{isJustAdded ? '✔' : '＋'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

       {/* Success Modal */}
       {lastInvoiceId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
          <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', border: '1px solid var(--accent-color)' }}>
             <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
             <h2 style={{ marginBottom: '1rem' }}>تم حفظ الفاتورة بنجاح!</h2>
             <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
               <button onClick={() => window.open(`/invoices/${lastInvoiceId}/print`, '_blank')} className="btn btn-primary" style={{ padding: '12px 30px' }}>🖨️ طباعة الفاتورة</button>
               <button onClick={() => setLastInvoiceId(null)} className="btn" style={{ padding: '12px 30px' }}>إغلاق</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>جاري التحميل...</div>}>
      <SalesPageContent />
    </Suspense>
  );
}
