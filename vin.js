const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/';

export function normalizeVin(value) {
  if (typeof value !== 'string' || /[\r\n]/.test(value)) throw new Error('أدخل رقم هيكل واحدًا من 17 حرفًا ورقمًا.');
  const vin = value.normalize('NFKC').trim().toUpperCase().replace(/[\t \u00a0-]/g, '');
  if (!VIN_PATTERN.test(vin)) throw new Error('رقم الهيكل يجب أن يكون 17 حرفًا ورقمًا، ولا يتضمن I أو O أو Q. راجع الصورة دون استبدالها تلقائيًا.');
  return vin;
}

export function getVinCandidates(text) {
  if (typeof text !== 'string') return [];
  const candidates = new Set();
  for (const rawLine of text.normalize('NFKC').toUpperCase().split(/\r?\n/)) {
    const line = rawLine.trim();
    const tokens = /(^|[^A-Z0-9])([A-HJ-NPR-Z0-9]{17})(?=$|[^A-Z0-9])/g;
    for (const match of line.matchAll(tokens)) candidates.add(match[2]);
    // Rejoin spaces/dashes only when the whole line is a VIN or has an
    // explicit VIN label. Never combine different lines or arbitrary labels.
    const standalone = line.replace(/^(?:VIN|VEHICLE IDENTIFICATION NUMBER|CHASSIS(?: NUMBER| NO\.?)?|رقم(?: الهيكل| الشاصي)|الهيكل|الشاصي)\s*[:#-]?\s*/u, '');
    const unrelatedLabel=/\b(?:CAR|NUMBER|MAKE|MODEL|TYPE|YEAR|SERIAL|ENGINE|DATE|CODE|BODY|TRIM|PART|MANUFACTURER)\b/.test(standalone);
    if (!unrelatedLabel&&/^[A-Z0-9\t \u00a0-]+$/.test(standalone)) {
      try { candidates.add(normalizeVin(standalone)); } catch { /* Ambiguous OCR needs manual review. */ }
    }
  }
  return [...candidates];
}

export function vinChecksum(value) {
  const vin = normalizeVin(value);
  const values = {A:1,B:2,C:3,D:4,E:5,F:6,G:7,H:8,J:1,K:2,L:3,M:4,N:5,P:7,R:9,S:2,T:3,U:4,V:5,W:6,X:7,Y:8,Z:9};
  const weights = [8,7,6,5,4,3,2,10,0,9,8,7,6,5,4,3,2];
  const remainder = [...vin].reduce((sum,char,index)=>sum+(values[char]??Number(char))*weights[index],0)%11;
  const expected = remainder===10?'X':String(remainder);
  return {expected,actual:vin[8],matches:vin[8]===expected};
}

const abortError = () => new DOMException('تم إلغاء العملية.','AbortError');
const checkAborted = signal => { if(signal?.aborted)throw abortError(); };
const cleanText = value => typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,500):'';
const knownText = value => {const text=cleanText(value);return /^(?:not applicable|not available|unknown|n\/?a|null|0)$/i.test(text)?'':text};

export async function lookupVin(value, {fetchImpl=globalThis.fetch,signal}={}) {
  const vin=normalizeVin(value);
  checkAborted(signal);
  if(typeof fetchImpl!=='function')throw new Error('المتصفح لا يدعم الاتصال بخدمة بيانات السيارات.');
  const url=VPIC_BASE+encodeURIComponent(vin)+'?format=json';
  let response;
  try {response=await fetchImpl(url,{method:'GET',headers:{Accept:'application/json'},credentials:'omit',referrerPolicy:'no-referrer',signal});}
  catch(error){if(error?.name==='AbortError'||signal?.aborted)throw abortError();throw new Error('تعذر الاتصال بقاعدة NHTSA الرسمية. يمكنك إدخال بيانات السيارة يدويًا.');}
  if(!response?.ok)throw new Error('خدمة بيانات السيارات غير متاحة الآن. أدخل البيانات يدويًا أو حاول لاحقًا.');
  let payload;
  try{payload=await response.json();}catch{throw new Error('وصل رد غير صالح من خدمة بيانات السيارات.');}
  checkAborted(signal);
  const record=Array.isArray(payload?.Results)&&payload.Results[0];
  if(!record||typeof record!=='object'||Array.isArray(record))throw new Error('لم تُرجع الخدمة سجلًا صالحًا لهذا الرقم.');
  if(record.VIN&&normalizeVin(record.VIN)!==vin)throw new Error('رقم الهيكل في رد الخدمة لا يطابق الرقم الذي أدخلته.');
  const rawYear=knownText(record.ModelYear);
  const year=/^\d{4}$/.test(rawYear)&&Number(rawYear)>=1886&&Number(rawYear)<=2100?rawYear:'';
  const displacement=knownText(record.DisplacementL);
  const engine=[
    /^\d+(?:\.\d+)?$/.test(displacement)&&Number(displacement)>0?`${Number(displacement)} L`:'',
    /^\d{1,2}$/.test(knownText(record.EngineCylinders))&&Number(record.EngineCylinders)>0?`${record.EngineCylinders} cylinders`:'',
    knownText(record.EngineModel),knownText(record.EngineConfiguration),
  ].filter(Boolean).join(' · ');
  const codes=cleanText(record.ErrorCode).split(',').map(code=>code.trim()).filter(code=>code&&code!=='0');
  const errors=codes.length?[knownText(record.ErrorText)||`NHTSA decode warning: ${codes.join(', ')}`]:[];
  return {vin,make:knownText(record.Make),model:knownText(record.Model),year,engine,fuel:[knownText(record.FuelTypePrimary),knownText(record.FuelTypeSecondary)].filter(Boolean).join(' / '),errors,source:url};
}

async function validatePhoto(file) {
  if(typeof Blob==='undefined'||!(file instanceof Blob))throw new Error('اختر صورة واضحة لرقم الهيكل من جهازك.');
  if(/hei[cf]/i.test(file.type)||/\.hei[cf]$/i.test(file.name||''))throw new Error('صور HEIC غير مدعومة هنا. احفظ الصورة بصيغة JPEG أو PNG ثم أعد اختيارها.');
  if(!file.size)throw new Error('الصورة فارغة. اختر صورة أخرى.');
  if(file.size>MAX_IMAGE_BYTES)throw new Error('حجم الصورة يتجاوز 20 ميغابايت. قصّ الصورة حول رقم الهيكل أو اختر صورة أصغر.');
  const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
  const jpeg=bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff;
  const png=bytes.length>=8&&[137,80,78,71,13,10,26,10].every((byte,index)=>bytes[index]===byte);
  const webp=bytes.length>=12&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
  const detected=jpeg?'image/jpeg':png?'image/png':webp?'image/webp':'';
  if(!detected||(file.type&&file.type.toLowerCase()!==detected))throw new Error('اختر صورة JPEG أو PNG أو WebP صالحة لرقم الهيكل.');
}

async function preparePhoto(file,signal) {
  const url=URL.createObjectURL(file),image=new Image();
  let canvas;
  try {
    await new Promise((resolve,reject)=>{
      const onAbort=()=>{image.src='';reject(abortError())};
      const finish=(callback,value)=>{signal?.removeEventListener('abort',onAbort);callback(value)};
      image.onload=()=>finish(resolve);
      image.onerror=()=>finish(reject,new Error('تعذّر فتح الصورة.'));
      signal?.addEventListener('abort',onAbort,{once:true});
      image.src=url;
    });
    checkAborted(signal);
    const width=image.naturalWidth,height=image.naturalHeight;
    if(!width||!height||width*height>60000000)throw new Error('الصورة كبيرة جدًا؛ قصّها حول رقم الهيكل.');
    const scale=Math.min(1,3000/Math.max(width,height));
    if(scale===1)return file;
    canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
    const context=canvas.getContext('2d',{alpha:false});
    if(!context)throw new Error('تعذرت معالجة الصورة.');
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const resized=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.94));
    checkAborted(signal);
    if(!resized)throw new Error('تعذرت معالجة الصورة.');
    return resized;
  }finally{URL.revokeObjectURL(url);image.src='';if(canvas){canvas.width=1;canvas.height=1}}
}

export async function recognizeVinImage(file,{onProgress,signal}={}) {
  checkAborted(signal);
  await validatePhoto(file);
  checkAborted(signal);
  if(typeof Worker==='undefined'||typeof WebAssembly==='undefined')throw new Error('قراءة الصورة غير مدعومة في هذا المتصفح. أدخل رقم الهيكل يدويًا.');
  const localUrl=path=>new URL(path,import.meta.url).href;
  let worker,terminated=false,rejectAbort;
  const terminate=async()=>{if(worker&&!terminated){terminated=true;try{await worker.terminate();}catch{/* Already stopped or initialization failed. */}}};
  const cancelled=new Promise((_,reject)=>{rejectAbort=reject});
  const onAbort=()=>{rejectAbort(abortError());void terminate()};
  signal?.addEventListener('abort',onAbort,{once:true});
  const report=event=>{
    if(typeof onProgress==='function'&&!signal?.aborted){
      try{onProgress({status:typeof event.status==='string'?event.status:'recognizing text',progress:Math.max(0,Math.min(1,Number(event.progress)||0))})}catch{/* A progress display must not break OCR. */}
    }
  };
  const task=(async()=>{
    try{
      report({status:'preparing image',progress:0});
      const preparedFile=await preparePhoto(file,signal);
      const {default:Tesseract}=await import(localUrl('./vendor/ocr/tesseract.esm.min.js'));
      checkAborted(signal);
      worker=await Tesseract.createWorker('eng',1,{
        workerPath:localUrl('./vendor/ocr/worker.min.js'),
        corePath:localUrl('./vendor/ocr/tesseract-core-lstm.js'),
        langPath:localUrl('./assets/ocr/'),
        workerBlobURL:false,cacheMethod:'none',gzip:true,logger:report,
      });
      checkAborted(signal);
      // Keep I/O/Q in the OCR alphabet so we can reject ambiguous readings;
      // never force the engine or parser to turn them into 1/0 automatically.
      await worker.setParameters({tessedit_pageseg_mode:11,tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',preserve_interword_spaces:'1'});
      let result=await worker.recognize(preparedFile,{}, {text:true});
      checkAborted(signal);
      let text=typeof result?.data?.text==='string'?result.data.text:'';
      let candidates=getVinCandidates(text);
      if(!candidates.length){
        // A tightly cropped single VIN line can work better than sparse text.
        await worker.setParameters({tessedit_pageseg_mode:7});
        result=await worker.recognize(preparedFile,{}, {text:true});
        checkAborted(signal);
        const secondText=typeof result?.data?.text==='string'?result.data.text:'';
        const secondCandidates=getVinCandidates(secondText);
        if(secondCandidates.length){text=secondText;candidates=secondCandidates}
      }
      return {candidates,text};
    }catch(error){
      if(error?.name==='AbortError'||signal?.aborted)throw abortError();
      throw new Error('تعذّرت قراءة رقم الهيكل من الصورة. جرّب صورة أوضح ومقربة، أو أدخل الرقم يدويًا.');
    }finally{await terminate()}
  })();
  try{return await Promise.race([task,cancelled])}
  finally{signal?.removeEventListener('abort',onAbort)}
}
