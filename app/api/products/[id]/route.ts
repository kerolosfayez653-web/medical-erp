import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { unit, secondaryUnit, conversionFactor, secondaryPrice } = body;

    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data: {
        unit: unit || null,
        secondaryUnit: secondaryUnit || null,
        conversionFactor: parseInt(conversionFactor) || 1,
        secondaryPrice: parseFloat(secondaryPrice) || null
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update Product Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
