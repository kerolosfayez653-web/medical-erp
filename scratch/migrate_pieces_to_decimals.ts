import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Initiating Data Migration: Pieces -> Decimal Boxes...');

  try {
    // 1. Migrate InvoiceItems
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: { unitType: 'SECONDARY' },
      include: { product: true }
    });

    console.log(`Found ${invoiceItems.length} Invoice items in secondary units.`);

    for (const i of invoiceItems) {
      const factor = i.product.conversionFactor || 1;
      const decimalQty = i.quantity / factor;
      console.log(`Migrating InvoiceItem ${i.id}: ${i.quantity} pieces -> ${decimalQty} boxes`);
      
      await prisma.invoiceItem.update({
        where: { id: i.id },
        data: {
          quantity: decimalQty,
          unitType: 'PRIMARY'
        }
      });
    }

    // 2. Migrate QuotationItems
    const quotationItems = await prisma.quotationItem.findMany({
      where: { unitType: 'SECONDARY' },
      include: { product: true }
    });

    console.log(`Found ${quotationItems.length} Quotation items in secondary units.`);

    for (const q of quotationItems) {
      const factor = q.product.conversionFactor || 1;
      const decimalQty = q.quantity / factor;
      console.log(`Migrating QuotationItem ${q.id}: ${q.quantity} pieces -> ${decimalQty} boxes`);

      await prisma.quotationItem.update({
        where: { id: q.id },
        data: {
          quantity: decimalQty,
          unitType: 'PRIMARY'
        }
      });
    }

    console.log('Migration Complete.');

  } catch (error) {
    console.error('Migration Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
