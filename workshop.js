import {id,normalizeWhatsAppPhone,buildWhatsAppUrl} from './domain.js?v=7';
import {vehicleArtwork} from './vehicle-art.js?v=7';
import {SUPPORTED_SUPPLIER_BRANDS,validateVehicleVin,supplierRecommendations,buildPartsRequestMessage,translateCommonParts} from './procurement.js?v=7';
import {normalizeVin,recognizeVinImage,lookupVin} from './vin.js?v=7';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initializeWorkshop({getState,saveState,toast,getLanguage}){
  const w=(ar,en)=>getLanguage()==='en'?en:ar;
  const dialog=document.createElement('dialog');dialog.id='workshop-dialog';dialog.setAttribute('aria-labelledby','workshop-title');document.body.append(dialog);
  let currentOrderId='',returnOrderId='',lastRequestSource='manual',tasks=new Map();
  const drafts=new Map();
  const $=selector=>dialog.querySelector(selector);
  const brandName=brand=>{if(brand==='*')return w('كل الماركات','All makes');const label=vehicleArtwork(brand).label.replace(/^شعار\s*/,'');return getLanguage()==='en'?(label.split('/').at(-1)||brand).trim():label.split('/')[0].trim()};
  const errorText=error=>getLanguage()==='ar'||!/[\u0600-\u06ff]/.test(error.message)?error.message:({
    'أدخل رقم واتساب صحيحًا: 0501234567 أو رقمًا دوليًا يبدأ بـ + أو 00.':'Enter a valid WhatsApp number with its country code.',
    'رقم الهيكل يجب أن يكون 17 حرفًا ورقمًا، ولا يتضمن I أو O أو Q. راجع الصورة دون استبدالها تلقائيًا.':'VIN must contain 17 letters/digits, excluding I, O and Q. Check the original photo.',
    'أدخل رقم هيكل واحدًا من 17 حرفًا ورقمًا.':'Enter one 17-character VIN.',
    'تعذر الاتصال بقاعدة NHTSA الرسمية. يمكنك إدخال بيانات السيارة يدويًا.':'The NHTSA lookup could not be reached. Enter the vehicle details manually.'
  }[error.message]||'Please review the entered details and try again.');
  const report=error=>{const target=$('#workshop-error');if(target)target.textContent=errorText(error);else toast(errorText(error))};
  const header=(title,subtitle='')=>`<div class="dialog-head"><div><h2 id="workshop-title">${title}</h2>${subtitle?`<p class="hint">${subtitle}</p>`:''}</div><button type="button" class="ghost" data-workshop-close aria-label="${w('إغلاق','Close')}">×</button></div>`;
  const show=html=>{dialog.innerHTML=html;if(!dialog.open)dialog.showModal()};
  const suppliers=()=>getState().suppliers||[];
  const orderById=value=>getState().orders.find(order=>order.id===value);
  const carFor=order=>getState().vehicles.find(car=>car.id===order.vehicleId);
  const input=(name,label,value='',extra='')=>`<label class="field">${label}<input name="${name}" value="${esc(value)}" ${extra}></label>`;
  function vehicleFields(data){
    const output={};
    if(typeof data.vin==='string'&&data.vin.trim())output.vin=normalizeVin(data.vin);
    if(typeof data.year==='string'&&data.year.trim()){
      const year=Number(data.year);if(!Number.isInteger(year)||year<1900||year>new Date().getFullYear()+1)throw Error(w('سنة الصنع غير صحيحة.','Enter a valid model year.'));output.year=year;
    }
    for(const name of ['engine','fuel'])if(typeof data[name]==='string'&&data[name].trim())output[name]=data[name].trim().slice(0,200);
    return output;
  }
  function vinFields(car={}){
    return `<details class="form-advanced vin-section" data-vin-scope><summary>${w('رقم الشاصي وصورته وبيانات السيارة','VIN photo and vehicle details')}</summary>
      <p class="hint">${w('الصورة تُقرأ على جهازك. راجع الرقم قبل اعتماده.','The photo is read on your device. Review the recognised VIN.')}</p>
      <label class="field">${w('صورة رقم الشاصي','VIN photo')}<input data-vin-photo type="file" accept="image/jpeg,image/png,image/webp" capture="environment"></label>
      <p class="vin-status hint" role="status"></p><div class="vin-candidates"></div>
      ${input('vin',w('رقم الشاصي VIN — ١٧ خانة','VIN — 17 characters'),car.vin||'','dir="ltr" maxlength="30" autocapitalize="characters" autocomplete="off"')}
      <button type="button" class="secondary" data-vin-lookup>${w('جلب بيانات السيارة من VIN','Look up vehicle details')}</button>
      <p class="hint">${w('عند الجلب، يُرسل رقم VIN فقط إلى خدمة NHTSA العامة. التغطية قد تكون جزئية لسيارات الخليج.','Lookup sends only the VIN to the public NHTSA service. Gulf-market coverage may be incomplete.')}</p>
      <div class="vin-result"></div><div class="form-grid">${input('year',w('سنة الصنع','Model year'),car.year||'','type="number" min="1900" max="'+(new Date().getFullYear()+1)+'" step="1"')}${input('engine',w('المحرك','Engine'),car.engine||'')}${input('fuel',w('الوقود','Fuel type'),car.fuel||'')}</div>
    </details>`;
  }
  function decorateForm(){
    const fields=document.querySelector('#fields');if(!fields||fields.querySelector('[data-vin-scope]'))return;
    const model=fields.querySelector('[name="model"]');if(!model)return;
    const target=fields.querySelector('#new-car-fields')||fields;
    target.insertAdjacentHTML('beforeend',vinFields());
    const existing=fields.querySelector('[name="vehicleId"]')?.value;
    if(existing&&target.id==='new-car-fields')target.querySelectorAll('[data-vin-scope] input').forEach(element=>element.disabled=true);
  }
  new MutationObserver(decorateForm).observe(document.querySelector('#fields'),{childList:true,subtree:false});
  function decorate(){
    const menu=document.querySelector('.more-grid');
    if(menu&&!menu.querySelector('[data-workshop-suppliers]'))menu.insertAdjacentHTML('beforeend',`<button class="menu-card" data-workshop-suppliers><b>${w('محلات قطع الغيار','Parts suppliers')}</b><span>${w('الأرقام والتخصصات والترشيح حسب الماركة','Contacts, specialties and make matching')}</span></button>`);
    for(const card of document.querySelectorAll('article.work-card')){
      const orderId=card.querySelector('[data-print]')?.dataset.print;
      const actions=card.querySelector('.details-actions');if(!orderId||!actions||orderById(orderId)?.guest||actions.querySelector('[data-procurement]'))continue;
      actions.insertAdjacentHTML('beforeend',`<button class="secondary" data-procurement="${esc(orderId)}">${w('الشاصي وطلب قطع الغيار','VIN and parts enquiry')}</button>`);
      const car=carFor(orderById(orderId));if(car?.vin){const target=card.querySelector('.card-info');target?.insertAdjacentHTML('beforeend',`<div class="info-item"><span class="info-label">VIN</span><p class="info-value" dir="ltr">${esc(car.vin)}</p></div>`)}
    }
    decorateForm();
  }
  function showSuppliers(){
    currentOrderId='';returnOrderId='';
    show(header(w('محلات قطع الغيار','Parts suppliers'),w('أضف الأرقام والماركات التي يخدمها كل محل.','Save each supplier and the makes they serve.'))+`<button type="button" class="primary" data-workshop-new-supplier>${w('إضافة محل','Add supplier')}</button><div class="supplier-list">${suppliers().map(supplier=>`<article class="supplier-card"><div><h3>${esc(supplier.name)}</h3><p dir="ltr">${esc(supplier.phone)}</p><p class="hint">${supplier.brands.map(brandName).map(esc).join(' · ')}${supplier.active===false?' · '+w('غير نشط','Inactive'):''}</p>${supplier.notes?`<p>${esc(supplier.notes)}</p>`:''}</div><div class="details-actions"><button type="button" class="secondary" data-workshop-edit-supplier="${esc(supplier.id)}">${w('تعديل','Edit')}</button><button type="button" class="secondary" data-workshop-delete-supplier="${esc(supplier.id)}">${w('حذف','Delete')}</button></div></article>`).join('')||`<p class="empty-state">${w('لم تضف محلات بعد. أضف اسم المحل ورقمه وماركات تخصصه.','No suppliers yet. Add a name, phone and supported makes.')}</p>`}</div><p id="workshop-error" class="form-error" role="alert"></p>`);
  }
  function showSupplierForm(supplierId='',returnTo=''){
    returnOrderId=returnTo;
    const supplier=suppliers().find(value=>value.id===supplierId)||{name:'',phone:'',brands:[],notes:'',active:true};
    show(header(supplierId?w('تعديل محل القطع','Edit supplier'):w('محل قطع غيار جديد','New parts supplier'))+`<form id="supplier-form" data-supplier-id="${esc(supplierId)}">${input('name',w('اسم المحل','Supplier name'),supplier.name,'required maxlength="150"')}${input('phone',w('رقم واتساب مع رمز الدولة','WhatsApp phone with country code'),supplier.phone,'type="tel" dir="ltr" required')}
      <fieldset class="supplier-brands"><legend>${w('الماركات التي يخدمها','Supported makes')}</legend>${['*',...SUPPORTED_SUPPLIER_BRANDS].map(brand=>`<label class="check-option"><input type="checkbox" name="brands" value="${brand}" ${supplier.brands.includes(brand)?'checked':''}><span>${esc(brandName(brand))}</span></label>`).join('')}</fieldset>
      ${input('notes',w('ملاحظات (اختياري)','Notes (optional)'),supplier.notes||'','maxlength="1000"')}<label class="check-option"><input type="checkbox" name="active" ${supplier.active!==false?'checked':''}><span>${w('نشط للترشيح','Include in recommendations')}</span></label><p id="workshop-error" class="form-error" role="alert"></p><button class="primary" type="submit">${w('حفظ المحل','Save supplier')}</button></form>`);
  }
  function readPartsDraft(){
    const form=$('#parts-request-form');if(!form)return null;
    const data=Object.fromEntries(new FormData(form));data.translationSource=lastRequestSource;
    drafts.set(currentOrderId,data);return data;
  }
  function showParts(orderId){
    const order=orderById(orderId);if(!order)return;
    currentOrderId=orderId;const car=carFor(order),saved=order.partsRequest||{};
    const draft=drafts.get(orderId)||{vin:car.vin||'',year:car.year||'',engine:car.engine||'',fuel:car.fuel||'',arText:saved.arText||'',enText:saved.enText||'',translationSource:saved.translationSource||'manual'};
    lastRequestSource=draft.translationSource||'manual';
    const recommendations=supplierRecommendations(suppliers(),car.model);
    show(header(w('ورقة الصيانة وطلب القطع','Workshop sheet and parts enquiry'),`${esc(order.number)} · ${esc(car.model)} · ${esc(car.plate)}`)+`<form id="parts-request-form">
      ${input('model',w('السيارة والموديل','Vehicle make and model'),draft.model||car.model,'required maxlength="200"')}${vinFields({...car,...draft})}
      <label class="field">${w('قطع الغيار المطلوبة — سطر لكل قطعة','Required parts — one item per line')}<textarea name="arText" id="parts-ar" rows="5" maxlength="10000" dir="auto">${esc(draft.arText)}</textarea></label>
      <div class="details-actions"><button type="button" class="secondary" data-workshop-dictionary>${w('اقتراح إنجليزي من قاموس قطع شائعة','Suggest common English part names')}</button><button type="button" class="secondary" disabled title="${w('خدمة AI غير مربوطة','AI service is not connected')}">${w('ترجمة بالذكاء الاصطناعي — غير متصل','AI translation — not connected')}</button></div>
      <p id="parts-translation-status" class="hint">${w('اقتراح القاموس محلي وليس ترجمة AI. راجع الأسماء والكميات وأرقام القطع.','The local dictionary is not AI translation. Review names, quantities and part numbers.')}</p>
      <label class="field">${w('القطع بالإنجليزية — راجعها قبل الإرسال','Parts in English — review before sending')}<textarea name="enText" id="parts-en" rows="5" maxlength="10000" dir="ltr">${esc(draft.enText)}</textarea></label>
      <div class="panel supplier-match"><h3>${w('المحلات المقترحة','Suggested suppliers')}</h3><p class="hint">${w('الترشيح حسب الماركة المسجلة في دليلك فقط؛ لا يؤكد توفر القطع أو السعر.','Matches use your saved make specialties only; stock and prices are not confirmed.')}</p>
      <label class="field">${w('اختر المحل','Choose supplier')}<select name="supplierId" id="parts-supplier"><option value="">${w('اختر…','Select…')}</option>${recommendations.map(({supplier,reason})=>`<option value="${esc(supplier.id)}" ${draft.supplierId===supplier.id?'selected':''}>${esc(supplier.name)} — ${reason==='brand'?w('متخصص بالماركة','Matches make'):w('محل عام','General supplier')}</option>`).join('')}</select></label>
      ${!recommendations.length?`<p class="hint">${w('لا توجد محلات مطابقة حتى الآن. أضف محلًا يخدم هذه الماركة أو كل الماركات.','No matching suppliers yet. Add one that serves this make or all makes.')}</p>`:''}<button type="button" class="secondary" data-workshop-add-supplier-for-order>${w('إضافة محل للدليل','Add supplier to directory')}</button></div>
      <label class="field">${w('لغة طلب القطع','Parts enquiry language')}<select name="requestLanguage" id="parts-message-language"><option value="en">English</option><option value="ar">العربية</option></select></label>
      <p id="workshop-error" class="form-error" role="alert"></p><div class="details-actions"><button type="submit" class="primary">${w('حفظ ورقة الصيانة','Save workshop sheet')}</button><button type="button" class="secondary" data-workshop-prepare>${w('تجهيز رسالة واتساب مع الشاصي','Prepare WhatsApp enquiry with VIN')}</button></div></form>
      <section id="supplier-message-container" hidden><label class="field">${w('راجع الرسالة قبل الإرسال','Review message before sending')}<textarea id="supplier-message" rows="10" dir="auto"></textarea></label><p class="hint">${w('سيفتح واتساب؛ تضغط إرسال بنفسك. لا تُرسل الصورة أو أي رسالة تلقائيًا.','WhatsApp opens for you to send. No photo or message is sent automatically.')}</p><a class="message-send whatsapp" id="supplier-whatsapp" target="_blank" rel="noopener noreferrer">${w('فتح واتساب للمحل','Open supplier WhatsApp')}</a></section>`);
    if(draft.requestLanguage)$('#parts-message-language').value=draft.requestLanguage;
  }
  function persistParts(){
    const data=readPartsDraft();if(!data)return null;
    const next=structuredClone(getState()),order=next.orders.find(value=>value.id===currentOrderId),car=next.vehicles.find(value=>value.id===order.vehicleId);
    if(!data.model?.trim())throw Error(w('اكتب الشركة والموديل.','Enter the vehicle make and model.'));
    car.model=data.model.trim();Object.assign(car,vehicleFields(data));
    if(data.vin==='')car.vin='';if(data.year==='')car.year='';if(data.engine==='')car.engine='';if(data.fuel==='')car.fuel='';
    order.partsRequest={arText:data.arText.trim(),enText:data.enText.trim(),translationSource:lastRequestSource,updatedAt:new Date().toISOString()};
    saveState(next);return {data,order,car};
  }
  function prepareMessage(){
    const result=persistParts();if(!result)return;
    const {data,order,car}=result;
    const vin=normalizeVin(data.vin||'');
    const supplier=supplierRecommendations(suppliers(),car.model).find(value=>value.supplier.id===data.supplierId)?.supplier;
    if(!supplier)throw Error(w('اختر محل قطع الغيار أولًا.','Choose a parts supplier first.'));
    const text=buildPartsRequestMessage({language:data.requestLanguage,vehicleModel:car.model,vin,plate:car.plate,orderNumber:order.number,arText:data.arText,enText:data.enText});
    dialog.dataset.supplierPhone=supplier.phone;$('#supplier-message').value=text;$('#supplier-message').dir=data.requestLanguage==='en'?'ltr':'rtl';$('#supplier-whatsapp').href=buildWhatsAppUrl(supplier.phone,text);$('#supplier-message-container').hidden=false;$('#workshop-error').textContent='';$('#supplier-message-container').scrollIntoView({block:'nearest'});
  }
  function refreshSupplierChoices(model){const select=$('#parts-supplier');if(!select)return;const previous=select.value;const matches=supplierRecommendations(suppliers(),model);select.innerHTML=`<option value="">${w('اختر…','Select…')}</option>`+matches.map(({supplier,reason})=>`<option value="${esc(supplier.id)}">${esc(supplier.name)} — ${reason==='brand'?w('متخصص بالماركة','Matches make'):w('محل عام','General supplier')}</option>`).join('');if(matches.some(value=>value.supplier.id===previous))select.value=previous;}
  function invalidateMessage(){const container=$('#supplier-message-container');if(container)container.hidden=true;$('#supplier-whatsapp')?.removeAttribute('href')}
  async function readPhoto(input){
    const scope=input.closest('[data-vin-scope]'),status=scope.querySelector('.vin-status'),file=input.files?.[0];if(!file)return;
    tasks.get(scope)?.abort();const controller=new AbortController();tasks.set(scope,controller);
    status.textContent=w('جارٍ قراءة الصورة محليًا…','Reading photo locally…');scope.querySelector('.vin-candidates').innerHTML='';
    try{
      const result=await recognizeVinImage(file,{signal:controller.signal,onProgress:progress=>{const value=typeof progress==='number'?progress:progress?.progress;if(Number.isFinite(value))status.textContent=w('قراءة الصورة: ','Reading photo: ')+Math.round(value*100)+'%'}});
      if(!scope.isConnected||controller.signal.aborted)return;
      if(result.candidates.length===1){scope.querySelector('[name="vin"]').value=result.candidates[0];status.textContent=w('تم اقتراح رقم الشاصي. راجعه من الصورة ثم اجلب بيانات السيارة.','A VIN was recognised. Compare it with the photo, then look up vehicle details.');invalidateMessage()}
      else if(result.candidates.length>1){status.textContent=w('ظهرت عدة أرقام محتملة؛ اختر الرقم المطابق للصورة.','Multiple candidates were found. Choose the one matching the photo.');scope.querySelector('.vin-candidates').innerHTML=result.candidates.map(vin=>`<button type="button" class="secondary" data-vin-candidate="${vin}">${vin}</button>`).join('')}
      else status.textContent=w('لم يظهر رقم واضح من 17 خانة. جرّب صورة أقرب وأوضح أو اكتبه يدويًا.','No clear 17-character VIN was found. Try a closer photo or enter it manually.');
    }catch(error){if(error.name!=='AbortError')status.textContent=getLanguage()==='ar'?error.message:w('تعذرت قراءة الصورة.','The image could not be read. Use JPEG/PNG/WebP or enter the VIN manually.')}finally{if(tasks.get(scope)===controller)tasks.delete(scope)}
  }
  async function decodeVin(button){
    const scope=button.closest('[data-vin-scope]'),status=scope.querySelector('.vin-status'),input=scope.querySelector('[name="vin"]');
    try{
      const vin=normalizeVin(input.value);input.value=vin;button.disabled=true;status.textContent=w('جارٍ جلب البيانات الرسمية…','Looking up official vehicle data…');
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let result;
      try{result=await lookupVin(vin,{signal:controller.signal})}finally{clearTimeout(timeout)}
      if(!scope.isConnected||!scope.closest('dialog')?.open)return;
      if(input.value.replace(/\s/g,'').toUpperCase()!==vin)throw Error(w('تغيّر رقم الشاصي؛ أعد جلب البيانات للرقم الحالي.','The VIN changed. Run lookup again for the current VIN.'));
      scope._decoded=result;
      const warning=result.errors?.length?w('قد تكون البيانات جزئية. راجعها قبل اعتمادها.','Results may be incomplete. Review before applying.'):w('راجع البيانات قبل اعتمادها.','Review these details before applying.');
      scope.querySelector('.vin-result').innerHTML=`<div class="vin-review"><h3>${w('نتيجة قاعدة البيانات','Lookup result')}</h3><p dir="auto">${esc([result.make,result.model,result.year].filter(Boolean).join(' · '))||w('لم تتوفر بيانات مؤكدة','No confirmed details returned')}</p><p>${esc([result.engine,result.fuel].filter(Boolean).join(' · '))}</p><p class="hint">${warning}</p><button type="button" class="secondary" data-vin-apply>${w('اعتماد هذه البيانات في النموذج','Apply these details to the form')}</button></div>`;
      status.textContent=w('المصدر: NHTSA / vPIC.','Source: NHTSA / vPIC.');
    }catch(error){status.textContent=error.name==='AbortError'?w('انتهت مهلة الخدمة. أدخل البيانات يدويًا أو أعد المحاولة.','Lookup timed out. Enter details manually or retry.'):errorText(error)}finally{button.disabled=false}
  }
  function applyDecoded(button){
    const scope=button.closest('[data-vin-scope]'),decoded=scope._decoded;if(!decoded)return;
    if(normalizeVin(scope.querySelector('[name="vin"]').value)!==decoded.vin)throw Error(w('تغيّر رقم الشاصي؛ أعد الجلب.','The VIN changed. Look it up again.'));
    const parent=scope.closest('form');
    const model=parent?.querySelector('[name="model"]');if(model){const value=[decoded.make,decoded.model].filter(Boolean).join(' ');if(value){model.value=value;model.dispatchEvent(new Event('input',{bubbles:true}))}}
    for(const key of ['year','engine','fuel'])if(decoded[key])scope.querySelector(`[name="${key}"]`).value=decoded[key];
    scope.querySelector('.vin-status').textContent=w('نُقلت البيانات إلى النموذج. راجعها ثم احفظ.','Details applied to the form. Review and save.');invalidateMessage();
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button');if(!button)return;
    try{
      if(button.hasAttribute('data-workshop-close'))dialog.close();
      if(button.hasAttribute('data-workshop-suppliers'))showSuppliers();
      if(button.dataset.procurement)showParts(button.dataset.procurement);
      if(button.hasAttribute('data-workshop-new-supplier'))showSupplierForm();
      if(button.dataset.workshopEditSupplier)showSupplierForm(button.dataset.workshopEditSupplier);
      if(button.dataset.workshopDeleteSupplier&&confirm(w('حذف هذا المحل من الدليل؟','Delete this supplier?'))){const next=structuredClone(getState());next.suppliers=(next.suppliers||[]).filter(s=>s.id!==button.dataset.workshopDeleteSupplier);saveState(next);showSuppliers()}
      if(button.hasAttribute('data-workshop-add-supplier-for-order')){readPartsDraft();showSupplierForm('',currentOrderId)}
      if(button.hasAttribute('data-workshop-dictionary')){const result=translateCommonParts($('#parts-ar').value);$('#parts-en').value=result.text;lastRequestSource='dictionary';$('#parts-translation-status').textContent=result.untranslated.length?w('هذه اقتراحات قاموس، وليست AI. أسطر تحتاج ترجمة ومراجعة: ','Dictionary suggestions, not AI. Lines needing translation/review: ')+result.untranslated.join(' · '):w('اقتراحات قاموس محلي. راجع المعنى والمواصفات قبل الإرسال.','Local dictionary suggestions. Review meaning and specifications before sending.');invalidateMessage()}
      if(button.hasAttribute('data-workshop-prepare'))prepareMessage();
      if(button.hasAttribute('data-vin-lookup'))await decodeVin(button);
      if(button.hasAttribute('data-vin-apply'))applyDecoded(button);
      if(button.dataset.vinCandidate){const scope=button.closest('[data-vin-scope]');scope.querySelector('[name="vin"]').value=button.dataset.vinCandidate;scope.querySelector('.vin-status').textContent=w('راجع الرقم ثم اجلب البيانات.','Review the VIN, then look up details.');invalidateMessage()}
    }catch(error){report(error)}
  });
  document.addEventListener('change',event=>{if(event.target.hasAttribute('data-vin-photo'))readPhoto(event.target);if(['parts-supplier','parts-message-language'].includes(event.target.id))invalidateMessage()});
  document.addEventListener('input',event=>{if(event.target.id==='supplier-message'){try{const text=event.target.value.trim();if(!text)throw Error('Empty');$('#supplier-whatsapp').href=buildWhatsAppUrl(dialog.dataset.supplierPhone,text);$('#supplier-whatsapp').removeAttribute('aria-disabled')}catch{$('#supplier-whatsapp').removeAttribute('href');$('#supplier-whatsapp').setAttribute('aria-disabled','true')}}if(event.target.name==='vin'){const scope=event.target.closest('[data-vin-scope]');if(scope){scope._decoded=null;scope.querySelector('.vin-result').innerHTML=''}}
    if(event.target.closest('#parts-request-form')){if(event.target.name==='model')refreshSupplierChoices(event.target.value);if(event.target.id==='parts-en')lastRequestSource='manual';invalidateMessage()}});
  dialog.addEventListener('submit',event=>{
    event.preventDefault();try{
      if(event.target.id==='supplier-form'){
        const data=new FormData(event.target),brands=data.getAll('brands');if(!brands.length)throw Error(w('اختر ماركة واحدة على الأقل أو كل الماركات.','Choose at least one make or all makes.'));
        const next=structuredClone(getState());next.suppliers??=[];
        const supplier={id:event.target.dataset.supplierId||id(),name:String(data.get('name')).trim(),phone:'+'+normalizeWhatsAppPhone(String(data.get('phone'))),brands,notes:String(data.get('notes')||'').trim(),active:data.has('active')};
        if(!supplier.name)throw Error(w('اكتب اسم المحل.','Enter the supplier name.'));
        const index=next.suppliers.findIndex(value=>value.id===supplier.id);if(index>=0)next.suppliers[index]=supplier;else next.suppliers.push(supplier);
        saveState(next);toast(w('حُفظ المحل.','Supplier saved.'));if(returnOrderId)showParts(returnOrderId);else showSuppliers();
      }
      if(event.target.id==='parts-request-form'){persistParts();toast(w('حُفظت ورقة الصيانة وطلب القطع.','Workshop sheet and parts request saved.'));$('#workshop-error').textContent=''}
    }catch(error){report(error)}
  });
  document.querySelector('#dialog').addEventListener('close',()=>{for(const [scope,controller] of tasks)if(scope.closest('dialog')?.id==='dialog'){controller.abort();tasks.delete(scope)}});
  dialog.addEventListener('close',()=>{for(const controller of tasks.values())controller.abort();tasks.clear()});
  return {decorate,vehicleFields};
}
