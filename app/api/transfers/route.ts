import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const transfers = await prisma.transfer.findMany({
      orderBy: { date: 'desc' },
      take: 200
    });
    return NextResponse.json(transfers);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    if (!data.amount || !data.fromMethod || !data.toMethod) {
      return NextResponse.json({ success: false, error: 'يجب إدخال المبلغ وتحديد المحول منه والمحول إليه' }, { status: 400 });
    }

    if (data.fromMethod === data.toMethod) {
      return NextResponse.json({ success: false, error: 'لا يمكن التحويل لنفس الحساب' }, { status: 400 });
    }

    const transfer = await prisma.transfer.create({
      data: {
        amount: Number(data.amount),
        fromMethod: data.fromMethod,
        toMethod: data.toMethod,
        date: data.date ? new Date(data.date) : new Date(),
        notes: data.notes || null
      }
    });

    return NextResponse.json({ success: true, transfer });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID is required' }, { status: 400 });

    await prisma.transfer.delete({
      where: { id: Number(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
