import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDebts() {
  const persons = await prisma.person.findMany({ where: { type: 'CUSTOMER' }});
  const allInvoices = await prisma.invoice.findMany({ where: { isDeleted: false }});
  const allPayments = await prisma.payment.findMany({ where: { isDeleted: false }});

  let c1Error = 0;
  for (const p of persons) {
    const pSales = allInvoices.filter(i => i.type === 'SALES' && i.personId === p.id).reduce((s, i) => s + i.netAmount, 0);
    const pSalesRet = allInvoices.filter(i => i.type === 'SALES_RETURN' && i.personId === p.id).reduce((s, i) => s + i.netAmount, 0);
    const pPaidIn = allPayments.filter(pay => pay.personId === p.id && pay.type === 'IN' && !pay.notes?.includes('افتتاحي')).reduce((s, pay) => s + pay.amount, 0);
    const pPaidOut = allPayments.filter(pay => pay.personId === p.id && pay.type === 'OUT').reduce((s, pay) => s + pay.amount, 0); // refunds
    
    // Balance route computation
    const computedBal = p.initialBalance + (pSales - pSalesRet) - (pPaidIn - pPaidOut);

    // Reports route computation (which I wrote before)
    const pPaidInRep = allPayments.filter(pay => pay.personId === p.id && pay.type === 'IN').reduce((s, pay) => s + pay.amount, 0);
    const repBal = p.initialBalance + (pSales - pSalesRet) - (pPaidInRep - pPaidOut);

    if (Math.abs(computedBal - p.currentBalance) > 1 || Math.abs(repBal - p.currentBalance) > 1) {
       console.log(`Mismatch ${p.name}: Computed=${computedBal}, Rep=${repBal}, Real=${p.currentBalance}`);
       c1Error++;
    }
  }

  console.log('Total mismatches:', c1Error);
}
checkDebts().catch(console.error).finally(()=>prisma.$disconnect());
