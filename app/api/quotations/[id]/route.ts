import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        person: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: quotation });
  } catch (error) {
    console.error('Fetch Quotation Error: ', error);
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
