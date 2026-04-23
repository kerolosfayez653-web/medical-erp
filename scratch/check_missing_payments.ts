import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.invoice.findMany({
    where: { type: 'SALES', isDeleted: false },
    include: { payments: true }
  });
  
  let missing = 0;
  let totalMissingAmt = 0;
  
  inv.forEach(i => {
    // If it's cash or partial but has NO payments at all, or the sum of payments doesn't match
    const paySum = i.payments.reduce((s, p) => s + p.amount, 0);
    // Let's just calculate how many have NO payments but were considered paidAmount > 0
    if (i.paidAmount > 0 && i.payments.length === 0) {
      missing++;
      totalMissingAmt += i.paidAmount;
    }
  });
  
  console.log('Invoices with paidAmount > 0 but NO payment records:', missing, totalMissingAmt);
}

main().catch(console.error).finally(()=>prisma.$disconnect());
