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
  const [paymentMethod, setPaymentMethod] = useState("كاش");
  const [loading, setLoading]             = useState(false);
  const [searchProduct, setSearchProduct] = useState("");
  const [lastInvoiceId, setLastInvoiceId] = useState<number | null>(null);
  const [custSearch, setCustSearch]       = useState("");
  const [lastAddedId, setLastAddedId]     = useState<number | null>(null);

  const searchParams = useSearchParams();
  const fromQuotation = searchParams.get("fromQuotation");
  const urlPersonId   = searchParams.get("personId");

  useEffect(() => {
    fetch("/api/inventory").then(r => r.json()).then(d => { if (d.success) setProducts(d.data); });
    fetch("/api/people").then(r => r.json()).then(d => {
      if (d.success) {
        const custs = d.data.filter((p: any) => p.type === "CUSTOMER");
        setCustomers(custs);
        
        // If personId is in URL, auto select
        if (urlPersonId) {
          const target = custs.find((c: any) => String(c.id) === urlPersonId);
          if (target) {
            setSelectedCustomerId(String(target.id));
            setCustSearch(target.name);
          }
        }
      }
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
      // Restore draft if not coming from a quotation
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
        } catch (e) { console.error("Error restoring sale draft", e); }
      }
    }
  }, [fromQuotation]);

  useEffect(() => {
    if (cart.length > 0 || selectedCustomerId || discount !== "0" || deliveryFee !== "0" || paidAmount !== "0") {
      const data = { cart, selectedCustomerId, custSearch, discount, deliveryFee, paidAmount };
      localStorage.setItem("draft_sale", JSON.stringify(data));
    }
  }, [cart, selectedCustomerId, custSearch, discount, deliveryFee, paidAmount]);


  const selectedCustomer = customers.find(c => String(c.id) === selectedCustomerId) || null;
  const filteredCustomersList = customers.filter(c => 
    c.name.includes(custSearch) || (c.phone && c.phone.includes(custSearch))
  );

  const addToCart = (product: Product) => {
    setLastAddedId(product.id);
    setTimeout(() => setLastAddedId(null), 800);

    const pId          = Number(product.id);
    const currentPrice = typeof product.avgSellPrice === 'number' ? Number(product.avgSellPrice) : 0;
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
        maxQty: 999999,
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
      localStorage.removeItem("draft_sale");
      
      setCart([]);

      setPaidAmount("0");
      setDiscount("0");
      setDeliveryFee("0");
      setSelectedCustomerId("");
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
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
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
                className="input-field"
                style={{ fontSize: '1rem', padding: '12px' }}
              />
              {custSearch && !selectedCustomerId && (
                <div style={{ 
                  position: 'absolute', top: '100%', left: 0, right: 0, 
                  background: 'rgba(23, 23, 27, 0.98)', backdropFilter: 'blur(10px)',
                  border: '1px solid var(--accent-color)', borderRadius: '12px',
                  marginTop: '5px', zIndex: 9999, maxHeight: '200px', overflowY: 'auto'
                }}>
                  {filteredCustomersList.map(c => (
                    <div 
                      key={c.id} 
                      onClick={() => {
                        setSelectedCustomerId(String(c.id));
                        setCustSearch(c.name);
                      }}
                      style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}
                    >
                      <div style={{ fontWeight: 'bold' }}>{c.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCustomer && (
              <div style={{ marginTop: "1rem", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "10px", padding: "14px" }}>
                <strong>{selectedCustomer.name}</strong>
                <div>📞 {selectedCustomer.phone}</div>
              </div>
            )}
          </div>

          <div className="glass-panel">
            <h3 style={{ marginBottom: "1rem" }}>💰 الدفع</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div className="input-group">
                <label>توصيل (+)</label>
                <input type="number" step="0.01" value={deliveryFee} onChange={e => setDeliveryFee(e.target.value)} className="input-field" />
              </div>
              <div className="input-group">
                <label>خصم (-)</label>
                <input type="number" step="0.01" value={discount} onChange={e => setDiscount(e.target.value)} className="input-field" />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", fontSize: "1.2rem", fontWeight: "bold" }}>
              <span>الصافي المطلوب:</span>
              <span>{fmt(totalAmount)} ج.م</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "10px", marginBottom: "12px" }}>
              <div className="input-group">
                <label>المبلغ المدفوع</label>
                <input type="number" step="0.01" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className="input-field" />
              </div>
              <div className="input-group">
                <label>وسيلة الدفع</label>
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-field">
                  <option value="كاش">كاش</option>
                  <option value="انستاباي">انستاباي</option>
                  <option value="اكسيس باي">اكسيس باي</option>
                </select>
              </div>
            </div>
            <button onClick={submitInvoice} disabled={loading || cart.length === 0} className="btn btn-primary" style={{ width: "100%", padding: "16px" }}>
              {loading ? "⏳ جاري التنفيذ..." : "✅ تأكيد وإصدار الفاتورة"}
            </button>
          </div>
        </div>

        <div>
           {cart.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: "1.5rem" }}>
              <h3 style={{ marginBottom: "1rem" }}>🛒 العناصر ({cart.length})</h3>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                    <th style={{ padding: "12px", textAlign: "right" }}>الصنف</th>
                    <th style={{ padding: "12px" }}>الكمية</th>
                    <th style={{ padding: "12px" }}>السعر</th>
                    <th style={{ padding: "12px" }}>الإجمالي</th>
                    <th style={{ padding: "12px" }}>#</th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map(item => (
                    <tr key={item.productId} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }}>
                      <td style={{ padding: "12px", textAlign: "right" }}>{item.name}</td>
                      <td style={{ padding: "12px" }}>
                        <input type="number" value={item.quantity} onChange={e => setCart(cart.map(i => i.productId === item.productId ? { ...i, quantity: parseInt(e.target.value) || 1 } : i))} className="input-field" style={{ width: "60px", textAlign: "center" }} />
                      </td>
                      <td style={{ padding: "12px" }}>
                        <input type="number" value={item.price} onChange={e => setCart(cart.map(i => i.productId === item.productId ? { ...i, price: parseFloat(e.target.value) || 0 } : i))} className="input-field" style={{ width: "80px", textAlign: "center" }} />
                      </td>
                      <td style={{ padding: "12px" }}>{fmt(item.price * item.quantity)}</td>
                      <td style={{ padding: "12px" }}>
                        <button 
                          onClick={() => setCart(cart.filter(i => i.productId !== item.productId))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                          title="حذف"
                        >🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="glass-panel">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3>📦 المنتجات</h3>
              <input type="text" placeholder="بحث..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)} className="input-field" style={{ width: "150px" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", maxHeight: "400px", overflowY: "auto" }}>
              {filteredProducts.map(p => (
                <div key={p.id} onClick={() => addToCart(p)} className="product-card" style={{ padding: '10px' }}>
                  <strong>{p.name}</strong>
                  <div style={{ fontSize: '0.8rem' }}>{p.avgSellPrice} ج.م</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

       {lastInvoiceId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ textAlign: 'center' }}>
             <h2>✅ تم الحفظ!</h2>
             <button onClick={() => window.open(`/invoices/${lastInvoiceId}/print`, '_blank')} className="btn btn-primary">🖨️ طباعة</button>
             <button onClick={() => setLastInvoiceId(null)} className="btn">إغلاق</button>
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
