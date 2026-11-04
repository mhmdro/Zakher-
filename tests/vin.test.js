import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {normalizeVin,getVinCandidates,vinChecksum,lookupVin,recognizeVinImage} from '../vin.js';
const VIN='1HGCM82633A004352';

test('VIN input normalizes case and explicit separators without substituting ambiguous letters',()=>{
 assert.equal(normalizeVin(' 1hg-cm826 33a004352 '),VIN);
 assert.equal(normalizeVin('１ＨＧＣＭ８２６３３Ａ００４３５２'),VIN);
 for(const value of ['',null,123,VIN+'X',VIN.slice(1),'VIN: '+VIN,'1HGCM826\n33A004352','1HGCM82633AO04352','1HGCM82633AI04352','1HGCM82633AQ04352','١HGCM82633A004352'])assert.throws(()=>normalizeVin(value),undefined,String(value));
});

test('OCR candidate extraction preserves each line and rejects ambiguous or oversized tokens',()=>{
 assert.deepEqual(getVinCandidates(`VIN: ${VIN}\nMAKE: HONDA\n${VIN}`),[VIN]);
 assert.deepEqual(getVinCandidates('VIN: 1HG CM826 33A004352'),[VIN]);
 assert.deepEqual(getVinCandidates('1 H G C M 8 2 6 3 3 A 0 0 4 3 5 2'),[VIN]);
 for(const text of ['1HGCM826\n33A004352','CAR NUMBER: 1HG CM826 33A004352','CAR NUMBER 12345678','1HGCM82633AO04352',VIN+'X',null])assert.deepEqual(getVinCandidates(text),[],String(text));
});

test('VIN checksum is informational and does not reject valid-format GCC/world VINs',()=>{
 assert.deepEqual(vinChecksum(VIN),{expected:'3',actual:'3',matches:true});
 const mismatch='1HGCM82643A004352';assert.equal(normalizeVin(mismatch),mismatch);assert.equal(vinChecksum(mismatch).matches,false);assert.deepEqual(getVinCandidates(mismatch),[mismatch]);
});

test('vPIC lookup maps only official returned fields and sends only normalized VIN text',async()=>{
 let requested;
 const result=await lookupVin(VIN.toLowerCase(),{fetchImpl:async(url,options)=>{requested={url,options};return {ok:true,json:async()=>({Results:[{VIN,Make:'HONDA',Model:'Accord',ModelYear:'2003',DisplacementL:'3.000',EngineCylinders:'6',EngineModel:'J30A4',EngineConfiguration:'V-Shaped',FuelTypePrimary:'Gasoline',ErrorCode:'0',ErrorText:'0 - VIN decoded clean.'}]})}}});
 assert.equal(requested.url,`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${VIN}?format=json`);
 assert.equal(requested.options.method,'GET');assert.equal(requested.options.credentials,'omit');assert(!('body' in requested.options));
 assert.deepEqual(result,{vin:VIN,make:'HONDA',model:'Accord',year:'2003',engine:'3 L · 6 cylinders · J30A4 · V-Shaped',fuel:'Gasoline',errors:[],source:requested.url});
});

test('vPIC missing values remain blank, no guessed year is generated, and decode warnings are retained',async()=>{
 const result=await lookupVin(VIN,{fetchImpl:async()=>({ok:true,json:async()=>({Results:[{VIN,Make:'N/A',Model:null,ModelYear:'',DisplacementL:'0',EngineCylinders:'0',FuelTypePrimary:'Not Applicable',ErrorCode:'1,7',ErrorText:'VIN check digit and manufacturer need review.'}]})})});
 assert.equal(result.make,'');assert.equal(result.model,'');assert.equal(result.year,'');assert.equal(result.engine,'');assert.equal(result.fuel,'');assert.deepEqual(result.errors,['VIN check digit and manufacturer need review.']);
});

test('lookup rejects malformed VIN before network and handles unavailable, malformed and mismatched responses',async()=>{
 let calls=0;await assert.rejects(()=>lookupVin('bad',{fetchImpl:async()=>{calls++}}));assert.equal(calls,0);
 await assert.rejects(()=>lookupVin(VIN,{fetchImpl:async()=>{throw new TypeError('offline')}}),/NHTSA/);
 await assert.rejects(()=>lookupVin(VIN,{fetchImpl:async()=>({ok:false,status:503})}),/غير متاحة/);
 await assert.rejects(()=>lookupVin(VIN,{fetchImpl:async()=>({ok:true,json:async()=>{throw Error('invalid')}})}),/رد غير صالح/);
 await assert.rejects(()=>lookupVin(VIN,{fetchImpl:async()=>({ok:true,json:async()=>({Results:[]})})}),/سجل/);
 await assert.rejects(()=>lookupVin(VIN,{fetchImpl:async()=>({ok:true,json:async()=>({Results:[{VIN:'1HGCM82643A004352'}]})})}),/لا يطابق/);
});

test('pre-aborted OCR and lookup calls preserve AbortError without network or worker initialization',async()=>{
 const controller=new AbortController();controller.abort();let called=false;
 await assert.rejects(()=>lookupVin(VIN,{signal:controller.signal,fetchImpl:async()=>{called=true}}),{name:'AbortError'});assert(!called);
 await assert.rejects(()=>recognizeVinImage(null,{signal:controller.signal}),{name:'AbortError'});
});

test('OCR input rejects HEIC, empty/oversized files and corrupt or mismatched image headers',async()=>{
 await assert.rejects(()=>recognizeVinImage(new Blob(['heic'],{type:'image/heic'})),/HEIC/);
 await assert.rejects(()=>recognizeVinImage(new Blob([],{type:'image/png'})),/فارغة/);
 const megabyte=new Uint8Array(1024*1024);await assert.rejects(()=>recognizeVinImage(new Blob(Array(21).fill(megabyte),{type:'image/jpeg'})),/20/);
 await assert.rejects(()=>recognizeVinImage(new Blob(['not a photo'],{type:'image/jpeg'})),/JPEG/);
 await assert.rejects(()=>recognizeVinImage(new Blob([new Uint8Array([255,216,255,0])],{type:'image/png'})),/JPEG/);
});

test('vendored OCR files match recorded SHA256 checksums and source archive integrity is recorded',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../vendor/ocr/integrity.json',import.meta.url),'utf8'));
 assert.equal(Object.keys(manifest.packages).length,3);
 for(const item of Object.values(manifest.packages)){assert.match(item.tarball,/^https:\/\/registry\.npmjs\.org\//);assert.match(item.integrity,/^sha512-/)}
 for(const [path,expected] of Object.entries(manifest.files)){const content=await readFile(new URL('../'+path,import.meta.url));assert.equal(content.length,expected.bytes,path);assert.equal(createHash('sha256').update(content).digest('hex'),expected.sha256,path)}
});
