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

    // Pre-fetch all products in ONE query instead of fetching each one 3 times
    const productIds = items.map((i: any) => Number(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const result = await prisma.$transaction(async (tx) => {
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

      // 1. Prepare items data using cached products (no DB calls needed)
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

      // 2. Create Invoice with pre-built items
      const invoice = await tx.invoice.create({
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

      // 3. Update Person Balance (الديون)
      const txPerson = await tx.person.findUnique({ where: { id: Number(personId) } });
      const balanceChange = txPerson?.type === 'CUSTOMER' ? remaining : -remaining;
      await tx.person.update({
        where: { id: Number(personId) },
        data: { currentBalance: { increment: balanceChange } }
      });

      // 4. Add Payment Record (سند القبض)
      if (paidAmount > 0) {
        await tx.payment.create({
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

      // 5. Update Inventory Quantities (خصم المخزون - FIFO)
      for (const i of items) {
        const product = productMap.get(Number(i.productId));
        if (!product) continue;

        const factor = Number(product.conversionFactor) || 1;
        const effectiveQty = i.unitType === 'SECONDARY' ? (parseFloat(i.quantity) || 0) : ((parseFloat(i.quantity) || 0) * factor);
        
        let qtyNeeded = effectiveQty;
        if (qtyNeeded > 0) {
          const lots = await tx.inventoryLot.findMany({
            where: { productId: product.id, quantity: { gt: 0 } },
            orderBy: { expiryDate: 'asc' }
          });
          for (const lot of lots) {
            if (qtyNeeded <= 0) break;
            const deduction = Math.min(lot.quantity, qtyNeeded);
            await tx.inventoryLot.update({
              where: { id: lot.id },
              data: { quantity: { decrement: deduction } }
            });
            qtyNeeded -= deduction;
          }
        } else if (qtyNeeded < 0) {
          const firstLot = await tx.inventoryLot.findFirst({
            where: { productId: product.id },
            orderBy: { expiryDate: 'asc' }
          });
          if (firstLot) {
            await tx.inventoryLot.update({
              where: { id: firstLot.id },
              data: { quantity: { increment: Math.abs(qtyNeeded) } }
            });
            qtyNeeded = 0;
          }
        }

        if (qtyNeeded > 0) {
           await tx.inventoryLot.create({
             data: {
               productId: product.id,
               batchNumber: 'DEFICIT',
               expiryDate: new Date('2099-12-31'),
               quantity: -qtyNeeded,
               costPrice: 0,
               sellingPrice: 0
             }
           });
        }
      }

      return invoice;
    }, { timeout: 30000 });

    return NextResponse.json({ success: true, data: result, invoiceNumber });
  } catch (error: any) {
    console.error('Invoice Error: ', error);
    return NextResponse.json({ success: false, error: 'Server error', details: error.message }, { status: 500 });
  }
}
