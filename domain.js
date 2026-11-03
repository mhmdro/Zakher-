export const empty=()=>({customers:[],vehicles:[],parts:[],orders:[],expenses:[]});
export const id=()=>crypto.randomUUID();
export function money(n){return Math.round((Number(n)+Number.EPSILON)*100)/100}
export function amount(value){const n=Number(value);if(!Number.isFinite(n)||n<0||value==='')throw Error('أدخل مبلغًا صحيحًا غير سالب');return money(n)}
export function createOrder(s,o){
 if(!s.vehicles.some(v=>v.id===o.vehicleId))throw Error('اختر سيارة مسجلة');
 if(!o.description?.trim())throw Error('أدخل وصف الخدمة');
 if(!['quote','invoice'].includes(o.kind))throw Error('نوع المستند غير صالح');
 const labor=amount(o.labor),qty=Number(o.qty||0),part=o.partId?s.parts.find(p=>p.id===o.partId):null;
 if(!Number.isInteger(qty)||qty<0||(!part&&qty))throw Error('كمية القطعة غير صحيحة');
 if(part&&qty<1)throw Error('حدد كمية القطع');
 if(o.kind==='invoice'&&part&&qty>part.stock)throw Error('الكمية المطلوبة غير متوفرة');
 const subtotal=money(labor+(part?part.price*qty:0));
 const order={id:id(),number:`${o.kind==='quote'?'Q':'INV'}-${s.orders.length+1001}`,date:new Date().toISOString(),vehicleId:o.vehicleId,description:o.description.trim(),kind:o.kind,status:o.kind==='quote'?'عرض سعر':'قيد العمل',paid:false,labor,qty,partId:part?.id||'',partName:part?.name||'',partPrice:part?.price||0,cost:money((part?.cost||0)*qty),subtotal,tax:money(subtotal*0.05),total:money(subtotal*1.05)};
 if(o.kind==='invoice'&&part)part.stock-=qty;
 s.orders.push(order);return order;
}
export function summary(s){const invoices=s.orders.filter(o=>o.kind==='invoice');const revenue=money(invoices.reduce((a,o)=>a+o.subtotal,0)),cost=money(invoices.reduce((a,o)=>a+o.cost,0)),expenses=money(s.expenses.reduce((a,e)=>a+e.amount,0));return {revenue,cost,expenses,profit:money(revenue-cost-expenses),unpaid:money(invoices.filter(o=>!o.paid).reduce((a,o)=>a+o.total,0))}}
export function validateBackup(s){
 if(!s||!['customers','vehicles','parts','orders','expenses'].every(k=>Array.isArray(s[k])))throw Error('ملف النسخة غير صالح');
 const str=x=>typeof x==='string',num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 for(const k of ['customers','vehicles','parts','orders','expenses']){if(s[k].some(x=>!x||!str(x.id))||new Set(s[k].map(x=>x.id)).size!==s[k].length)throw Error('معرّفات غير صالحة')}
 if(s.customers.some(x=>!str(x.name)||!str(x.phone))||s.vehicles.some(x=>!str(x.model)||!str(x.plate)||!s.customers.some(c=>c.id===x.customerId))||s.parts.some(x=>!str(x.name)||!num(x.price)||!num(x.cost)||!Number.isInteger(x.stock)||x.stock<0)||s.expenses.some(x=>!str(x.name)||!num(x.amount)))throw Error('بيانات غير صالحة');
 if(s.orders.some(x=>!['quote','invoice'].includes(x.kind)||!str(x.number)||!str(x.description)||!str(x.status)||!str(x.date)||!str(x.partName)||typeof x.paid!=='boolean'||!s.vehicles.some(v=>v.id===x.vehicleId)||!['labor','qty','partPrice','cost','subtotal','tax','total'].every(k=>num(x[k]))))throw Error('مستند غير صالح');
 return s;
}
export function demo(){let s=empty();s.customers=[{id:'c1',name:'أحمد المنصوري',phone:'0501234567'},{id:'c2',name:'خالد عبدالله',phone:'0507654321'}];s.vehicles=[{id:'v1',customerId:'c1',model:'Toyota Land Cruiser · 2022',plate:'أبوظبي  •  45821'},{id:'v2',customerId:'c2',model:'Nissan Patrol · 2021',plate:'أبوظبي  •  92104'}];s.parts=[{id:'p1',name:'فلتر زيت / Oil filter',stock:18,cost:25,price:45},{id:'p2',name:'زيت محرك / Engine oil',stock:4,cost:90,price:140}];createOrder(s,{vehicleId:'v1',description:'تغيير زيت المحرك والفلاتر / Oil service',kind:'invoice',labor:180,partId:'p1',qty:1});s.expenses=[{id:'e1',name:'مستلزمات الورشة',amount:40}];return s}
