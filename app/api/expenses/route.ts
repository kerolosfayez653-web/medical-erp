import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    
    const where: any = {};
    if (category && category !== 'ALL') {
      where.category = category;
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' }
    });

    const categories = Array.from(new Set((await prisma.expense.findMany({ select: { category: true } })).map(e => e.category)));

    return NextResponse.json({ success: true, data: expenses, categories });
  } catch (error) {
    console.error('Expenses Fetch Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { date, category, amount, description, paymentMethod } = body;

    if (!category || !amount) {
      return NextResponse.json({ error: 'Category and Amount are required' }, { status: 400 });
    }

    const expense = await prisma.expense.create({
      data: {
        date: date ? new Date(date) : new Date(),
        category,
        amount: parseFloat(amount),
        description,
        paymentMethod
      }
    });

    return NextResponse.json({ success: true, data: expense });
  } catch (error) {
    console.error('Expense Create Error:', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await prisma.expense.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Delete error' }, { status: 500 });
  }
}
