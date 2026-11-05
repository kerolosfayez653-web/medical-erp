import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const maxDuration = 60;

// Generate invoice number: {YearlyCount}-{DailyCount}
async function generatePurchaseInvoiceNumber(dateToUse: Date, invoiceType: string): Promise<string> {
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
    const { personId, items, paidAmount, discount = 0, deliveryFee = 0, paymentMethod, invoiceDate, applyVat, applyWht } = body;
    const dateToUse = invoiceDate ? new Date(invoiceDate + 'T00:00:00') : new Date();

    let itemsTotal = 0;
    for (const item of items) {
      itemsTotal += Number(item.price) * Number(item.quantity);
    }

    const vatAmount = applyVat ? itemsTotal * 0.14 : 0;
    const withholdingTax = applyWht ? itemsTotal * 0.01 : 0;

    const total = itemsTotal + (parseFloat(deliveryFee) || 0) - (parseFloat(discount) || 0) + vatAmount - withholdingTax;
    const paymentStatus = paidAmount >= total ? 'CASH' : (paidAmount > 0 ? 'PARTIAL' : 'CREDIT');
    const remaining = total - paidAmount;
    const invoiceNumber = await generatePurchaseInvoiceNumber(dateToUse, 'PURCHASES');

    // Pre-fetch all products in ONE query
    const productIds = items.map((i: any) => parseInt(i.productId));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });
    const productMap = new Map(products.map(p => [p.id, p]));

    const result = await prisma.$transaction(async (tx) => {
      // 1. Prepare items data using cached products
      const itemsData = items.map((i: any) => {
        const product = productMap.get(parseInt(i.productId));
        const factor = product?.conversionFactor || 1;
        const effectiveQty = i.unitType === 'SECONDARY' ? (parseFloat(i.quantity) || 0) : ((parseFloat(i.quantity) || 0) * factor);
        const price = parseFloat(i.price) || 0;
        const qty = parseFloat(i.quantity) || 0;
        return {
          productId: parseInt(i.productId),
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
          type: 'PURCHASES',
          invoiceNumber,
          personId: personId ? parseInt(personId) : null,
          date: dateToUse,
          totalAmount: itemsTotal,
          netAmount: total,
          paidAmount: parseFloat(paidAmount) || 0,
          paymentStatus,
          discount: parseFloat(discount) || 0,
          deliveryFee: parseFloat(deliveryFee) || 0,
          vatAmount,
          withholdingTax,
          items: {
            create: itemsData
          }
        }
      });

      // 3. Update Supplier Balance
      if (personId) {
        const person = await tx.person.findUnique({ where: { id: parseInt(personId) } });
        const balanceChange = person?.type === 'SUPPLIER' ? remaining : -remaining;
        await tx.person.update({
          where: { id: parseInt(personId) },
          data: { currentBalance: { increment: balanceChange } }
        });
      }

      // 4. Add Payment Record
      if (paidAmount > 0 && personId) {
        await tx.payment.create({
          data: {
            personId: parseInt(personId),
            invoiceId: invoice.id,
            amount: parseFloat(paidAmount),
            type: 'OUT',
            method: paymentMethod || 'كاش',
            date: dateToUse,
            notes: 'تسديد دفعة من المشتريات'
          }
        });
      }

      // 5. Update Inventory - Batch add new lots
      const newLots: any[] = [];
      const returnLotsToUpdate: Promise<any>[] = [];

      for (const item of items) {
        const product = productMap.get(parseInt(item.productId));
        const factor = product?.conversionFactor || 1;
        const effectiveQty = item.unitType === 'SECONDARY' ? (parseFloat(item.quantity) || 0) : ((parseFloat(item.quantity) || 0) * factor);

        if (effectiveQty > 0) {
          newLots.push({
            productId: parseInt(item.productId),
            batchNumber: item.batchNumber || `PB-${invoice.id}`,
            expiryDate: item.expiryDate ? new Date(item.expiryDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            quantity: effectiveQty,
            costPrice: parseFloat(item.price) || 0,
            sellingPrice: parseFloat(item.sellingPrice) || (parseFloat(item.price) || 0) * 1.25,
          });
        }
      }

      // Insert all positive lots in ONE query
      if (newLots.length > 0) {
        await tx.inventoryLot.createMany({
          data: newLots
        });
      }

      // Handle purchase returns if any
      const returnItems = items.filter((i: any) => {
        const product = productMap.get(parseInt(i.productId));
        const factor = product?.conversionFactor || 1;
        const effectiveQty = i.unitType === 'SECONDARY' ? (parseFloat(i.quantity) || 0) : ((parseFloat(i.quantity) || 0) * factor);
        return effectiveQty < 0;
      });

      if (returnItems.length > 0) {
        for (const item of returnItems) {
          const product = productMap.get(parseInt(item.productId));
          const factor = product?.conversionFactor || 1;
          const effectiveQty = item.unitType === 'SECONDARY' ? (parseFloat(item.quantity) || 0) : ((parseFloat(item.quantity) || 0) * factor);
          let qtyToReduce = Math.abs(effectiveQty);
          
          const lots = await tx.inventoryLot.findMany({
            where: { productId: parseInt(item.productId), quantity: { gt: 0 } },
            orderBy: { id: 'desc' }
          });
          for (const lot of lots) {
            if (qtyToReduce <= 0) break;
            const reduction = Math.min(lot.quantity, qtyToReduce);
            returnLotsToUpdate.push(
              tx.inventoryLot.update({
                where: { id: lot.id },
                data: { quantity: { decrement: reduction } }
              })
            );
            qtyToReduce -= reduction;
          }
        }
        if (returnLotsToUpdate.length > 0) {
          await Promise.all(returnLotsToUpdate);
        }
      }

      return invoice;
    }, {
      maxWait: 15000,
      timeout: 30000
    });

    return NextResponse.json({ success: true, data: result, invoiceNumber });
  } catch (error) {
    console.error('Purchase Error: ', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
