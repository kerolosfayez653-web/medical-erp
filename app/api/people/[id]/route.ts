import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const person = await prisma.person.findUnique({
      where: { id: parseInt(id) }
    });
    if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    return NextResponse.json({ success: true, data: person });
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { name, type, phone, address, initialBalance } = body;

    const oldPerson = await prisma.person.findUnique({
      where: { id: parseInt(id) }
    });

    if (!oldPerson) return NextResponse.json({ error: 'Person not found' }, { status: 404 });

    const newIB = parseFloat(initialBalance) || 0;
    const balanceDiff = newIB - oldPerson.initialBalance;

    const updated = await prisma.person.update({
      where: { id: parseInt(id) },
      data: {
        name: name || undefined,
        type: type || undefined,
        phone: phone || null,
        address: address || null,
        initialBalance: newIB,
        currentBalance: { increment: balanceDiff } // Adjust current balance by the difference in initial balance
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update Person Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    try {
        // Check if person has invoices
        const invoiceCount = await prisma.invoice.count({ where: { personId: parseInt(id) } });
        if (invoiceCount > 0) {
            return NextResponse.json({ error: 'لا يمكن حذف جهة لها فواتير مسجلة. قم بحذف الفواتير أولاً.' }, { status: 400 });
        }

        await prisma.person.delete({ where: { id: parseInt(id) } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
