import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function tracePerson() {
  const p = await prisma.person.findFirst({ where: { name: { contains: 'رحمه اشرف' } } });
  if (!p) return;

  const invs = await prisma.invoice.findMany({ where: { personId: p.id } });
  const pays = await prisma.payment.findMany({ where: { personId: p.id } });

  console.log("Person Initial:", p.initialBalance, "Current:", p.currentBalance);
  
  console.log("INVOICES:");
  invs.forEach(i => {
     console.log(`  ID: ${i.id}, Net: ${i.netAmount}, PaidAmt: ${i.paidAmount}`);
  });

  console.log("PAYMENTS:");
  pays.forEach(pay => {
     console.log(`  ID: ${pay.id}, Amt: ${pay.amount}, Type: ${pay.type}, Notes: ${pay.notes}`);
  });
}
tracePerson().catch(console.error).finally(()=>prisma.$disconnect());
