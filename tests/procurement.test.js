import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildWhatsAppUrl} from '../domain.js';
import {supplierRecommendations,buildPartsRequestMessage,translateCommonParts,validateVehicleVin,SUPPORTED_SUPPLIER_BRANDS} from '../procurement.js';

const contact=(id,brands,extra={})=>({id,name:'Supplier '+id,phone:'+971501234567',brands,...extra});

test('supplier recommendations rank exact stored make matches before general stores',()=>{
 const suppliers=[contact('general',['*']),contact('toyota',['toyota']),contact('nissan',['nissan']),contact('both',['*','nissan']),contact('inactive',['nissan'],{active:false})];
 const before=structuredClone(suppliers),result=supplierRecommendations(suppliers,'نيسان ألتيما 2021');
 assert.deepEqual(result.map(x=>[x.supplier.id,x.reason]),[['nissan','brand'],['both','brand'],['general','general']]);
 assert.equal(result[0].supplier,suppliers[2]);assert.deepEqual(suppliers,before);
 assert.deepEqual(supplierRecommendations(suppliers,'Toyota Camry').map(x=>[x.supplier.id,x.reason]),[['toyota','brand'],['general','general'],['both','general']]);
});

test('unknown makes only recommend general stores and unsupported/inactive contacts stay excluded',()=>{
 const suppliers=[contact('general',['*']),contact('nissan',['nissan']),contact('fake',['unsupported','*']),contact('disabled',['*'],{active:false}),contact('bad-active',['*'],{active:'true'}),contact('empty',[]),contact('invalid',null),null];
 const result=supplierRecommendations(suppliers,'Unknown make');
 assert.deepEqual(result.map(x=>[x.supplier.id,x.reason]),[['general','general']]);
 assert.deepEqual(supplierRecommendations(null,'Nissan'),[]);
 assert.deepEqual(supplierRecommendations([contact('same',['*']),contact('same',['nissan'])],'Nissan').map(x=>x.supplier.id),['same']);
 assert.equal(SUPPORTED_SUPPLIER_BRANDS.length,28);
});

test('VIN validation accepts only an optional uppercase 17-character VIN without I O Q',()=>{
 assert.equal(validateVehicleVin('1HGCM82633A004352'),'1HGCM82633A004352');assert.equal(validateVehicleVin(''),'');
 assert.throws(()=>validateVehicleVin('',{allowEmpty:false}),/VIN/);
 for(const vin of ['1hgcm82633a004352',' 1HGCM82633A004352','1HGCM82633A00435I','1HGCM82633A00435O','1HGCM82633A00435Q','1HGCM82633A00435',null,17])assert.throws(()=>validateVehicleVin(vin),/VIN/);
});

test('supplier request preserves selected lines and VIN and round-trips safely into WhatsApp',()=>{
 const details={vehicleModel:'Toyota & Lexus service',vin:'1HGCM82633A004352',plate:'أبوظبي 12345',orderNumber:'INV-1003',arText:'فلتر زيت\nفحمات فرامل عدد 2',enText:'Oil filter\nBrake pads — 2 sets'};
 const english=buildPartsRequestMessage(details),arabic=buildPartsRequestMessage({...details,language:'ar'});
 for(const message of [english,arabic])for(const text of [details.vehicleModel,details.vin,details.plate,details.orderNumber])assert(message.includes(text));
 assert(english.includes(details.enText));assert(!english.includes(details.arText));assert(english.includes('Please quote'));assert(english.includes('confirm fitment'));
 assert(arabic.includes(details.arText));assert(!arabic.includes(details.enText));assert(arabic.includes('عرض سعر'));assert(arabic.includes('تأكيد توافق'));
 const url=new URL(buildWhatsAppUrl('0501234567',english));assert.equal(url.pathname,'/971501234567');assert.equal(url.searchParams.get('text'),english);assert.equal([...url.searchParams].length,1);
 assert(!/in stock|confirmed compatible|verified availability|part number:/i.test(english));
});

test('request builder rejects invalid VIN and missing selected-language text without translating silently',()=>{
 const details={vehicleModel:'Nissan Altima',arText:'فلتر زيت',enText:'Oil filter'};
 for(const vin of ['bad','1HGCM82633A00435I'])assert.throws(()=>buildPartsRequestMessage({...details,vin}),/VIN/);
 assert.throws(()=>buildPartsRequestMessage({...details,language:'fr'}),/العربية أو الإنجليزية/);
 assert.throws(()=>buildPartsRequestMessage({...details,enText:''}),/بالإنجليزية/);
 assert.throws(()=>buildPartsRequestMessage({...details,language:'ar',arText:' '}),/بالعربية/);
 const omitted=buildPartsRequestMessage(details);assert(!omitted.includes('VIN:'));assert(!omitted.includes('undefined'));assert(!omitted.includes('Plate:'));
});

test('local part dictionary translates exact known lines and retains unknown quantities and specifications',()=>{
 const input='فلتر زيت\nبَطَّارِيَّة\n2 فلتر هواء\nفحمات فرامل عدد 4\nفلتر زيت أصلي 12345\nقطعة غير معروفة\n';
 const result=translateCommonParts(input);
 assert.equal(result.text,'Oil filter\nBattery\n2 فلتر هواء\nفحمات فرامل عدد 4\nفلتر زيت أصلي 12345\nقطعة غير معروفة\n');
 assert.deepEqual(result.untranslated,['2 فلتر هواء','فحمات فرامل عدد 4','فلتر زيت أصلي 12345','قطعة غير معروفة']);
 assert.deepEqual(translateCommonParts(''),{text:'',untranslated:[]});
 assert.deepEqual(translateCommonParts('__proto__\ntoString'),{text:'__proto__\ntoString',untranslated:['__proto__','toString']});
 assert.throws(()=>translateCommonParts(null),/قائمة القطع/);
});
