import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {vehicleArtwork} from '../vehicle-art.js';

const brandIds=['nissan','toyota','bmw','mercedes','honda','hyundai','kia','landrover','audi','volkswagen','ford','chevrolet','mitsubishi','mazda','suzuki','subaru','renault','peugeot','porsche','tesla','volvo','jeep','infiniti','cadillac','bentley','mini','skoda','rollsroyce'];

test('manufacturer logos match Arabic spelling, diacritics, English case and punctuation',()=>{
 const cases=[['نيسان ألتيما','nissan'],['نِيسَان آلتيما ٢٠٢٤','nissan'],['NISSAN ALTIMA 2024','nissan'],['Nissan-Altima','nissan'],['نيسان التــيما','nissan'],['TOYOTA كامري ٢٠٢٣','toyota'],['أُودِي A6','audi'],['B.M.W. X5','bmw'],['بي إم دبليو 320i','bmw'],['مرسيدس-بنز C200','mercedes'],['فولكس فاجن جولف','volkswagen'],['رولزرويس','rollsroyce'],['Škoda Octavia','skoda']];
 for(const [name,id] of cases){const result=vehicleArtwork(name);assert.equal(result.id,id,name);assert.equal(result.kind,'brand');assert.equal(result.src,`./assets/brands/${id}.svg`);assert.match(result.label,/^شعار /)}
});

test('known model-only names resolve to their manufacturer, including Arabic numerals',()=>{
 const cases=[['ألتيما','nissan'],['Patrol','nissan'],['صني','nissan'],['Camry','toyota'],['كورولا','toyota'],['Land Cruiser','toyota'],['لاندكروزر','toyota'],['Hilux','toyota'],['يارس','toyota'],['أكورد','honda'],['Civic','honda'],['K۵','kia'],['ك٥','kia'],['أوبتيما','kia'],['Sonata','hyundai'],['إلنترا','hyundai'],['توسان','hyundai'],['Range Rover Sport','landrover'],['رنج روفر','landrover']];
 for(const [name,id] of cases)assert.equal(vehicleArtwork(name).id,id,name);
});

test('an explicit manufacturer takes precedence over conflicting model aliases',()=>{
 for(const [name,id] of [['Nissan model Camry','nissan'],['Toyota Altima','toyota'],['كامري نيسان','nissan'],['BMW X5','bmw'],['مرسيدس التيما','mercedes'],['جيب تويوتا لاند كروزر','toyota']])assert.equal(vehicleArtwork(name).id,id,name);
});

test('all 28 supported makes have exact allowlisted brand identities',()=>{
 for(const id of brandIds){const lookup=id==='mercedes'?'Mercedes-Benz':id;assert.equal(vehicleArtwork(lookup).id,id,lookup)}
 for(const [name,id] of [['كاديلاك','cadillac'],['إنفينيتي','infiniti'],['ميتسوبيشي','mitsubishi'],['بنتلي','bentley'],['فورد','ford'],['سكودا','skoda'],['جيب','jeep']])assert.equal(vehicleArtwork(name).id,id,name);
});

test('unknown and bounded-mismatch names return no image instead of invented art',()=>{
 const expected={id:'unknown',label:'الشركة غير معروفة',src:null,kind:'unknown'};
 for(const name of ['',null,undefined,123,{},'xBMWx','notcamry','altimax','Nissanx','patrolling','SUV','سيارة سيدان','Unknown brand','GMC','Lexus','BYD','Genesis','Isuzu','A'.repeat(501)])assert.deepEqual(vehicleArtwork(name),expected,String(name));
});

test('pasted URLs, HTML and attribute-like text cannot create a logo or arbitrary URL',()=>{
 for(const name of ['<img src=x onerror=alert(1)>','<script>Nissan</script>','https://example.com/Nissan','https://nissan.com','www.toyota.com','javascript:Nissan','data:image/svg+xml,Nissan','file:///nissan.svg','Nissan" onerror="alert(1)'])assert.deepEqual(vehicleArtwork(name),{id:'unknown',label:'الشركة غير معروفة',src:null,kind:'unknown'},name);
 for(const name of ['Nissan','نيسان','Unknown brand']){const result=vehicleArtwork(name);if(result.src)assert.match(result.src,/^\.\/assets\/brands\/[a-z]+\.svg$/);assert(!/[<>&]/.test(result.label))}
});

test('every returned manufacturer asset exists and is a non-executable official-size SVG',async()=>{
 for(const id of brandIds){const svg=await readFile(new URL(`../assets/brands/${id}.svg`,import.meta.url),'utf8');assert.match(svg,/<svg\b/);assert.match(svg,/viewBox="0 0 24 24"/);assert(!/<script|<foreignObject|onload=|onclick=|href=|url\(https?:/i.test(svg),id)}
});
