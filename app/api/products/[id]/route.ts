import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { unit, secondaryUnit, conversionFactor, secondaryPrice } = body;

    // Build the update data object safely
    const data: any = {};
    if (typeof unit === 'string') data.unit = unit;
    if (typeof secondaryUnit === 'string') data.secondaryUnit = secondaryUnit;
    
    const cFactor = Number(conversionFactor);
    if (!isNaN(cFactor)) data.conversionFactor = Math.floor(cFactor);
    
    if (secondaryPrice !== undefined && secondaryPrice !== null) {
      const sPrice = Number(secondaryPrice);
      if (!isNaN(sPrice)) data.secondaryPrice = sPrice;
    }

    const updated = await prisma.product.update({
      where: { id: parseInt(id) },
      data
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
