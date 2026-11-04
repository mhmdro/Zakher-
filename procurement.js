import {vehicleArtwork} from './vehicle-art.js?v=7';
import {SUPPORTED_SUPPLIER_BRANDS,validateVehicleVin} from './domain.js?v=7';

export {SUPPORTED_SUPPLIER_BRANDS,validateVehicleVin};
const supported=new Set(SUPPORTED_SUPPLIER_BRANDS);

// This is a saved-specialty match, not a stock, distance or price claim.
export function supplierRecommendations(suppliers,vehicleModel) {
  if(!Array.isArray(suppliers))return [];
  const artwork=vehicleArtwork(vehicleModel);
  const make=artwork.kind==='brand'?artwork.id:null;
  const matching=[],general=[],seen=new Set();
  for(const supplier of suppliers) {
    if(!supplier||typeof supplier.id!=='string'||!supplier.id||seen.has(supplier.id)||
      typeof supplier.name!=='string'||!supplier.name.trim()||supplier.active===false||
      (Object.hasOwn(supplier,'active')&&typeof supplier.active!=='boolean')||
      !Array.isArray(supplier.brands)||supplier.brands.some(brand=>brand!=='*'&&!supported.has(brand)))continue;
    seen.add(supplier.id);
    if(make&&supplier.brands.includes(make))matching.push({supplier,reason:'brand'});
    else if(supplier.brands.includes('*'))general.push({supplier,reason:'general'});
  }
  return [...matching,...general];
}

export function buildPartsRequestMessage({language='en',vehicleModel='',vin='',plate='',orderNumber='',arText='',enText=''}={}) {
  if(!['ar','en'].includes(language))throw Error('اختر العربية أو الإنجليزية لطلب قطع الغيار.');
  validateVehicleVin(vin);
  const selected=language==='ar'?arText:enText;
  if(typeof selected!=='string'||!selected.trim())throw Error(language==='ar'?'اكتب قائمة القطع بالعربية أولًا.':'اكتب قائمة القطع بالإنجليزية أو راجع ترجمتها أولًا.');
  const clean=value=>typeof value==='string'?value.trim():'';
  const details=[];
  if(clean(vehicleModel))details.push((language==='ar'?'🚘 السيارة: ':'🚘 Vehicle: ')+clean(vehicleModel));
  if(vin)details.push('🔎 VIN: '+vin);
  if(clean(plate))details.push((language==='ar'?'📍 اللوحة: ':'📍 Plate: ')+clean(plate));
  if(clean(orderNumber))details.push((language==='ar'?'🧾 أمر الصيانة: ':'🧾 Service order: ')+clean(orderNumber));
  if(language==='ar')return [
    'مرحبًا 👋\n*طلب قطع غيار — كراج زاخر لصيانة السيارات*',
    'يرجى تزويدنا بعرض سعر وتأكيد التوفر للقطع التالية:',
    details.join('\n'),
    '🔧 القطع المطلوبة:\n'+selected.trim(),
    'يرجى تأكيد توافق القطع مع السيارة قبل التوريد، وتوضيح سعر الوحدة والتوفر ومدة التوريد.\nشكرًا لكم.'
  ].filter(Boolean).join('\n\n');
  return [
    'Hello 👋\n*Parts enquiry — Zakher Garage · Auto Maintenance*',
    'Please quote the items below and confirm availability.',
    details.join('\n'),
    '🔧 Required parts:\n'+selected.trim(),
    'Please confirm fitment before supply, unit prices, availability and delivery lead time.\nThank you.'
  ].filter(Boolean).join('\n\n');
}

// Exact line-level dictionary suggestions only. This is not AI translation.
// Unknown lines (including quantities/specifications) are retained for review.
const partNames={
  'فلتر زيت':'Oil filter',
  'فلتر هواء':'Air filter',
  'فلتر مكيف':'Cabin air filter',
  'زيت محرك':'Engine oil',
  'زيت مكينه':'Engine oil',
  'شمعات احتراق':'Spark plugs',
  'بواجي':'Spark plugs',
  'فحمات فرامل':'Brake pads',
  'اقراص فرامل':'Brake discs',
  'هوبات':'Brake discs',
  'بطاريه':'Battery',
  'مضخه ماء':'Water pump',
  'طرمبه ماء':'Water pump',
  'رديتر':'Radiator',
  'كمبروسر مكيف':'AC compressor',
  'سير تايمن':'Timing belt',
  'سير التايمن':'Timing belt',
  'صدام امامي':'Front bumper',
  'صدام خلفي':'Rear bumper'
};
function normalizePartName(value) {
  return value.normalize('NFKC').trim().replace(/[\u064B-\u065F\u0670\u0640]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/\s+/g,' ');
}
export function translateCommonParts(text) {
  if(typeof text!=='string')throw Error('اكتب قائمة القطع بالعربية.');
  const untranslated=[];
  const translated=text.split(/\r?\n/).map(line=>{
    if(!line.trim())return line;
    const name=normalizePartName(line);
    const found=Object.hasOwn(partNames,name)?partNames[name]:null;
    if(found)return found;
    untranslated.push(line);
    return line;
  });
  return {text:translated.join('\n'),untranslated};
}
