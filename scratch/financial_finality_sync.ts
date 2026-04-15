import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Initiating Financial Finality Sync (Recalculating Stored Values)...');

  try {
    // 1. Recalculate InvoiceItems
    const invoiceItems = await prisma.invoiceItem.findMany();

    console.log(`Synchronizing ${invoiceItems.length} Invoice items...`);
    let count = 0;

    for (const i of invoiceItems) {
      const qty = Number(i.quantity);
      const price = Number(i.price);
      const discount = Number(i.discount || 0);

      const calculatedTotal = qty * price;
      const calculatedTotalNet = calculatedTotal - discount;

      // Only update if there is a significant discrepancy (to avoid trivial updates)
      if (Math.abs(i.totalNet - calculatedTotalNet) > 0.1 || Math.abs(i.total - calculatedTotal) > 0.1) {
        count++;
        await prisma.invoiceItem.update({
          where: { id: i.id },
          data: {
            total: calculatedTotal,
            totalNet: calculatedTotalNet
          }
        });
      }
    }
    console.log(`Re-valued ${count} Invoice items successfully.`);

    // 2. Recalculate QuotationItems
    const quotationItems = await prisma.quotationItem.findMany();
    console.log(`Synchronizing ${quotationItems.length} Quotation items...`);
    let qCount = 0;
    for (const q of quotationItems) {
      const qty = Number(q.quantity);
      const price = Number(q.price);
      const calculatedTotal = qty * price;
      if (Math.abs(q.total - calculatedTotal) > 0.1) {
        qCount++;
        await prisma.quotationItem.update({
          where: { id: q.id },
          data: { total: calculatedTotal }
        });
      }
    }
    console.log(`Re-valued ${qCount} Quotation items successfully.`);

    console.log('Financial Sync Complete.');

  } catch (error) {
    console.error('Financial Sync Failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
