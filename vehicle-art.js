// Manufacturer logos are vendored from the Simple Icons archives. See
// assets/brands/README.md for their origin and trademark notices. This matcher
// identifies a manufacturer; it does not claim to show a model/year photograph.
const unknown = () => ({id:'unknown',label:'الشركة غير معروفة',src:null,kind:'unknown'});

function normalize(value) {
  return value.normalize('NFKC').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
    .replace(/[٠-٩]/g,digit=>String(digit.charCodeAt(0)-0x660))
    .replace(/[۰-۹]/g,digit=>String(digit.charCodeAt(0)-0x6f0))
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
}

const manufacturers = [
  ['nissan','نيسان / Nissan',['nissan','نيسان']],
  ['toyota','تويوتا / Toyota',['toyota','تويوتا','تيوتا']],
  ['bmw','بي إم دبليو / BMW',['bmw','b m w','بي ام دبليو','بي ام دابليو','بي ام']],
  ['mercedes','مرسيدس / Mercedes-Benz',['mercedes benz','mercedes','مرسيدس بنز','مرسيدس','مرسيديس']],
  ['honda','هوندا / Honda',['honda','هوندا']],
  ['hyundai','هيونداي / Hyundai',['hyundai','هيونداي','هونداي']],
  ['kia','كيا / Kia',['kia','كيا']],
  ['landrover','لاند روفر / Land Rover',['land rover','landrover','لاند روفر','لاندروفر']],
  ['audi','أودي / Audi',['audi','اودي']],
  ['volkswagen','فولكس فاجن / Volkswagen',['volkswagen','vw','v w','فولكس فاجن','فولكسفاجن','فولكس واجن','فولكسواجن']],
  ['ford','فورد / Ford',['ford','فورد']],
  ['chevrolet','شيفروليه / Chevrolet',['chevrolet','chevy','شيفروليه','شفروليه','شيفرليه','شفرليه','شيفرلت','شفرليت','شفرلت']],
  ['mitsubishi','ميتسوبيشي / Mitsubishi',['mitsubishi','ميتسوبيشي','متسوبيشي']],
  ['mazda','مازدا / Mazda',['mazda','مازدا']],
  ['suzuki','سوزوكي / Suzuki',['suzuki','سوزوكي']],
  ['subaru','سوبارو / Subaru',['subaru','سوبارو']],
  ['renault','رينو / Renault',['renault','رينو']],
  ['peugeot','بيجو / Peugeot',['peugeot','بيجو']],
  ['porsche','بورش / Porsche',['porsche','بورش','بورشه']],
  ['tesla','تسلا / Tesla',['tesla','تسلا','تيسلا']],
  ['volvo','فولفو / Volvo',['volvo','فولفو']],
  ['jeep','جيب / Jeep',['jeep']],
  ['infiniti','إنفينيتي / Infiniti',['infiniti','انفينيتي','انفنتي']],
  ['cadillac','كاديلاك / Cadillac',['cadillac','كاديلاك']],
  ['bentley','بنتلي / Bentley',['bentley','بنتلي']],
  ['mini','ميني / MINI',['mini','ميني']],
  ['skoda','سكودا / Škoda',['skoda','škoda','سكودا']],
  ['rollsroyce','رولز رويس / Rolls-Royce',['rolls royce','rollsroyce','رولز رويس','رولزرويس','رولس رويس']],
].map(([id,label,aliases])=>({id,label,aliases:[...new Set(aliases.map(normalize))]}));
const byId = new Map(manufacturers.map(profile=>[profile.id,profile]));

const models = [
  ['nissan',['altima','التيما','patrol','باترول','بترول','sunny','صني','سني']],
  ['toyota',['camry','كامري','corolla','كورولا','land cruiser','landcruiser','لاند كروزر','لاندكروزر','hilux','هايلكس','هايلوكس','yaris','يارس']],
  ['honda',['accord','اكورد','civic','سيفيك']],
  ['kia',['k5','k 5','كي 5','كيه 5','ك5','ك 5','optima','اوبتيما']],
  ['hyundai',['sonata','سوناتا','elantra','النترا','tucson','tuscon','توسان']],
  ['landrover',['range rover','rangerover','رنج روفر','رينج روفر','رانج روفر','رنج روڤر']],
].map(([id,aliases])=>({id,aliases:[...new Set(aliases.map(normalize))]}));

function phraseIndex(name, phrase) {
  return (` ${name} `).indexOf(` ${phrase} `);
}
function firstMatch(name, profiles) {
  let best;
  for (const profile of profiles) {
    for (const alias of profile.aliases) {
      const index=phraseIndex(name,alias);
      if(index>=0&&(!best||index<best.index||(index===best.index&&alias.length>best.length))) {
        best={id:profile.id,index,length:alias.length};
      }
    }
  }
  return best?.id;
}
function artwork(id) {
  const profile=byId.get(id);
  return profile?{id:profile.id,label:'شعار '+profile.label,src:`./assets/brands/${profile.id}.svg`,kind:'brand'}:unknown();
}

export function vehicleArtwork(name) {
  if(typeof name!=='string'||name.length>500)return unknown();
  // A vehicle name is plain text. Do not infer a make from pasted markup,
  // remote paths, data URLs or HTML attributes, even though output is allowlisted.
  if(/[<>"`=]|(?:https?|ftp|file|data|javascript):|\bwww\./i.test(name))return unknown();
  const normalized=normalize(name);
  if(!normalized)return unknown();
  const explicit=firstMatch(normalized,manufacturers);
  if(explicit)return artwork(explicit);
  // Arabic "جيب" can also mean SUV colloquially. Prefer any explicit make,
  // then known model, before interpreting it as the Jeep manufacturer.
  const model=firstMatch(normalized,models);
  if(model)return artwork(model);
  if(phraseIndex(normalized,'جيب')>=0)return artwork('jeep');
  return unknown();
}
