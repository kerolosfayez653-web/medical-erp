import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sales = await prisma.invoice.findMany({ where: { type: 'SALES', isDeleted: false } });
  const salesRet = await prisma.invoice.findMany({ where: { type: 'SALES_RETURN', isDeleted: false } });
  
  let netSales = 0, delivery = 0, discount = 0, cogs = 0;
  sales.forEach(s => {
    netSales += s.netAmount;
    delivery += s.deliveryFee;
    discount += s.discount;
    cogs += s.cogs;
  });
  
  console.log({
    salesCount: sales.length,
    netSales,
    delivery,
    discount,
    cogs
  });

  const payments = await prisma.payment.findMany({ where: { isDeleted: false }});
  let payIn = 0, payOut = 0;
  payments.forEach(p => {
    if (p.type === 'IN') payIn += p.amount;
    if (p.type === 'OUT') payOut += p.amount;
  });

  console.log({
    payIn,
    payOut
  });
}
main().catch(console.error).finally(()=>prisma.$disconnect());
