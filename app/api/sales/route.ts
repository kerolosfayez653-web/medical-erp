import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const maxDuration = 60;

// Generate invoice number: {YearlyCount}-{DailyCount}
async function generateSalesInvoiceNumber(dateToUse: Date, invoiceType: string): Promise<string> {
  const yearStart = new Date(dateToUse.getFullYear(), 0, 1);
  const nextYearStart = new Date(dateToUse.getFullYear() + 1, 0, 1);
  
  const todayStart = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), dateToUse.getDate());
  const tomorrowStart = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), dateToUse.getDate() + 1);

  const yearlyCount = await prisma.invoice.count({
    where: {
      type: invoiceType,
      date: { gte: yearStart, lt: nextYearStart }
    }
  });

  const dailyCount = await prisma.invoice.count({
    where: {
      type: invoiceType,
      date: { gte: todayStart, lt: tomorrowStart }
    }
  });

  const yy = String(dateToUse.getFullYear()).slice(2);
  const mm = String(dateToUse.getMonth() + 1).padStart(2, '0');
  const dd = String(dateToUse.getDate()).padStart(2, '0');
  const prefix = invoiceType === 'SALES' ? 'INV-S' : 'INV-P';
  
  return `${prefix}-${yy}${mm}${dd}${yearlyCount + 1}-${dailyCount + 1}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personId, items, paidAmount, type, discount = 0, deliveryFee = 0, paymentMethod, personPhone, personAddress, invoiceDate, applyVat, applyWht } = body;
    const dateToUse = invoiceDate ? new Date(invoiceDate + 'T00:00:00') : new Date();

    // Validate and Update person contact info if provided
    const person = await prisma.person.findUnique({ where: { id: Number(personId) } });
    if (!person) {
        return NextResponse.json({ success: false, error: 'العميل غير موجود. برجاء تحديث الصفحة (Refresh).' }, { status: 400 });
    }

    // Update person info if changed
    if ((personPhone && personPhone !== person.phone) || (personAddress && personAddress !== person.address)) {
      await prisma.person.update({
        where: { id: Number(personId) },
        data: {
          phone: personPhone || person.phone,
          address: personAddress || person.address
        }
      });
    }

    let itemsTotal = 0;
    for (const item of items) {
      itemsTotal += Number(item.price) * Number(item.quantity);
    }

    const vatAmount = applyVat ? itemsTotal * 0.14 : 0;
    const withholdingTax = applyWht ? itemsTotal * 0.01 : 0;

    const total = itemsTotal + (parseFloat(deliveryFee) || 0) - (parseFloat(discount) || 0) + vatAmount - withholdingTax;
    const paymentStatus = paidAmount >= total ? 'CASH' : (paidAmount > 0 ? 'PARTIAL' : 'CREDIT');
    const remaining = total - paidAmount;
    const invoiceTypeToUse = type || 'SALES';
    const invoiceNumber = await generateSalesInvoiceNumber(dateToUse, invoiceTypeToUse);

    // Pre-fetch all products in ONE query
    const productIds = items.map((i: any) => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    // 0. Pre-calculate COGS using cached products
    let totalCogs = 0;
    for (const item of items) {
      const prod = productMap.get(Number(item.productId));
      if (prod) {
        const factor = Number(prod.conversionFactor) || 1;
        const effectiveQty = item.unitType === 'SECONDARY' ? (parseFloat(item.quantity) || 0) : ((parseFloat(item.quantity) || 0) * factor);
        totalCogs += effectiveQty * (prod.openingWeightedAvg || 0); 
      }
    }

    // 1. Prepare items data using cached products
    const itemsData = items.map((i: any) => {
      const product = productMap.get(Number(i.productId));
      const factor = Number(product?.conversionFactor) || 1;
      const effectiveQty = i.unitType === 'SECONDARY' ? (parseFloat(i.quantity) || 0) : ((parseFloat(i.quantity) || 0) * factor);
      const price = parseFloat(i.price) || 0;
      const qty = parseFloat(i.quantity) || 0;
      return {
        productId: Number(i.productId),
        quantity: effectiveQty,
        unitType: i.unitType || 'PRIMARY',
        price: price,
        total: price * qty,
        totalNet: price * qty 
      };
    });

    // 2. Create Invoice with items
    const invoice = await prisma.invoice.create({
      data: {
        type: invoiceTypeToUse,
        invoiceNumber,
        personId: Number(personId),
        date: dateToUse,
        totalAmount: itemsTotal,
        netAmount: total,
        paidAmount: parseFloat(paidAmount) || 0,
        paymentStatus,
        discount: parseFloat(discount) || 0,
        deliveryFee: parseFloat(deliveryFee) || 0,
        vatAmount,
        withholdingTax,
        cogs: totalCogs,
        items: {
          create: itemsData
        }
      }
    });

    // 3. Update Person Balance
    const balanceChange = person.type === 'CUSTOMER' ? remaining : -remaining;
    await prisma.person.update({
      where: { id: Number(personId) },
      data: { currentBalance: { increment: balanceChange } }
    });

    // 4. Add Payment Record
    if (paidAmount > 0) {
      await prisma.payment.create({
        data: {
          personId: Number(personId),
          invoiceId: invoice.id,
          amount: parseFloat(paidAmount),
          type: 'IN',
          method: paymentMethod || 'كاش',
          date: dateToUse,
          notes: 'دفعة من فاتورة المبيعات'
        }
      });
    }

    // 5. Update Inventory Quantities (خصم المخزون - FIFO Batch)
    const allLots = await prisma.inventoryLot.findMany({
      where: {
        productId: { in: productIds },
        quantity: { gt: 0 }
      },
      orderBy: { expiryDate: 'asc' }
    });

    const lotsByProduct = new Map<number, typeof allLots>();
    for (const lot of allLots) {
      if (!lotsByProduct.has(lot.productId)) {
        lotsByProduct.set(lot.productId, []);
      }
      lotsByProduct.get(lot.productId)!.push(lot);
    }

    const deficitLots: any[] = [];

    for (const i of items) {
      const product = productMap.get(Number(i.productId));
      if (!product) continue;

      const factor = Number(product.conversionFactor) || 1;
      const effectiveQty = i.unitType === 'SECONDARY' ? (parseFloat(i.quantity) || 0) : ((parseFloat(i.quantity) || 0) * factor);

      let qtyNeeded = effectiveQty;
      if (qtyNeeded > 0) {
        const productLots = lotsByProduct.get(product.id) || [];
        for (const lot of productLots) {
          if (qtyNeeded <= 0) break;
          if (lot.quantity <= 0) continue;

          const deduction = Math.min(lot.quantity, qtyNeeded);
          lot.quantity -= deduction;
          await prisma.inventoryLot.update({
            where: { id: lot.id },
            data: { quantity: { decrement: deduction } }
          });
          qtyNeeded -= deduction;
        }

        if (qtyNeeded > 0) {
          deficitLots.push({
            productId: product.id,
            batchNumber: 'DEFICIT',
            expiryDate: new Date('2099-12-31'),
            quantity: -qtyNeeded,
            costPrice: 0,
            sellingPrice: 0
          });
        }
      } else if (qtyNeeded < 0) {
        const productLots = lotsByProduct.get(product.id) || [];
        if (productLots.length > 0) {
          await prisma.inventoryLot.update({
            where: { id: productLots[0].id },
            data: { quantity: { increment: Math.abs(qtyNeeded) } }
          });
        }
      }
    }

    if (deficitLots.length > 0) {
      await prisma.inventoryLot.createMany({
        data: deficitLots
      });
    }

    return NextResponse.json({ success: true, data: invoice, invoiceNumber });
  } catch (error: any) {
    console.error('Invoice Error: ', error);
    return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 });
  }
}
