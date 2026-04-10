import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const personId = parseInt(id);

    const person = await prisma.person.findUnique({
      where: { id: personId }
    });
    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Get all invoices for this person
    const invoices = await prisma.invoice.findMany({
      where: { personId },
      include: {
        items: {
          include: { product: { select: { name: true, unit: true, secondaryUnit: true, conversionFactor: true } } }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Get all payments
    const payments = await prisma.payment.findMany({
      where: { personId },
      orderBy: { date: 'asc' }
    });

    // Build unified statement with running balance
    type Entry = {
      date: Date;
      type: 'INVOICE' | 'PAYMENT';
      invoiceId?: number;
      invoiceNumber?: string | null;
      invoiceType?: string;
      description: string;
      debit: number;    // مدين (مبلغ على العميل / مستحق لنا)
      credit: number;   // دائن (مبلغ دفعه العميل / نسدد للمورد)
      balance: number;  // رصيد مستمر
      totalAmount?: number;
      netAmount?: number;
      discount?: number;
      deliveryFee?: number;
      paidAmount?: number;
      paymentMethod?: string | null;
      items?: Array<{ name: string; quantity: number; unitType: string; product: any; price: number; total: number }>;
    };

    const entries: Entry[] = [];

    // Opening balance entry
    if (person.initialBalance !== 0) {
      const isCustomer = person.type === 'CUSTOMER';
      entries.push({
        date: new Date('2025-01-01'), // Fixed very early date for initial balance
        type: 'INVOICE',
        description: 'رصيد أول المدة (سابق)',
        // Positive initialBalance: Customer owes us (Debit) / We owe Supplier (Credit)
        debit: isCustomer 
          ? (person.initialBalance > 0 ? person.initialBalance : 0)
          : (person.initialBalance < 0 ? Math.abs(person.initialBalance) : 0),
        credit: isCustomer
          ? (person.initialBalance < 0 ? Math.abs(person.initialBalance) : 0)
          : (person.initialBalance > 0 ? person.initialBalance : 0),
        balance: 0,
      });
    }

    // Merge invoices and payments into timeline
    const allEvents: Array<{ date: Date; isInvoice: boolean; data: any }> = [
      ...invoices.map(inv => ({ date: inv.date, isInvoice: true, data: inv })),
      ...payments.map(pay => ({ date: pay.date, isInvoice: false, data: pay })),
    ].sort((a, b) => {
      // Primary sort by date
      const dateDiff = a.date.getTime() - b.date.getTime();
      if (dateDiff !== 0) return dateDiff;
      // Secondary sort: Invoices before Payments on the same day
      if (a.isInvoice && !b.isInvoice) return -1;
      if (!a.isInvoice && b.isInvoice) return 1;
      return 0;
    });

    for (const event of allEvents) {
      if (event.isInvoice) {
        const inv = event.data;
        const methodStr = inv.paymentMethod ? ` (${inv.paymentMethod})` : '';

        if (inv.type === 'SALES') {
          // Sales invoice: customer owes us → debit based on netAmount
          entries.push({
            date: inv.date,
            type: 'INVOICE',
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceType: inv.type,
            description: `فاتورة مبيعات ${inv.invoiceNumber || '#' + inv.id}${methodStr}`,
            debit: inv.netAmount,
            credit: 0,
            balance: 0,
            totalAmount: inv.totalAmount,
            netAmount: inv.netAmount,
            discount: inv.discount,
            deliveryFee: inv.deliveryFee,
            paidAmount: inv.paidAmount,
            paymentMethod: inv.paymentMethod,
            items: inv.items.map((i: any) => ({
              id: i.id,
              name: i.product.name,
              quantity: i.quantity,
              unitType: i.unitType,
              product: i.product,
              price: i.price,
              total: i.total,
            })),
          });
        } else if (inv.type === 'PURCHASES') {
          // Purchase invoice: we owe supplier → credit based on netAmount
          entries.push({
            date: inv.date,
            type: 'INVOICE',
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            invoiceType: inv.type,
            description: `فاتورة مشتريات ${inv.invoiceNumber || '#' + inv.id}${methodStr}`,
            debit: 0,
            credit: inv.netAmount,
            balance: 0,
            totalAmount: inv.totalAmount,
            netAmount: inv.netAmount,
            discount: inv.discount,
            deliveryFee: inv.deliveryFee,
            paidAmount: inv.paidAmount,
            paymentMethod: inv.paymentMethod,
            items: inv.items.map((i: any) => ({
              id: i.id,
              name: i.product.name,
              quantity: i.quantity,
              unitType: i.unitType,
              product: i.product,
              price: i.price,
              total: i.total,
            })),
          });
        }
      } else {
        const pay = event.data;
        const methodStr = pay.method ? ` (${pay.method})` : '';
        if (pay.type === 'IN') {
          // Money incoming (Collection from Customer) → Credit
          entries.push({
            date: pay.date,
            type: 'PAYMENT',
            description: (pay.notes || 'تحصيل من عميل') + methodStr,
            debit: 0,
            credit: pay.amount,
            balance: 0,
          });
        } else {
          // Money outgoing (Payment to Supplier) → Debit
          entries.push({
            date: pay.date,
            type: 'PAYMENT',
            description: (pay.notes || 'دفعة لمورد') + methodStr,
            debit: pay.amount,
            credit: 0,
            balance: 0,
          });
        }
      }
    }

    // Compute running balance
    let runningBalance = 0; 
    for (const entry of entries) {
      if (person.type === 'CUSTOMER') {
        runningBalance += entry.debit - entry.credit;
      } else {
        runningBalance += entry.credit - entry.debit;
      }
      entry.balance = runningBalance;
    }

    // Monthly summary (Should also use netAmount)
    const monthlyMap = new Map<string, { sales: number; purchases: number; payments: number }>();
    for (const inv of invoices) {
      const key = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, '0')}`;
      const cur = monthlyMap.get(key) || { sales: 0, purchases: 0, payments: 0 };
      if (inv.type === 'SALES') cur.sales += inv.netAmount;
      if (inv.type === 'PURCHASES') cur.purchases += inv.netAmount;
      monthlyMap.set(key, cur);
    }
    for (const pay of payments) {
      const key = `${pay.date.getFullYear()}-${String(pay.date.getMonth() + 1).padStart(2, '0')}`;
      const cur = monthlyMap.get(key) || { sales: 0, purchases: 0, payments: 0 };
      cur.payments += pay.amount;
      monthlyMap.set(key, cur);
    }
    const monthly = Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    return NextResponse.json({
      success: true,
      person,
      statement: entries,
      monthly,
      currentBalance: runningBalance,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
