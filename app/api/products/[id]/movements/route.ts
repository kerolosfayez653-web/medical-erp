import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const productId = parseInt(id);

    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Get all movements (InvoiceItems linked to active invoices)
    const items = await prisma.invoiceItem.findMany({
      where: { 
        productId: productId,
        invoice: { isDeleted: false }
      },
      include: {
        invoice: {
          include: { person: true }
        }
      },
      orderBy: { invoice: { date: 'asc' } }
    });

    type MovementEntry = {
      date: Date;
      type: 'OPENING' | 'SALE' | 'PURCHASE' | 'SALE_RETURN' | 'PURCHASE_RETURN';
      docNumber: string;
      personName: string;
      qtyIn: number;
      qtyOut: number;
      balance: number;
      price: number;
      unitType: string;
      invoiceId?: number;
    };

    const movements: MovementEntry[] = [];

    // 1. Opening Balance (as of 1/1/2026)
    let currentBalance = product.openingQty;
    movements.push({
      date: new Date('2026-01-01'),
      type: 'OPENING',
      docNumber: '---',
      personName: 'رصيد أول المدة',
      qtyIn: product.openingQty,
      qtyOut: 0,
      balance: currentBalance,
      price: product.openingWeightedAvg,
      unitType: 'SECONDARY'
    });

    // 2. Map items to movements
    for (const item of items) {
      const type = item.invoice.type;
      let qtyIn = 0;
      let qtyOut = 0;

      const factor = product.conversionFactor || 1;
      const getEffQty = (it: any) => {
        if (it.unitType === 'SECONDARY') return it.quantity;
        // SMART DETECTION: Check if quantity was already normalized (e.g. 100 instead of 1)
        // If price * quantity > (very high threshold or totalNet mismatch), it needs normalization
        // But for display consistency, we trust the DB 'quantity' which we've been fixing to be BASE UNITS (Pieces)
        // Actually, the new logic expects pieces in the DB.
        return it.quantity; 
      };

      const effQty = getEffQty(item);

      if (type === 'SALES') {
        qtyOut = effQty;
        currentBalance -= qtyOut;
      } else if (type === 'PURCHASES') {
        qtyIn = effQty;
        currentBalance += qtyIn;
      } else if (type === 'SALES_RETURN') {
        qtyIn = effQty;
        currentBalance += qtyIn;
      } else if (type === 'PURCHASES_RETURN') {
        qtyOut = effQty;
        currentBalance -= qtyOut;
      }

      movements.push({
        date: item.invoice.date,
        type: type as any,
        docNumber: item.invoice.invoiceNumber || `#${item.invoice.id}`,
        personName: item.invoice.person?.name || '---',
        qtyIn,
        qtyOut,
        balance: currentBalance,
        price: item.price,
        unitType: item.unitType,
        invoiceId: item.invoice.id
      });
    }

    // Sort by date then by docNumber for consistency
    movements.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Recalculate running balance correctly after sorting
    let running = 0;
    for (const m of movements) {
      if (m.type === 'OPENING') {
         running = m.qtyIn;
      } else {
         running += (m.qtyIn - m.qtyOut);
      }
      m.balance = running;
    }

    return NextResponse.json({
      success: true,
      product,
      movements: movements.reverse(), // Show newest first in table
      summary: {
        opening: product.openingQty,
        totalIn: movements.reduce((s, m) => s + (m.type !== 'OPENING' ? m.qtyIn : 0), 0),
        totalOut: movements.reduce((s, m) => s + m.qtyOut, 0),
        current: running
      }
    });

  } catch (error) {
    console.error('Movement API Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
