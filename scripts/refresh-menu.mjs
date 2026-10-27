import {writeFile} from 'node:fs/promises';
const endpoint='https://script.google.com/macros/s/AKfycbyVRN3Zb-8ttbA9wqBmae8Zzofdw6f7zN3jFGs1wRtjMGG51rWM5KSCL4bLTWMrznpC/exec?action=products';
const response=await fetch(endpoint,{signal:AbortSignal.timeout(30000)});
if(!response.ok)throw new Error('Could not refresh menu: '+response.status);
const data=await response.json();
if(!Array.isArray(data.products))throw new Error('Invalid menu response');
await writeFile(new URL('../data/menu.js',import.meta.url),'/* Public menu snapshot: '+new Date().toISOString()+'. Checkout requires live confirmation. */\nconst MENU='+JSON.stringify(data.products)+';\n');
console.log('Updated public menu snapshot:',data.products.length,'variants');
