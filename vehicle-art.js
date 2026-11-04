// All illustrations are original local SVGs. A matched name represents a model
// family/body style, not a photograph or a claim about a specific model year.
const art = (id, label) => ({id, label, src: `./assets/vehicles/${id}.svg`});

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

const profiles = [
  {id:'sedan-altima', label:'نيسان ألتيما / Nissan Altima', aliases:['nissan altima','نيسان التيما','التيما','altima']},
  {id:'suv-large', label:'نيسان باترول / Nissan Patrol', aliases:['nissan patrol','نيسان باترول','نيسان بترول','باترول','patrol']},
  {id:'sedan-compact', label:'نيسان صني / Nissan Sunny', aliases:['nissan sunny','نيسان صني','نيسان سني','صني','sunny']},
  {id:'sedan-camry', label:'تويوتا كامري / Toyota Camry', aliases:['toyota camry','تويوتا كامري','تيوتا كامري','كامري','camry']},
  {id:'sedan-compact', label:'تويوتا كورولا / Toyota Corolla', aliases:['toyota corolla','تويوتا كورولا','تيوتا كورولا','كورولا','corolla']},
  {id:'suv-large', label:'تويوتا لاند كروزر / Toyota Land Cruiser', aliases:['toyota land cruiser','toyota landcruiser','تويوتا لاند كروزر','تويوتا لاندكروزر','لاند كروزر','لاندكروزر','land cruiser','landcruiser']},
  {id:'pickup', label:'تويوتا هايلكس / Toyota Hilux', aliases:['toyota hilux','تويوتا هايلكس','تويوتا هايلوكس','هايلكس','هايلوكس','hilux']},
  {id:'sedan-compact', label:'تويوتا يارس / Toyota Yaris', aliases:['toyota yaris','تويوتا يارس','يارس','yaris']},
  {id:'sedan-sport', label:'هوندا أكورد / Honda Accord', aliases:['honda accord','هوندا اكورد','اكورد','accord']},
  {id:'sedan-sport', label:'هوندا سيفيك / Honda Civic', aliases:['honda civic','هوندا سيفيك','سيفيك','civic']},
  {id:'sedan-luxury', label:'بي إم دبليو سيدان / BMW sedan', aliases:['bmw','بي ام دبليو','بي ام دابليو']},
  {id:'sedan-luxury', label:'مرسيدس سيدان / Mercedes sedan', aliases:['mercedes benz','mercedes','مرسيدس بنز','مرسيدس','مرسيديس']},
  {id:'sedan-sport', label:'كيا K5 / Kia K5', aliases:['kia k5','kia k 5','كيا k5','كيا كي 5','كيا كيه 5','كيا ك5','كيا ك 5','k5']},
  {id:'sedan-sport', label:'كيا أوبتيما / Kia Optima', aliases:['kia optima','كيا اوبتيما','اوبتيما','optima']},
  {id:'sedan-camry', label:'هيونداي سوناتا / Hyundai Sonata', aliases:['hyundai sonata','هيونداي سوناتا','هونداي سوناتا','سوناتا','sonata']},
  {id:'sedan-compact', label:'هيونداي إلنترا / Hyundai Elantra', aliases:['hyundai elantra','هيونداي النترا','هونداي النترا','النترا','elantra']},
  {id:'suv-crossover', label:'هيونداي توسان / Hyundai Tucson', aliases:['hyundai tucson','hyundai tuscon','هيونداي توسان','هونداي توسان','توسان','tucson']},
  {id:'suv-large', label:'رنج روفر / Range Rover', aliases:['land rover range rover','range rover','رنج روفر','رينج روفر','رانج روفر','رنج روڤر']},
].map(profile => ({...profile, aliases:[...new Set(profile.aliases.map(normalize))]}));

function hasPhrase(name, phrase) {
  return (` ${name} `).includes(` ${phrase} `);
}

export function vehicleArtwork(name) {
  const normalized = normalize(name);
  for (const profile of profiles) {
    if (profile.aliases.some(alias => hasPhrase(normalized, alias))) {
      return art(profile.id, profile.label);
    }
  }
  if (['pickup','pick up','بيك اب','بيكاب','بكب','وانيت'].some(alias=>hasPhrase(normalized,alias))) {
    return art('pickup','بيك أب / Pickup — رسم توضيحي');
  }
  if (['suv','crossover','دفع رباعي','جيب','كروس اوفر'].some(alias=>hasPhrase(normalized,alias))) {
    return art('suv-crossover','دفع رباعي / SUV — رسم توضيحي');
  }
  if (['sedan','saloon','سيدان','صالون'].some(alias=>hasPhrase(normalized,alias))) {
    return art('sedan-compact','سيدان / Sedan — رسم توضيحي');
  }
  return art('generic','سيارة / Vehicle — رسم توضيحي');
}
