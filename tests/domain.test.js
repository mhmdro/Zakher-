import {test} from 'node:test';import assert from 'node:assert/strict';import {demo,createOrder,updateOrder,summary,validateBackup,normalizeWhatsAppPhone,buildWhatsAppUrl,serviceMessage} from '../domain.js';
test('invoice deducts stock and snapshots costs and VAT',()=>{const s=demo(),stock=s.parts[0].stock;const o=createOrder(s,{vehicleId:'v1',description:'Repair',kind:'invoice',labor:100,partId:'p1',qty:2});assert.equal(s.parts[0].stock,stock-2);assert.equal(o.subtotal,190);assert.equal(o.tax,9.5);assert.equal(o.total,199.5);assert.equal(o.cost,50);s.parts[0].cost=999;assert.equal(o.cost,50)});
test('quote does not change stock or revenue',()=>{const s=demo(),before=summary(s),stock=s.parts[0].stock;createOrder(s,{vehicleId:'v1',description:'Quote',kind:'quote',labor:100,partId:'p1',qty:100});assert.equal(s.parts[0].stock,stock);assert.deepEqual(summary(s),before)});
test('insufficient stock rejected without partial changes',()=>{const s=demo(),before=structuredClone(s);assert.throws(()=>createOrder(s,{vehicleId:'v1',description:'Repair',kind:'invoice',labor:20,partId:'p1',qty:100}));assert.deepEqual(s,before)});
test('invalid amounts, quantities and vehicle rejected',()=>{for(const override of [{labor:-1},{labor:'NaN'},{qty:1.5,partId:'p1'},{vehicleId:'missing'},{description:' '},{kind:'bad'}]){const s=demo();assert.throws(()=>createOrder(s,{vehicleId:'v1',description:'Repair',kind:'invoice',labor:10,qty:0,...override}))}});
test('profit excludes VAT, quotes, and includes expenses and cost',()=>{const s=demo();assert.deepEqual(summary(s),{revenue:225,cost:25,expenses:40,profit:160,unpaid:236.25});s.orders[0].paid=true;assert.equal(summary(s).unpaid,0);assert.equal(summary(s).profit,160)});
test('backup round-trip and invalid imports',()=>{const s=demo();assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);assert.throws(()=>validateBackup({}));s.parts[0].stock=-1;assert.throws(()=>validateBackup(s));const t=demo();t.vehicles[0].customerId='missing';assert.throws(()=>validateBackup(t))});

test('WhatsApp normalizes UAE local, international and Arabic/Persian digits',()=>{
 for(const phone of ['0501234567','050 123 4567','(050) 123-4567','+971 50 123 4567','00971 (50) 123-4567','971501234567','٠٥٠١٢٣٤٥٦٧','۰۵۰ ۱۲۳ ۴۵۶۷','\u200f+٩٧١ ٥٠ ١٢٣ ٤٥٦٧']){
  assert.equal(normalizeWhatsAppPhone(phone),'971501234567',phone);
 }
 assert.equal(normalizeWhatsAppPhone(' +44 7700 900123 '),'447700900123');
 assert.equal(normalizeWhatsAppPhone('001-202-555-0123'),'12025550123');
});

test('WhatsApp rejects ambiguous, malformed or invalid-length destinations',()=>{
 for(const phone of ['',null,501234567,'050123456','05012345678','501234567','447700900123','2025550123','+97150123456','+9715012345678','++971501234567','+00971501234567','+97150+1234567','0501234567 ext 2','https://wa.me/971501234567','+1234567','+1234567890123456','0044007700900123x']){
  assert.throws(()=>normalizeWhatsAppPhone(phone),/أدخل رقم واتساب صحيحًا/,String(phone));
 }
});

test('WhatsApp URL keeps only a validated destination and encodes message text',()=>{
 const text='مرحبًا أحمد & خالد\nاللوحة: أ 123 / Ready?';
 const link=buildWhatsAppUrl('٠٥٠١٢٣٤٥٦٧',text);
 assert.equal(link,`https://wa.me/971501234567?text=${encodeURIComponent(text)}`);
 const parsed=new URL(link);
 assert.equal(parsed.host,'wa.me');assert.equal(parsed.pathname,'/971501234567');
 assert.equal(parsed.searchParams.get('text'),text);assert.equal([...parsed.searchParams].length,1);
 assert.throws(()=>buildWhatsAppUrl('0501234567','   '),/اكتب نص رسالة/);
 assert.throws(()=>buildWhatsAppUrl('not a phone',text),/أدخل رقم واتساب/);
});

test('service notification text identifies the garage, customer, vehicle and order',()=>{
 const details={customerName:'أحمد',model:'Toyota Land Cruiser',plate:'أبوظبي 12345',orderNumber:'INV-1002'};
 const received=serviceMessage({...details,kind:'received'}),ready=serviceMessage({...details,kind:'ready'});
 for(const text of [received,ready])for(const part of ['كراج زاخر','أحمد','Toyota Land Cruiser','أبوظبي 12345','INV-1002'])assert(text.includes(part));
 assert(received.includes('تم استلام سيارتك'));assert(received.includes('سنبلغك عند جاهزيتها'));
 assert(ready.includes('جاهزة للاستلام'));assert(!ready.includes('مدفوعة'));assert(!ready.includes('تم تسليم'));
 assert(!serviceMessage({kind:'received'}).includes('undefined'));
 assert.throws(()=>serviceMessage({...details,kind:'paid'}),/اختر رسالة/);
});


test('editing the same invoice part adjusts only net stock and preserves snapshot unit prices',()=>{
 const s=demo(),o=s.orders[0],before=structuredClone(o),stock=s.parts[0].stock;
 s.parts[0].price=500;s.parts[0].cost=300;s.parts[0].name='Renamed';
 const same=updateOrder(s,o.id,{});assert.deepEqual(same,before);assert.equal(s.parts[0].stock,stock);
 updateOrder(s,o.id,{description:'Updated service',labor:100,qty:3});
 assert.equal(s.parts[0].stock,stock-2);assert.equal(o.partPrice,45);assert.equal(o.cost,75);assert.equal(o.partName,before.partName);
 assert.equal(o.subtotal,235);assert.equal(o.tax,11.75);assert.equal(o.total,246.75);
 assert.equal(o.vehicleId,before.vehicleId);assert.equal(o.kind,before.kind);assert.equal(o.status,before.status);assert.equal(o.paid,false);
 updateOrder(s,o.id,{qty:1});assert.equal(s.parts[0].stock,stock);assert.equal(o.cost,25);
});

test('invoice pricing can add, change and remove a part while returning the previous stock',()=>{
 const s=demo(),o=createOrder(s,{vehicleId:'v2',description:'Intake',kind:'invoice',labor:0,qty:0});
 const stocks=s.parts.map(p=>p.stock);
 updateOrder(s,o.id,{labor:100,partId:'p1',qty:2});
 assert.equal(s.parts[0].stock,stocks[0]-2);assert.equal(o.total,199.5);
 updateOrder(s,o.id,{partId:'p2',qty:1});
 assert.equal(s.parts[0].stock,stocks[0]);assert.equal(s.parts[1].stock,stocks[1]-1);
 assert.equal(o.partPrice,140);assert.equal(o.cost,90);assert.equal(o.total,252);
 updateOrder(s,o.id,{partId:'',qty:0});
 assert.deepEqual(s.parts.map(p=>p.stock),stocks);assert.equal(o.partName,'');assert.equal(o.partPrice,0);assert.equal(o.cost,0);assert.equal(o.total,105);
});

test('invoice update rejects invalid inputs and insufficient stock without partial mutations',()=>{
 for(const changes of [{qty:100},{partId:'missing',qty:1},{description:' '},{labor:-1},{qty:1.5},{partId:'',qty:2},{partId:'p1',qty:0}]){
  const s=demo(),before=structuredClone(s);
  assert.throws(()=>updateOrder(s,s.orders[0].id,changes));assert.deepEqual(s,before);
 }
 const s=demo();s.orders[0].paid=true;const before=structuredClone(s);
 assert.throws(()=>updateOrder(s,s.orders[0].id,{labor:500}),/ألغِ تسجيل الدفع/);assert.deepEqual(s,before);
 assert.throws(()=>updateOrder(s,'missing',{labor:5}),/غير موجود/);
});

test('quote updates preserve snapshots, exclude revenue and never change stock',()=>{
 const s=demo(),o=createOrder(s,{vehicleId:'v1',description:'Quote',kind:'quote',labor:0,partId:'p1',qty:2});
 const stocks=s.parts.map(p=>p.stock),financial=summary(s);s.parts[0].price=999;s.parts[0].cost=999;
 updateOrder(s,o.id,{qty:100,labor:10});assert.equal(o.partPrice,45);assert.equal(o.cost,2500);assert.equal(o.subtotal,4510);
 updateOrder(s,o.id,{partId:'p2',qty:20});assert.equal(o.partPrice,140);assert.equal(o.cost,1800);
 assert.deepEqual(s.parts.map(p=>p.stock),stocks);assert.deepEqual(summary(s),financial);
 updateOrder(s,o.id,{partId:'',qty:0});assert.equal(o.total,10.5);assert.deepEqual(s.parts.map(p=>p.stock),stocks);
});
