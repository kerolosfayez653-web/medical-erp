import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixMissingPayments() {
  console.log('Starting missing payments sync...');

  // Fix SALES missing payments (Receipts)
  const sales = await prisma.invoice.findMany({
    where: { type: 'SALES', isDeleted: false, paidAmount: { gt: 0 } },
    include: { payments: true }
  });

  let createdIn = 0;
  for (const inv of sales) {
    if (inv.payments.length === 0) {
      await prisma.payment.create({
        data: {
          personId: inv.personId,
          invoiceId: inv.id,
          amount: inv.paidAmount,
          type: 'IN',
          date: inv.date,
          method: inv.paymentMethod || 'كاش',
          notes: 'تسوية آلية: دفعة من فاتورة المبيعات'
        }
      });
      createdIn++;
    }
  }

  // Fix PURCHASES missing payments (Payments)
  const purchases = await prisma.invoice.findMany({
    where: { type: 'PURCHASES', isDeleted: false, paidAmount: { gt: 0 } },
    include: { payments: true }
  });

  let createdOut = 0;
  for (const inv of purchases) {
    if (inv.payments.length === 0) {
      await prisma.payment.create({
        data: {
          personId: inv.personId,
          invoiceId: inv.id,
          amount: inv.paidAmount,
          type: 'OUT',
          date: inv.date,
          method: inv.paymentMethod || 'كاش',
          notes: 'تسوية آلية: دفعة من فاتورة المشتريات'
        }
      });
      createdOut++;
    }
  }

  console.log(`Sync complete. Created ${createdIn} Customer Receipts and ${createdOut} Supplier Payments.`);
}

fixMissingPayments().catch(console.error).finally(()=>prisma.$disconnect());
