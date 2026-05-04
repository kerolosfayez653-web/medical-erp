import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        barcode: true,
        category: true,
        unit: true,
        secondaryUnit: true,
        conversionFactor: true,
        secondaryPrice: true,
        lastSellPrice: true,
        lastPurchasePrice: true,
      }
    });
    return NextResponse.json({ success: true, data: products });
  } catch (error) {
    console.error('List Products Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, barcode, category, unit, secondaryUnit, conversionFactor, secondaryPrice, openingQty, openingWeightedAvg } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'اسم الصنف مطلوب' }, { status: 400 });
    }

    // Check for duplicate barcode if provided
    if (barcode && barcode.trim()) {
      const existing = await prisma.product.findUnique({ where: { barcode: barcode.trim() } });
      if (existing) {
        return NextResponse.json({ error: `الكود "${barcode}" مستخدم بالفعل للصنف: ${existing.name}` }, { status: 400 });
      }
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        barcode: barcode?.trim() || null,
        category: category?.trim() || null,
        unit: unit?.trim() || 'قطعه',
        secondaryUnit: secondaryUnit?.trim() || null,
        conversionFactor: parseInt(conversionFactor) || 1,
        secondaryPrice: parseFloat(secondaryPrice) || null,
        openingQty: parseFloat(openingQty) || 0,
        openingWeightedAvg: parseFloat(openingWeightedAvg) || 0,
      }
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error: any) {
    console.error('Create Product Error:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'هذا الكود مستخدم بالفعل' }, { status: 400 });
    }
    return NextResponse.json({ error: 'خطأ في السيرفر: ' + error.message }, { status: 500 });
  }
}
