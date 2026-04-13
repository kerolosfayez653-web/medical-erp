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
        unit: typeof unit === 'string' ? unit : undefined,
        secondaryUnit: typeof secondaryUnit === 'string' ? secondaryUnit : undefined,
        conversionFactor: typeof conversionFactor === 'number' ? conversionFactor : undefined,
        secondaryPrice: typeof secondaryPrice === 'number' ? secondaryPrice : undefined,
      }
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update Product Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}
