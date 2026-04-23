import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function reconcileLedger() {
  const persons = await prisma.person.findMany();
  const allInvoices = await prisma.invoice.findMany({ where: { isDeleted: false } });
  const allPayments = await prisma.payment.findMany({ where: { isDeleted: false } });

  let insertedIn = 0;
  let insertedOut = 0;
  let totalInAmt = 0;
  let totalOutAmt = 0;

  for (const p of persons) {
    const pSales = allInvoices.filter(i => i.type === 'SALES' && i.personId === p.id).reduce((s, i) => s + i.netAmount, 0);
    const pSalesRet = allInvoices.filter(i => i.type === 'SALES_RETURN' && i.personId === p.id).reduce((s, i) => s + i.netAmount, 0);
    const pPurchases = allInvoices.filter(i => i.type === 'PURCHASES' && i.personId === p.id).reduce((s, i) => s + i.netAmount, 0);
    const pPurRet = allInvoices.filter(i => i.type === 'PURCHASES_RETURN' && i.personId === p.id).reduce((s, i) => s + i.netAmount, 0);

    const pPaidIn = allPayments.filter(pay => pay.personId === p.id && pay.type === 'IN').reduce((s, pay) => s + pay.amount, 0);
    const pPaidOut = allPayments.filter(pay => pay.personId === p.id && pay.type === 'OUT').reduce((s, pay) => s + pay.amount, 0);

    if (p.type === 'CUSTOMER') {
      // For Customer: Expected Balance = Initial + NetSales - NetPaymentsIn
      // currentBalance = Expected Balance
      // currentBalance = initial + (Sales - SalesRet) - (PaidIn - PaidOut)
      // Therefore, missing PaidIn = initial + (Sales - SalesRet) + PaidOut - currentBalance - PaidIn
      const expectedPaidIn = p.initialBalance + (pSales - pSalesRet) + pPaidOut - p.currentBalance;
      const missingIn = expectedPaidIn - pPaidIn;

      if (missingIn > 0.5) {
        console.log(`Customer ${p.name}: Missing In = ${missingIn}`);
        await prisma.payment.create({
          data: {
            personId: p.id,
            amount: missingIn,
            type: 'IN',
            method: 'كاش',
            notes: 'تسوية آلية فرق مديونية (من الفواتير النقدية)',
          }
        });
        insertedIn++;
        totalInAmt += missingIn;
      } else if (missingIn < -0.5) {
        // Overpaid in Payment table compared to current balance
        console.log(`Customer ${p.name}: Overpaid In Payment Table! Missing Out = ${-missingIn}`);
        await prisma.payment.create({
          data: {
             personId: p.id,
             amount: -missingIn,
             type: 'OUT',
             method: 'كاش',
             notes: 'تسوية آلية فرق مديونية'
          }
        });
        insertedOut++;
      }
    } else if (p.type === 'SUPPLIER') {
      // For Supplier: Expected Balance = Initial + NetPurchases - NetPaymentsOut
      // currentBalance = initial + (Purchases - PurRet) - (PaidOut - PaidIn)
      const expectedPaidOut = p.initialBalance + (pPurchases - pPurRet) + pPaidIn - p.currentBalance;
      const missingOut = expectedPaidOut - pPaidOut;

      if (missingOut > 0.5) {
        console.log(`Supplier ${p.name}: Missing Out = ${missingOut}`);
        await prisma.payment.create({
          data: {
            personId: p.id,
            amount: missingOut,
            type: 'OUT',
            method: 'كاش',
            notes: 'تسوية آلية فرق دائنية (من الفواتير النقدية)',
          }
        });
        insertedOut++;
        totalOutAmt += missingOut;
      } else if (missingOut < -0.5) {
        console.log(`Supplier ${p.name}: Missing In = ${-missingOut}`);
        await prisma.payment.create({
          data: {
             personId: p.id,
             amount: -missingOut,
             type: 'IN',
             method: 'كاش',
             notes: 'تسوية آلية فرق دائنية'
          }
        });
        insertedIn++;
      }
    }
  }

  // Also check invoices with null personId (Generic Cash Sales/Purchases)
  const anonymousSales = allInvoices.filter(i => i.type === 'SALES' && !i.personId).reduce((s, i) => s + i.netAmount, 0);
  const anonymousPurchases = allInvoices.filter(i => i.type === 'PURCHASES' && !i.personId).reduce((s, i) => s + i.netAmount, 0);
  const anonymousPaidIn = allPayments.filter(pay => !pay.personId && pay.type === 'IN').reduce((s, pay) => s + pay.amount, 0);
  const anonymousPaidOut = allPayments.filter(pay => !pay.personId && pay.type === 'OUT').reduce((s, pay) => s + pay.amount, 0);

  const missingAnonIn = anonymousSales - anonymousPaidIn;
  const missingAnonOut = anonymousPurchases - anonymousPaidOut;

  if (missingAnonIn > 0.5) {
     console.log('Anonymous Sales missing payment:', missingAnonIn);
     await prisma.payment.create({
       data: { amount: missingAnonIn, type: 'IN', method: 'كاش', notes: 'تسوية فواتير نقدية مجهولة' }
     });
     insertedIn++;
  }
  if (missingAnonOut > 0.5) {
     console.log('Anonymous Purchases missing payment:', missingAnonOut);
     await prisma.payment.create({
       data: { amount: missingAnonOut, type: 'OUT', method: 'كاش', notes: 'تسوية فواتير نقدية مجهولة' }
     });
     insertedOut++;
  }

  console.log(`Reconciliation Complete. In: ${insertedIn} (Amt: ${totalInAmt}), Out: ${insertedOut} (Amt: ${totalOutAmt})`);
}

reconcileLedger().catch(console.error).finally(()=>prisma.$disconnect());
