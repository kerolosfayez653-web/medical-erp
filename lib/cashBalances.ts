import prisma from './prisma';

export async function getCashBalances() {
  const OPENING_CASH = 10278;
  const cashAccounts: Record<string, number> = {
    'كاش': OPENING_CASH,
    'انستاباي': 0,
    'فودافون كاش': 0,
    'اكسيس باي': 0,
    'شيك': 0,
    'تحويل بنكي': 0
  };

  const allPay = await prisma.payment.groupBy({
    by: ['method', 'type'],
    where: { isDeleted: false },
    _sum: { amount: true }
  });
  
  allPay.forEach(p => {
    const m = p.method || 'كاش';
    if (cashAccounts[m] === undefined) cashAccounts[m] = 0;
    if (p.type === 'IN') cashAccounts[m] += p._sum.amount || 0;
    else cashAccounts[m] -= p._sum.amount || 0;
  });

  const allExp = await prisma.expense.groupBy({
    by: ['paymentMethod'],
    _sum: { amount: true }
  });
  
  allExp.forEach(e => {
    const m = e.paymentMethod || 'كاش';
    if (cashAccounts[m] === undefined) cashAccounts[m] = 0;
    cashAccounts[m] -= e._sum.amount || 0;
  });

  const allTransfers = await prisma.transfer.findMany();
  allTransfers.forEach(t => {
    const from = t.fromMethod || 'كاش';
    const to = t.toMethod || 'كاش';
    if (cashAccounts[from] === undefined) cashAccounts[from] = 0;
    if (cashAccounts[to] === undefined) cashAccounts[to] = 0;
    cashAccounts[from] -= t.amount;
    cashAccounts[to] += t.amount;
  });

  return cashAccounts;
}
