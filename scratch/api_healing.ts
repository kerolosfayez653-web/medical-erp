import fs from 'fs';
import path from 'path';

const apiBase = 'c:/Users/Administrator/.gemini/antigravity/scratch/medical_erp/app/api';

function healApiFile(filePath: string, replacements: Array<{search: RegExp | string, replace: string}>) {
  const fullPath = path.join(apiBase, filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`Skipping ${filePath} (Not found)`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let original = content;
  
  for (const r of replacements) {
    content = content.replace(r.search, r.replace);
  }
  
  if (content !== original) {
    fs.writeFileSync(fullPath, content);
    console.log(`Healed API ${filePath}`);
  } else {
    console.log(`No changes needed for API ${filePath}`);
  }
}

// 1. Heal Invoices [id] PATCH
healApiFile('invoices/[id]/route.ts', [
  {
    search: /const getIncomingEffQty = \(it: any\) => \{[\s\S]*?\};/g,
    replace: `const getIncomingEffQty = (it: any) => parseFloat(it.quantity) || 0;`
  },
  {
    search: /const piecePrice = \(item\.unitType === 'SECONDARY'\) \? originalPrice : \(originalPrice \/ factor\);/g,
    replace: `const piecePrice = originalPrice;`
  },
  {
    search: /sellingPrice: \(parseFloat\(item\.sellingPrice\) \|\| originalPrice \* 1\.25\) \/ \(\(item\.unitType === 'SECONDARY'\) \? 1 : factor\),/g,
    replace: `sellingPrice: parseFloat(item.sellingPrice) || (originalPrice * 1.25),`
  },
  {
     search: /const effQty = unitType === 'SECONDARY' \? originalQty : \(originalQty \* factor\);/g,
     replace: `const effQty = originalQty;`
  },
  {
     search: /const piecePrice = unitType === 'SECONDARY' \? originalPrice : \(originalPrice \/ factor\);/g,
     replace: `const piecePrice = originalPrice;`
  }
]);

// 2. Heal Sales POST
healApiFile('sales/route.ts', [
  {
    search: /const getIncomingEffQty = \(it: any\) => \{[\s\S]*?\};/g,
    replace: `const getIncomingEffQty = (it: any) => parseFloat(it.quantity) || 0;`
  },
  {
    search: /piecePrice: \(item\.unitType === 'SECONDARY'\) \? parseFloat\(item\.price\) : \(parseFloat\(item\.price\) \/ factor\),/g,
    replace: `piecePrice: parseFloat(item.price),`
  }
]);

// 3. Heal Purchases POST
healApiFile('purchases/route.ts', [
  {
    search: /const getIncomingEffQty = \(it: any\) => \{[\s\S]*?\};/g,
    replace: `const getIncomingEffQty = (it: any) => parseFloat(it.quantity) || 0;`
  },
  {
    search: /costPrice: \(item\.unitType === 'SECONDARY'\) \? parseFloat\(item\.price\) : \(parseFloat\(item\.price\) \/ factor\),/g,
    replace: `costPrice: parseFloat(item.price),`
  },
  {
    search: /sellingPrice: \(parseFloat\(item\.sellingPrice\) \|\| parseFloat\(item\.price\) \* 1\.25\) \/ \(\(item\.unitType === 'SECONDARY'\) \? 1 : factor\),/g,
    replace: `sellingPrice: parseFloat(item.sellingPrice) || (parseFloat(item.price) * 1.25),`
  }
]);

// 4. Heal Quotations POST
healApiFile('quotations/route.ts', [
  {
     search: /quantity: it\.unitType === 'SECONDARY' \? parseFloat\(it\.quantity\) : \(parseFloat\(it\.quantity\) \* factor\),/g,
     replace: `quantity: parseFloat(it.quantity),`
  },
  {
     search: /price: it\.unitType === 'SECONDARY' \? parseFloat\(it\.price\) : \(parseFloat\(it\.price\) \/ factor\),/g,
     replace: `price: parseFloat(it.price),`
  }
]);

console.log('Global API Decimal Alignment Complete.');
