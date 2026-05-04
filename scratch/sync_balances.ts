import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function syncBalances() {
  console.log('--- Starting Person Balances Synchronization ---');
  
  const persons = await prisma.person.findMany();
  
  for (const person of persons) {
    // Get all invoices for this person
    const invoices = await prisma.invoice.findMany({
      where: { personId: person.id, isDeleted: false },
    });

    // Get all payments
    const payments = await prisma.payment.findMany({
      where: { personId: person.id, isDeleted: false },
    });

    const entries: Array<{ debit: number; credit: number }> = [];

    // Opening balance entry
    if (person.initialBalance !== 0) {
      const isCustomer = person.type === 'CUSTOMER';
      entries.push({
        debit: isCustomer 
          ? (person.initialBalance > 0 ? person.initialBalance : 0)
          : (person.initialBalance < 0 ? Math.abs(person.initialBalance) : 0),
        credit: isCustomer
          ? (person.initialBalance < 0 ? Math.abs(person.initialBalance) : 0)
          : (person.initialBalance > 0 ? person.initialBalance : 0),
      });
    }

    // Merge invoices
    for (const inv of invoices) {
      if (inv.type === 'SALES') {
        entries.push({ debit: inv.netAmount, credit: 0 });
      } else if (inv.type === 'PURCHASES') {
        entries.push({ debit: 0, credit: inv.netAmount });
      }
    }

    // Merge payments
    for (const pay of payments) {
      if (pay.type === 'IN') {
        entries.push({ debit: 0, credit: pay.amount });
      } else {
        entries.push({ debit: pay.amount, credit: 0 });
      }
    }

    // Compute running balance
    let runningBalance = 0; 
    for (const entry of entries) {
      if (person.type === 'CUSTOMER') {
        runningBalance += entry.debit - entry.credit;
      } else {
        runningBalance += entry.credit - entry.debit;
      }
    }

    // Update if different
    // To handle floating point issues, let's round to 2 decimals
    const roundedRunningBalance = Math.round(runningBalance * 100) / 100;
    const roundedCurrentBalance = Math.round(person.currentBalance * 100) / 100;

    if (roundedRunningBalance !== roundedCurrentBalance) {
      console.log(`Fixing ${person.name} (${person.type}): DB=${roundedCurrentBalance} -> Correct=${roundedRunningBalance}`);
      await prisma.person.update({
        where: { id: person.id },
        data: { currentBalance: roundedRunningBalance }
      });
    }
  }

  console.log('--- Sync Complete ---');
}

syncBalances().catch(console.error);
