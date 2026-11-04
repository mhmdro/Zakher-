import {cleanGuest,paymentSummary,salaryExpenses,validateOperationalData} from './ledger.js?v=7';
export const empty=()=>({customers:[],vehicles:[],parts:[],orders:[],expenses:[]});
export const id=()=>crypto.randomUUID();
export function money(n){return Math.round((Number(n)+Number.EPSILON)*100)/100}
export function amount(value){const n=Number(value);if(!Number.isFinite(n)||n<0||value==='')throw Error('أدخل مبلغًا صحيحًا غير سالب');return money(n)}
// Optional supplier/vehicle metadata is validated without changing legacy records.
export const SUPPORTED_SUPPLIER_BRANDS=Object.freeze([
 'nissan','toyota','bmw','honda','hyundai','kia','audi','volkswagen','ford','chevrolet',
 'mitsubishi','mazda','suzuki','subaru','renault','peugeot','porsche','tesla','volvo',
 'jeep','infiniti','cadillac','bentley','mini','skoda','rollsroyce','mercedes','landrover'
]);
export function validateVehicleVin(value='',{allowEmpty=true}={}) {
 if(typeof value!=='string'||(value===''&&!allowEmpty)||(value!==''&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(value))) {
  throw Error('رقم الهيكل VIN يجب أن يكون 17 حرفًا إنجليزيًا كبيرًا أو رقمًا، دون I أو O أو Q.');
 }
 return value;
}
function validISOTime(value) {
 if(typeof value!=='string')return false;
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
 if(!match||!Number.isFinite(Date.parse(value)))return false;
 const [,year,month,day,hour,minute,second,zoneHour=0,zoneMinute=0]=match.map((part,index)=>index===0?part:part===undefined?undefined:Number(part));
 return month>=1&&month<=12&&day>=1&&day<=new Date(Date.UTC(year,month,0)).getUTCDate()&&hour<24&&minute<60&&second<60&&zoneHour<24&&zoneMinute<60;
}
function validNormalizedSupplierPhone(value) {
 if(typeof value!=='string'||!/^\+?[1-9]\d{7,14}$/.test(value))return false;
 const digits=value.replace(/^\+/,'');
 try{return normalizeWhatsAppPhone('+'+digits)===digits}catch{return false}
}
export function createOrder(s,o){
 const guest=o.guest===undefined?undefined:cleanGuest(o.guest);
 if(guest&&(o.kind!=='quote'||o.vehicleId))throw Error('الإدخال اليدوي متاح لعرض السعر فقط.');
 if(!guest&&!s.vehicles.some(v=>v.id===o.vehicleId))throw Error('اختر سيارة مسجلة');
 if(!o.description?.trim())throw Error('أدخل وصف الخدمة');
 if(!['quote','invoice'].includes(o.kind))throw Error('نوع المستند غير صالح');
 if(o.messageLanguage!==undefined&&!['ar','en'].includes(o.messageLanguage))throw Error('اختر العربية أو الإنجليزية لرسالة واتساب.');
 if(o.documentLanguage!==undefined&&!['ar','en','both'].includes(o.documentLanguage))throw Error('اختر لغة المستند: العربية أو الإنجليزية أو اللغتين.');
 if(o.descriptionEn!==undefined&&(typeof o.descriptionEn!=='string'||o.descriptionEn.length>10000))throw Error('وصف الخدمة بالإنجليزية غير صالح أو طويل جدًا.');
 const labor=amount(o.labor),qty=Number(o.qty||0),part=o.partId?s.parts.find(p=>p.id===o.partId):null;
 if(!Number.isInteger(qty)||qty<0||(!part&&qty))throw Error('كمية القطعة غير صحيحة');
 if(part&&qty<1)throw Error('حدد كمية القطع');
 if(o.kind==='invoice'&&part&&qty>part.stock)throw Error('الكمية المطلوبة غير متوفرة');
 const subtotal=money(labor+(part?part.price*qty:0));
 const order={id:id(),number:`${o.kind==='quote'?'Q':'INV'}-${s.orders.length+1001}`,date:new Date().toISOString(),vehicleId:guest?'':o.vehicleId,description:o.description.trim(),kind:o.kind,status:o.kind==='quote'?'عرض سعر':'قيد العمل',paid:false,labor,qty,partId:part?.id||'',partName:part?.name||'',partPrice:part?.price||0,cost:money((part?.cost||0)*qty),subtotal,tax:money(subtotal*0.05),total:money(subtotal*1.05)};
 if(guest)order.guest=guest;
 if(o.messageLanguage!==undefined)order.messageLanguage=o.messageLanguage;
 if(o.documentLanguage!==undefined)order.documentLanguage=o.documentLanguage;
 if(o.descriptionEn!==undefined)order.descriptionEn=o.descriptionEn;
 if(o.kind==='invoice'&&part)part.stock-=qty;
 s.orders.push(order);return order;
}
// Update pricing without changing the vehicle, workflow state or payment status.
export function updateOrder(s,orderId,changes={}) {
 const order=s.orders.find(o=>o.id===orderId);
 if(!order)throw Error('أمر الصيانة غير موجود.');
 if(order.kind==='invoice'&&order.paid)throw Error('ألغِ تسجيل الدفع أولًا لتعديل الفاتورة.');
 if(!changes||typeof changes!=='object')throw Error('بيانات التعديل غير صحيحة.');
 if(changes.descriptionEn!==undefined&&(typeof changes.descriptionEn!=='string'||changes.descriptionEn.length>10000))throw Error('وصف الخدمة بالإنجليزية غير صالح أو طويل جدًا.');
 const guest=changes.guest===undefined?undefined:cleanGuest(changes.guest);
 if(guest&&(order.kind!=='quote'||!order.guest))throw Error('لا يمكن تغيير نوع العميل بهذا التعديل.');
 const description=changes.description===undefined?order.description:changes.description;
 if(typeof description!=='string'||!description.trim())throw Error('أدخل وصف الخدمة');
 const labor=amount(changes.labor===undefined?order.labor:changes.labor);
 const partId=changes.partId===undefined?order.partId:changes.partId;
 if(typeof partId!=='string')throw Error('اختر قطعة غيار صحيحة.');
 const qty=Number(changes.qty===undefined?order.qty:changes.qty);
 if(!Number.isSafeInteger(qty)||qty<0)throw Error('كمية القطعة غير صحيحة');
 const part=partId?s.parts.find(p=>p.id===partId):null;
 if(partId&&!part)throw Error('قطعة الغيار غير موجودة في المخزون.');
 if(!part&&qty)throw Error('كمية القطعة غير صحيحة');
 if(part&&qty<1)throw Error('حدد كمية القطع');
 const oldPart=order.partId?s.parts.find(p=>p.id===order.partId):null;
 if(order.kind==='invoice'&&order.qty&&!oldPart)throw Error('قطعة الفاتورة السابقة غير موجودة في المخزون.');
 const samePart=!!part&&part.id===order.partId&&order.qty>0;
 const available=part?part.stock+(order.kind==='invoice'&&samePart?order.qty:0):0;
 if(order.kind==='invoice'&&part&&qty>available)throw Error('الكمية المطلوبة غير متوفرة');
 const partPrice=part?(samePart?order.partPrice:part.price):0;
 const unitCost=part?(samePart?order.cost/order.qty:part.cost):0;
 const subtotal=money(labor+partPrice*qty),tax=money(subtotal*0.05),total=money(subtotal*1.05),cost=money(unitCost*qty);
 if(![subtotal,tax,total,cost].every(Number.isFinite))throw Error('المبلغ أو الكمية أكبر من المسموح.');
 const received=paymentSummary(order).received;
 if(order.kind==='invoice'&&total<received)throw Error('قيمة الفاتورة الجديدة أقل من الدفعات المسجلة.');
 const updated={description:description.trim(),labor,qty,partId:part?.id||'',partName:part?(samePart?order.partName:part.name):'',partPrice,cost,subtotal,tax,total};
 if(guest)updated.guest=guest;
 if(Array.isArray(order.payments))updated.paid=total>0&&received===total;
 if(changes.descriptionEn!==undefined)updated.descriptionEn=changes.descriptionEn;
 // All validation is complete before either stock or the order changes.
 if(order.kind==='invoice') {
  if(oldPart)oldPart.stock+=order.qty;
  if(part)part.stock-=qty;
 }
 Object.assign(order,updated);
 return order;
}
export function summary(s){const invoices=s.orders.filter(o=>o.kind==='invoice');const revenue=money(invoices.reduce((a,o)=>a+o.subtotal,0)),cost=money(invoices.reduce((a,o)=>a+o.cost,0)),expenses=money(s.expenses.reduce((a,e)=>a+e.amount,0)+salaryExpenses(s));return {revenue,cost,expenses,profit:money(revenue-cost-expenses),unpaid:money(invoices.reduce((a,o)=>a+paymentSummary(o).remaining,0))}}
export function validateBackup(s){
 if(!s||!['customers','vehicles','parts','orders','expenses'].every(k=>Array.isArray(s[k])))throw Error('ملف النسخة غير صالح');
 const str=x=>typeof x==='string',num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
 for(const k of ['customers','vehicles','parts','orders','expenses']){if(s[k].some(x=>!x||!str(x.id))||new Set(s[k].map(x=>x.id)).size!==s[k].length)throw Error('معرّفات غير صالحة')}
 if(s.customers.some(x=>!str(x.name)||!str(x.phone))||s.vehicles.some(x=>!str(x.model)||!str(x.plate)||!s.customers.some(c=>c.id===x.customerId))||s.parts.some(x=>!str(x.name)||!num(x.price)||!num(x.cost)||!Number.isInteger(x.stock)||x.stock<0)||s.expenses.some(x=>!str(x.name)||!num(x.amount)))throw Error('بيانات غير صالحة');
 if(s.vehicles.some(vehicle=>
  (Object.hasOwn(vehicle,'vin')&&(typeof vehicle.vin!=='string'||(vehicle.vin!==''&&!/^[A-HJ-NPR-Z0-9]{17}$/.test(vehicle.vin))))||
  (Object.hasOwn(vehicle,'year')&&vehicle.year!==''&&(!Number.isInteger(vehicle.year)||vehicle.year<1900||vehicle.year>new Date().getUTCFullYear()+1))||
  ['engine','fuel'].some(key=>Object.hasOwn(vehicle,key)&&typeof vehicle[key]!=='string')
 ))throw Error('بيانات رقم الهيكل أو سنة السيارة أو المحرك غير صالحة');
 if(Object.hasOwn(s,'suppliers')) {
  if(!Array.isArray(s.suppliers))throw Error('قائمة الموردين غير صالحة');
  if(s.suppliers.some(supplier=>!supplier||typeof supplier.id!=='string'||!supplier.id.trim())||new Set(s.suppliers.map(supplier=>supplier.id)).size!==s.suppliers.length)throw Error('معرّفات الموردين غير صالحة');
  const supported=new Set([...SUPPORTED_SUPPLIER_BRANDS,'*']);
  if(s.suppliers.some(supplier=>typeof supplier.name!=='string'||!supplier.name.trim()||!validNormalizedSupplierPhone(supplier.phone)||!Array.isArray(supplier.brands)||supplier.brands.some(brand=>!supported.has(brand))||new Set(supplier.brands).size!==supplier.brands.length||
   (Object.hasOwn(supplier,'notes')&&typeof supplier.notes!=='string')||(Object.hasOwn(supplier,'active')&&typeof supplier.active!=='boolean')
  ))throw Error('بيانات المورد أو رقم واتساب أو تخصصه غير صالحة');
 }
 if(s.orders.some(x=>Object.hasOwn(x,'messageLanguage')&&!['ar','en'].includes(x.messageLanguage)))throw Error('لغة رسالة المستند غير صالحة');
 if(s.orders.some(x=>Object.hasOwn(x,'documentLanguage')&&!['ar','en','both'].includes(x.documentLanguage)))throw Error('لغة المستند غير صالحة');
 if(s.orders.some(x=>Object.hasOwn(x,'descriptionEn')&&(typeof x.descriptionEn!=='string'||x.descriptionEn.length>10000)))throw Error('وصف الخدمة بالإنجليزية غير صالح أو طويل جدًا.');
 if(s.orders.some(x=>Object.hasOwn(x,'partsRequest')&&(
  !x.partsRequest||typeof x.partsRequest!=='object'||Array.isArray(x.partsRequest)||
  typeof x.partsRequest.arText!=='string'||typeof x.partsRequest.enText!=='string'||
  !['manual','ai','dictionary',''].includes(x.partsRequest.translationSource)||
  (Object.hasOwn(x.partsRequest,'updatedAt')&&!validISOTime(x.partsRequest.updatedAt))
 )))throw Error('بيانات طلب قطع الغيار غير صالحة');
 if(s.orders.some(x=>!['quote','invoice'].includes(x.kind)||!str(x.number)||!str(x.description)||!str(x.status)||!str(x.date)||!str(x.partName)||typeof x.paid!=='boolean'||!(x.kind==='quote'&&x.guest&&x.vehicleId===''||s.vehicles.some(v=>v.id===x.vehicleId))||!['labor','qty','partPrice','cost','subtotal','tax','total'].every(k=>num(x[k]))))throw Error('مستند غير صالح');
 validateOperationalData(s);
 return s;
}
export function demo(){let s=empty();s.customers=[{id:'c1',name:'أحمد المنصوري',phone:'0501234567'},{id:'c2',name:'خالد عبدالله',phone:'0507654321'}];s.vehicles=[{id:'v1',customerId:'c1',model:'Toyota Land Cruiser · 2022',plate:'أبوظبي  •  45821'},{id:'v2',customerId:'c2',model:'Nissan Patrol · 2021',plate:'أبوظبي  •  92104'}];s.parts=[{id:'p1',name:'فلتر زيت / Oil filter',stock:18,cost:25,price:45},{id:'p2',name:'زيت محرك / Engine oil',stock:4,cost:90,price:140}];createOrder(s,{vehicleId:'v1',description:'تغيير زيت المحرك والفلاتر / Oil service',kind:'invoice',labor:180,partId:'p1',qty:1});s.expenses=[{id:'e1',name:'مستلزمات الورشة',amount:40}];return s}

// Preparing a click-to-chat link does not send a message or change an order.
export function normalizeWhatsAppPhone(input) {
 const invalid=()=>new Error('أدخل رقم واتساب صحيحًا: 0501234567 أو رقمًا دوليًا يبدأ بـ + أو 00.');
 if(typeof input!=='string')throw invalid();
 let phone=input.trim()
  .replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-0x0660))
  .replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-0x06f0))
  .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,'');
 if(!phone||!/^[\d+\s()-]+$/.test(phone))throw invalid();
 phone=phone.replace(/[\s()-]/g,'');
 if(/^05\d{8}$/.test(phone))return '971'+phone.slice(1);
 const international=phone.startsWith('+')||phone.startsWith('00');
 if(phone.startsWith('+'))phone=phone.slice(1);
 else if(phone.startsWith('00'))phone=phone.slice(2);
 // An unprefixed UAE mobile is unambiguous; other countries need + or 00.
 if(!international&&!/^9715\d{8}$/.test(phone))throw invalid();
 if(!/^[1-9]\d{7,14}$/.test(phone))throw invalid();
 if(phone.startsWith('9715')&&!/^9715\d{8}$/.test(phone))throw invalid();
 return phone;
}

export function buildWhatsAppUrl(phone,text) {
 const destination=normalizeWhatsAppPhone(phone);
 if(typeof text!=='string'||!text.trim())throw Error('اكتب نص رسالة واتساب أولًا.');
 return `https://wa.me/${destination}?text=${encodeURIComponent(text)}`;
}

export function serviceMessage({kind,customerName,model,plate,orderNumber,language='ar'}={}) {
 if(!['received','ready'].includes(kind))throw Error('اختر رسالة استلام السيارة أو جاهزيتها.');
 if(!['ar','en'].includes(language))throw Error('اختر العربية أو الإنجليزية لرسالة واتساب.');
 const clean=value=>String(value??'').trim();
 const arabic=language==='ar';
 const name=clean(customerName)||(arabic?'عميلنا العزيز':'valued customer');
 const labels=arabic
  ?{greeting:`مرحبًا ${name} 👋`,garage:'*كراج زاخر لصيانة السيارات*',vehicle:'السيارة',plate:'رقم اللوحة',order:'رقم أمر الصيانة',received:'🔧 تم استلام سيارتك للصيانة.',ready:'✅ اكتملت صيانة سيارتك وهي جاهزة للاستلام.',next:'سنبلغك عند جاهزيتها.',thanks:'💙 شكرًا لثقتك بنا.'}
  :{greeting:`Hello ${name} 👋`,garage:'*Zakher Garage · Auto Maintenance*',vehicle:'Vehicle',plate:'Plate',order:'Service order',received:"🔧 We've received your vehicle for service.",ready:"✅ Your vehicle's service is complete and it's ready for collection.",next:"We'll notify you when it's ready for collection.",thanks:'💙 Thank you for your trust.'};
 const details=[
  clean(model)?`🚘 ${labels.vehicle}: ${clean(model)}`:'',
  clean(plate)?`📍 ${labels.plate}: ${clean(plate)}`:'',
  clean(orderNumber)?`🧾 ${labels.order}: ${clean(orderNumber)}`:''
 ].filter(Boolean).join('\n');
 const closing=[kind==='received'?labels.next:'',labels.thanks].filter(Boolean).join('\n');
 return [labels.greeting,labels.garage,labels[kind],details,closing].filter(Boolean).join('\n\n');
}
