import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Generate quotation number: QUO-YYMMDD-NNNN
async function generateQuotationNumber(): Promise<string> {
  const now = new Date();
  const yy  = String(now.getFullYear()).slice(2);
  const mm  = String(now.getMonth() + 1).padStart(2, '0');
  const dd  = String(now.getDate()).padStart(2, '0');
  const prefix = `QUO-${yy}${mm}${dd}`;
  const count = await prisma.quotation.count({
    where: { quotationNumber: { startsWith: prefix } }
  });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { personId, items, discount = 0, deliveryFee = 0, notes, expiryDate } = body;

    let itemsTotal = 0;
    for (const item of items) {
      itemsTotal += item.price * item.quantity;
    }

    const netAmount = itemsTotal + parseFloat(deliveryFee) - parseFloat(discount);
    const quotationNumber = await generateQuotationNumber();

    const result = await prisma.quotation.create({
      data: {
        quotationNumber,
        personId: personId ? Number(personId) : null,
        totalAmount: itemsTotal,
        discount: parseFloat(discount) || 0,
        deliveryFee: parseFloat(deliveryFee) || 0,
        netAmount,
        notes,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        status: 'PENDING',
        items: {
          create: items.map((i: any) => ({
            productId: Number(i.productId),
            quantity: Number(i.quantity),
            unitType: i.unitType || 'PRIMARY',
            price: parseFloat(i.price) || 0,
            total: (parseFloat(i.price) || 0) * (Number(i.quantity) || 0)
          }))
        }
      },
      include: {
        items: true,
        person: true
      }
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Quotation Error: ', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const quotations = await prisma.quotation.findMany({
      include: {
        person: true,
        items: {
          include: {
            product: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, data: quotations });
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
