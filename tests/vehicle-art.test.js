import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {vehicleArtwork} from '../vehicle-art.js';

test('Altima matches Arabic hamza/diacritics, English case and punctuation',()=>{
 for(const name of ['نيسان ألتيما','نِيسَان آلتيما ٢٠٢٤','NISSAN ALTIMA 2024','Nissan-Altima','ألتيما','نيسان التــيما']){
  const result=vehicleArtwork(name);
  assert.equal(result.id,'sedan-altima',name);
  assert.match(result.label,/Nissan Altima/);
  assert.equal(result.src,'./assets/vehicles/sedan-altima.svg');
 }
});

test('sedan, SUV and pickup models have appropriate distinct profiles',()=>{
 const cases=[['نيسان باترول','suv-large','Nissan Patrol'],['Nissan Sunny','sedan-compact','Nissan Sunny'],['تويوتا كامري','sedan-camry','Toyota Camry'],['Toyota Corolla','sedan-compact','Toyota Corolla'],['لاند كروزر','suv-large','Toyota Land Cruiser'],['Toyota Hilux','pickup','Toyota Hilux'],['تويوتا يارس','sedan-compact','Toyota Yaris'],['هوندا أكورد','sedan-sport','Honda Accord'],['Honda Civic','sedan-sport','Honda Civic'],['BMW 320i','sedan-luxury','BMW'],['مرسيدس C200','sedan-luxury','Mercedes'],['Kia K۵','sedan-sport','Kia K5'],['كيا K٥','sedan-sport','Kia K5'],['كيا أوبتيما','sedan-sport','Kia Optima'],['هيونداي سوناتا','sedan-camry','Hyundai Sonata'],['Hyundai Elantra','sedan-compact','Hyundai Elantra'],['هيونداي توسان','suv-crossover','Hyundai Tucson'],['Range Rover Sport','suv-large','Range Rover']];
 for(const [name,id,label] of cases){const result=vehicleArtwork(name);assert.equal(result.id,id,name);assert(result.label.includes(label),name)}
 assert.notEqual(vehicleArtwork('Nissan Altima').src,vehicleArtwork('Nissan Patrol').src);
});

test('aliases are bounded; unknown text never chooses a partial model match',()=>{
 for(const name of ['malaltima','altimax','notcamry','xBMWx','civics','patrolling','range rovers','mysecreturl',''])assert.equal(vehicleArtwork(name).id,'generic',name);
 assert.equal(vehicleArtwork(null).id,'generic');
 assert.equal(vehicleArtwork('carSUVtruck').id,'generic');
});

test('explicit generic body type selects a local illustration',()=>{
 assert.equal(vehicleArtwork('Unknown sedan 2023').id,'sedan-compact');
 assert.equal(vehicleArtwork('سيارة صالون').id,'sedan-compact');
 assert.equal(vehicleArtwork('Unknown SUV').id,'suv-crossover');
 assert.equal(vehicleArtwork('دفع رباعي').id,'suv-crossover');
 assert.equal(vehicleArtwork('Unknown pick-up').id,'pickup');
 assert.equal(vehicleArtwork('بيك أب').id,'pickup');
});

test('arbitrary markup and URLs cannot enter returned paths or labels',()=>{
 for(const name of ['<img src=x onerror=alert(1)>','https://evil.example/car.svg','../../secret.svg','javascript:alert(1)','<script>Altima</script>']){
  const result=vehicleArtwork(name);
  assert.match(result.src,/^\.\/assets\/vehicles\/[a-z-]+\.svg$/);
  assert(!/[<>&]/.test(result.label));
  assert(!result.src.includes('evil'));
 }
});

test('all allowlisted SVG thumbnails exist and contain no remote or executable content',async()=>{
 const assets=await readdir(new URL('../assets/vehicles/',import.meta.url));
 assert.deepEqual(assets.sort(),['generic.svg','pickup.svg','sedan-altima.svg','sedan-camry.svg','sedan-compact.svg','sedan-luxury.svg','sedan-sport.svg','suv-crossover.svg','suv-large.svg']);
 for(const filename of assets){const svg=await readFile(new URL('../assets/vehicles/'+filename,import.meta.url),'utf8');assert(svg.startsWith('<svg'));assert.match(svg,/viewBox="0 0 160 112"/);assert(!/<script|<foreignObject|onload=|onclick=|href=|url\(https?:/i.test(svg),filename)}
});
