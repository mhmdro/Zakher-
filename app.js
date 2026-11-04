import {empty,id,amount,createOrder,updateOrder,summary,validateBackup,demo,normalizeWhatsAppPhone,buildWhatsAppUrl,serviceMessage} from './domain.js?v=7';
import {vehicleArtwork} from './vehicle-art.js?v=7';
import {createTranslator} from './i18n.js?v=8';
import {initializeWorkshop} from './workshop.js?v=7';
import {orderVehicle,paymentSummary,recordPayment,voidAllPayments,isDelivered,salaryExpenseRows} from './ledger.js?v=7';
import {initializeOperations} from './operations-ui.js?v=7';

const $=selector=>document.querySelector(selector);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key='zakher-garage-v1',preferenceKey='zakher-preferences-v1';
let preferences={language:'ar',uiLanguage:'ar',openReceiptAfterIntake:false};
try {
  const saved=JSON.parse(localStorage.getItem(preferenceKey)||'{}');
  if(['ar','en'].includes(saved.language))preferences.language=saved.language;
  if(['ar','en'].includes(saved.uiLanguage))preferences.uiLanguage=saved.uiLanguage;
  if(typeof saved.openReceiptAfterIntake==='boolean')preferences.openReceiptAfterIntake=saved.openReceiptAfterIntake;
} catch {}
const t=createTranslator(()=>preferences.uiLanguage);
const ht=(text,vars={},language)=>esc(t(text,vars,language));
let state,storageWarning=false;
try {state=localStorage.getItem(key)?validateBackup(JSON.parse(localStorage.getItem(key))):demo()}
catch {state=empty();storageWarning=true}
let page='dashboard',query='',workFilter='active',submit,toastTimer,messageContext,messageDrafts={},messageLanguage='ar',workshop,operations;
const documentChoices=new Map();
const tabs=[['dashboard','car','الورشة'],['orders','file','الفواتير'],['customers','users','العملاء'],['more','menu','المزيد']];
const paths={car:'M5 17H3v-6l2-6h14l2 6v6h-2M5 17h14M5 17v3m14-3v3M3 11h18M7 14h.01M17 14h.01',file:'M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6',users:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M16 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',menu:'M4 6h16M4 12h16M4 18h16',plus:'M12 5v14M5 12h14',check:'m5 12 4 4L19 6',chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',box:'m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9',money:'M3 5h18v14H3V5Zm12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',backup:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'};
const icon=name=>`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.file}"/></svg>`;
const cash=(value,language=preferences.uiLanguage)=>Number(value).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2})+' '+t('د.إ',{},language);
const vehicle=order=>orderVehicle(state,order);
const customer=car=>state.vehicles.includes(car)?state.customers.find(owner=>owner.id===car?.customerId):car?.guestCustomer;
const isReady=order=>order.status==='مكتمل';
function savePreferences(patch){try{const next={...preferences,...patch};localStorage.setItem(preferenceKey,JSON.stringify(next));preferences=next;return true}catch{toast('تعذّر حفظ التفضيل على هذا الجهاز.');return false}}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=t(message);$('#toast').style.display='block';toastTimer=setTimeout(()=>$('#toast').style.display='none',4000)}
function save(next){localStorage.setItem(key,JSON.stringify(next));state=next;render()}
function mutate(action,message='تم الحفظ'){try{const next=structuredClone(state);action(next);save(next);toast(message);return true}catch(error){toast(error.message);return false}}
function applyStaticLanguage(){
  const language=preferences.uiLanguage;
  document.documentElement.lang=language;document.documentElement.dir=language==='en'?'ltr':'rtl';document.title=t('زاخر | الورشة');
  document.querySelectorAll('[data-i18n]').forEach(node=>node.textContent=t(node.dataset.i18n));
  document.querySelectorAll('[data-i18n-aria-label]').forEach(node=>node.setAttribute('aria-label',t(node.dataset.i18nAriaLabel)));
  if($('#ui-language'))$('#ui-language').value=language;
  if($('#current-date'))$('#current-date').textContent=new Intl.DateTimeFormat(language==='en'?'en-AE':'ar-AE',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Dubai',calendar:'gregory'}).format(new Date());
  if(storageWarning){$('#notice-text').textContent=t('تعذّر فتح البيانات المحفوظة. استعد نسخة احتياطية قبل إضافة بيانات جديدة.');$('#notice').classList.add('notice-error');$('#content').before($('#notice'))}
}
function navigate(target){page=target;query='';render();window.scrollTo({top:0,behavior:'instant'})}
function heading(title,sub,action='',label=''){return `<div class="titlebar"><div><h1>${ht(title)}</h1><p class="subtitle">${ht(sub)}</p></div>${action?`<button class="primary" data-add="${action}">${icon('plus')}${ht(label)}</button>`:''}</div>`}
function stat(title,value,foot,highlight=false){return `<div class="stat ${highlight?'highlight':''}"><label>${ht(title)}</label><strong>${value}</strong><small>${ht(foot)}</small></div>`}
function table(headers,rows){return rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(text=>`<th>${ht(text)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:`<div class="empty">${ht('لا توجد بيانات بعد.')}</div>`}
function searchField(placeholder){return `<input id="search" aria-label="${ht(placeholder)}" placeholder="${ht(placeholder)}" value="${esc(query)}" type="search">`}
function matches(order){const car=vehicle(order);return [order.number,order.description,order.descriptionEn,customer(car)?.name,car?.model,car?.plate].join(' ').toLowerCase().includes(query.toLowerCase())}
function documentLanguage(order){return documentChoices.get(order.id)||order.documentLanguage||preferences.uiLanguage}
function languageOptions(selected,includeBoth=false){return [['ar','العربية'],['en','English'],...(includeBoth?[['both','العربية والإنجليزية']]:[])].map(([value,label])=>`<option value="${value}" ${value===selected?'selected':''}>${ht(label)}</option>`).join('')}
function orderCard(order){
  const car=vehicle(order),owner=customer(car),quote=order.kind==='quote',ready=isReady(order),delivered=isDelivered(order),balance=paymentSummary(order),art=vehicleArtwork(car?.model);
  return `<article class="work-card ${ready?'ready':''}" data-order-id="${esc(order.id)}">
    <div class="card-top"><span class="pill ${quote?'blue':ready?'done':''}">${ht(quote?'عرض سعر':delivered?'سُلّمت للعميل':ready?'جاهزة للتسليم':'داخل الورشة')}</span><span class="order-number" dir="ltr">${esc(order.number)}</span></div>
    <div class="vehicle-heading"><div class="vehicle-emblem" title="${esc(art.label)}" aria-hidden="true">${art.src?`<img src="${esc(art.src)}" alt="" loading="lazy" decoding="async">`:'<span class="vehicle-mark-empty">?</span>'}</div><div><h2 class="car-name" dir="auto">${esc(car?.model)}</h2><span class="vehicle-subtitle">${ht('بطاقة صيانة')}</span></div></div>
    <div class="plate"><span class="plate-label">${ht('لوحة المركبة')}</span><bdi class="plate-number" dir="auto">${esc(car?.plate)}</bdi></div>
    <div class="card-info"><div class="info-item"><span class="info-label">${ht('العميل')}</span><p class="info-value customer-line" dir="auto">${esc(owner?.name)}</p></div><div class="info-item"><span class="info-label">${ht('الخدمة')}</span><p class="info-value service-description" dir="auto">${esc(order.description)}</p></div></div>
    ${quote||delivered?'':`<div class="card-actions">${!ready?`<button class="primary" data-status="${esc(order.id)}">${icon('check')}${ht('السيارة جاهزة')}</button>`:''}<button class="whatsapp" data-message="${ready?'ready':'received'}" data-order="${esc(order.id)}">${icon('chat')}${ht(ready?'واتساب: السيارة جاهزة':'واتساب: تم الاستلام')}</button></div>`}
    ${quote?'':`<div class="card-balance"><span>${ht('المدفوع')}: ${cash(balance.received)}</span><strong>${ht('المتبقي')}: ${cash(balance.remaining)}</strong></div>`}
    <details class="order-details"><summary>${ht(quote?'تفاصيل عرض السعر':'الفاتورة والمزيد')}</summary><p>${ht('الإجمالي')}: <b>${cash(order.total)}</b> <small>${ht('شامل الضريبة التجريبية ٥٪')}</small></p>${quote?'':`<p>${ht('الدفع')}: <b>${ht(order.total===0?'لا يوجد مبلغ مستحق':balance.isPaid?'مدفوعة':balance.received>0?'مدفوع جزئيًا':'غير مدفوعة')}</b></p>`}
      <label class="field">${ht('لغة الطباعة')}<select class="document-language" data-order="${esc(order.id)}">${languageOptions(documentLanguage(order),true)}</select></label>
      <div class="details-actions">${!order.paid?`<button class="secondary" data-edit="${esc(order.id)}">${ht('تعديل الصيانة والتكلفة')}</button>`:''}<button class="secondary" data-print="${esc(order.id)}">${ht(quote?'طباعة العرض':'طباعة الفاتورة')}</button>${quote?'':`${order.total>0?`<button class="secondary" data-paid="${esc(order.id)}">${ht(order.paid?'إلغاء جميع الدفعات':balance.received>0?'تسجيل كامل المتبقي':'تسجيل كامل المبلغ')}</button>`:''}${ready&&!delivered?`<button class="secondary" data-status="${esc(order.id)}">${ht('إعادة فتح الصيانة')}</button><button class="secondary" data-message="received" data-order="${esc(order.id)}">${ht('رسالة الاستلام')}</button>`:''}`}</div>
    </details>
  </article>`;
}
function render(){
  applyStaticLanguage();
  const activeTab=['parts','finance','backup','notifications'].includes(page)?'more':page;
  $('#nav').innerHTML=tabs.map(([target,name,title])=>`<button data-page="${target}" ${target===activeTab?'aria-current="page"':''} class="${target===activeTab?'active':''}">${icon(name)}<span>${ht(title)}</span></button>`).join('');
  const content=$('#content'),s=summary(state);
  if(page==='dashboard'){
    const invoices=[...state.orders].reverse().filter(order=>order.kind==='invoice');
    const active=invoices.filter(order=>!isReady(order)&&!isDelivered(order)),ready=invoices.filter(order=>isReady(order)&&!isDelivered(order));
    const visible=invoices.filter(order=>(workFilter==='all'||(workFilter==='ready'?isReady(order)&&!isDelivered(order):!isReady(order)&&!isDelivered(order)))&&matches(order));
    content.innerHTML=`<section class="hero"><div class="hero-copy"><span class="section-kicker" dir="ltr">WORKSHOP / 01</span><h1>${ht('سيارات الورشة')}</h1><p>${ht('إدارة الصيانة، من الاستلام إلى التسليم.')}</p></div><button class="primary intake-cta" data-add="intake">${icon('plus')}${ht('استلام سيارة')}</button></section>
      <div class="workshop-counts" aria-label="${ht('حالة السيارات')}"><button class="count-card ${workFilter==='active'?'active':''}" data-filter="active" aria-pressed="${workFilter==='active'}"><strong>${active.length}</strong><span>${ht('داخل الورشة')}</span></button><button class="count-card ${workFilter==='ready'?'active':''}" data-filter="ready" aria-pressed="${workFilter==='ready'}"><strong>${ready.length}</strong><span>${ht('جاهزة للتسليم')}</span></button><button class="count-card ${workFilter==='all'?'active':''}" data-filter="all" aria-pressed="${workFilter==='all'}"><strong>${invoices.length}</strong><span>${ht('كل السيارات')}</span></button></div>
      <div class="list-heading"><div><h2>${ht(workFilter==='ready'?'جاهزة للتسليم':workFilter==='all'?'جميع السيارات':'الصيانة الجارية')}</h2><p class="list-caption">${ht('عرض {count} من {total} سيارة',{count:visible.length,total:invoices.length})}</p></div><div class="toolbar">${searchField('الاسم أو اللوحة')}</div></div>
      <div class="work-list">${visible.map(orderCard).join('')||`<div class="empty-state"><h2>${ht(query?'لا توجد سيارة بهذه البيانات':workFilter==='ready'?'لا توجد سيارات جاهزة بعد':'لا توجد سيارات هنا حاليًا')}</h2><p>${ht(query?'جرّب اسم العميل أو رقم اللوحة.':'اضغط «استلام سيارة» لبدء أمر جديد.')}</p></div>`}</div>`;
  }
  if(page==='orders')content.innerHTML=heading('الفواتير وعروض الأسعار','ابحث عن مستند، اطبعه، أو سجّل الدفع.','order','فاتورة جديدة')+`<div class="toolbar">${searchField('رقم الفاتورة، العميل أو اللوحة')}<button class="secondary" data-add="quote">${icon('plus')}${ht('عرض سعر')}</button></div><div class="work-list">${[...state.orders].reverse().filter(matches).map(orderCard).join('')||`<div class="empty-state">${ht('لا توجد مستندات مطابقة.')}</div>`}</div>`;
  if(page==='customers'){
    const list=state.customers.filter(owner=>[owner.name,owner.phone,...state.vehicles.filter(car=>car.customerId===owner.id).map(car=>car.plate+' '+car.model)].join(' ').toLowerCase().includes(query.toLowerCase()));
    content.innerHTML=heading('عملاؤك وسياراتهم','بيانات العميل في مكان واحد.','customer','عميل جديد')+`<div class="toolbar">${searchField('اسم العميل، الهاتف أو اللوحة')}<button class="secondary" data-add="vehicle">${ht('إضافة سيارة')}</button></div><div class="customer-list">${list.map(owner=>`<article class="customer-card"><h2 dir="auto">${esc(owner.name)}</h2><p dir="ltr">${esc(owner.phone)}</p>${state.vehicles.filter(car=>car.customerId===owner.id).map(car=>`<div class="customer-vehicle"><div><b dir="auto">${esc(car.model)}</b><small dir="auto">${esc(car.plate)}</small></div><button class="secondary" data-add="intake" data-vehicle="${esc(car.id)}">${ht('استلام السيارة')}</button></div>`).join('')||`<p class="hint">${ht('لم تسجّل سيارة لهذا العميل بعد.')}</p>`}</article>`).join('')||`<div class="empty-state">${ht('لم يُسجّل عميل بهذه البيانات.')}</div>`}</div>`;
  }
  if(page==='more')content.innerHTML=heading('أدوات الكراج','افتح ما تحتاجه عندما تحتاجه.')+`<div class="more-grid"><button class="menu-card" data-page="notifications">${icon('chat')}<b>${ht('رسائل واتساب')}</b><span>${ht('اللغة وخيارات إشعار العميل')}</span></button><button class="menu-card" data-page="parts">${icon('box')}<b>${ht('قطع الغيار والمخزون')}</b><span>${ht('الكميات وأسعار الشراء والبيع')}</span></button><button class="menu-card" data-page="finance">${icon('money')}<b>${ht('الحسابات والمصاريف')}</b><span>${ht('الربح، التحصيل والمصاريف')}</span></button><button class="menu-card" data-page="backup">${icon('backup')}<b>${ht('النسخ الاحتياطي')}</b><span>${ht('احفظ بياناتك أو انقلها لجهاز آخر')}</span></button></div><div class="panel help-panel"><h2>${ht('كيف تراسل العميل؟')}</h2><p>${ht('افتح بطاقة السيارة واضغط زر واتساب. راجع الرقم والرسالة، ثم افتح واتساب واضغط إرسال.')}</p><p class="hint">${ht('عند الضغط على «السيارة جاهزة» تظهر رسالة الجاهزية لتراجعها. لا يتم إرسال أي رسالة تلقائيًا.')}</p></div>`;
  if(page==='notifications')content.innerHTML=heading('إشعارات واتساب','جهّز رسالة العميل باللغة التي يفضّلها.')+`<section class="panel notification-settings"><h2>${ht('تفضيلات الرسائل')}</h2><label class="field">${ht('اللغة الافتراضية')}<select id="default-message-language">${languageOptions(preferences.language)}</select></label><label class="check-option"><input id="receipt-preview-default" type="checkbox" ${preferences.openReceiptAfterIntake?'checked':''}><span>${ht('افتح معاينة رسالة الاستلام بعد حفظ السيارة')}</span></label><p class="hint">${ht('يفتح رسالة جاهزة للمراجعة؛ تضغط إرسال بنفسك داخل واتساب.')}</p></section><section class="panel notification-settings"><div class="panel-head"><h2>${ht('الإرسال التلقائي')}</h2><span class="pill">${ht('غير متصل')}</span></div><p>${ht('إرسال الرسالة دون فتح واتساب يحتاج ربط رقم الكراج رسميًا بخدمة واتساب للأعمال وخادم إرسال آمن.')}</p><label class="check-option"><input id="auto-whatsapp-toggle" type="checkbox" disabled aria-describedby="auto-whatsapp-status"><span>${ht('إرسال رسالة تلقائيًا عند استلام السيارة')}</span></label><p id="auto-whatsapp-status" class="hint">${ht('لم يتم ربط خدمة إرسال. لا يتم إرسال أي رسالة تلقائيًا حاليًا.')}</p><details class="form-advanced"><summary>${ht('ما المطلوب لتفعيله؟')}</summary><p>${ht('حساب WhatsApp Business Platform برقم مفعّل، وقوالب رسائل عربية وإنجليزية معتمدة، وخادم يحفظ مفاتيح الربط بأمان. تطبيق واتساب على الهاتف وحده لا يفعّل هذه الخدمة.')}</p></details></section>`;
  if(page==='parts')content.innerHTML=heading('قطع الغيار','تابع المتوفر وأضف كميات جديدة.','part','قطعة جديدة')+`<section class="panel">${table(['القطعة','المتوفر','التكلفة','سعر البيع',''],state.parts.map(part=>`<tr><td><b dir="auto">${esc(part.name)}</b></td><td><span class="pill ${part.stock>5?'done':''}">${part.stock}</span></td><td>${cash(part.cost)}</td><td>${cash(part.price)}</td><td><button class="secondary" data-restock="${esc(part.id)}">${ht('إضافة كمية')}</button></td></tr>`))}</section>`;
  if(page==='finance')content.innerHTML=heading('حسابات الكراج','ملخص لجميع العمليات المسجلة بالدرهم.','expense','مصروف جديد')+`<div class="stats">${stat('الإيرادات',cash(s.revenue),'قبل الضريبة',true)}${stat('تكلفة القطع',cash(s.cost),'وقت إصدار الفاتورة')}${stat('المصاريف',cash(s.expenses),'مصاريف التشغيل')}${stat('الربح التقديري',cash(s.profit),'بعد تكلفة القطع والمصاريف')}</div><section class="panel"><div class="panel-head"><h2>${ht('المصاريف')}</h2><span>${ht('غير المحصّل: {amount}',{amount:cash(s.unpaid)})}</span></div>${table(['الوصف','المبلغ'],[...state.expenses,...salaryExpenseRows(state).map(entry=>({name:t('راتب: {name} — {month}',{name:entry.employeeName,month:entry.month}),amount:entry.amount}))].map(expense=>`<tr><td dir="auto">${esc(expense.name)}</td><td>${cash(expense.amount)}</td></tr>`))}<div class="finance-note">${ht('الربح = الفواتير قبل الضريبة − تكلفة القطع − المصاريف. عروض الأسعار مستبعدة. هذا ملخص تجريبي.')}</div></section>`;
  if(page==='backup')content.innerHTML=heading('احفظ نسخة من بياناتك','النسخة الاحتياطية تساعدك على استعادتها أو نقلها.')+`<section class="panel backup"><h2>${ht('بيانات هذا الجهاز')}</h2><p>${ht('بياناتك محفوظة في هذا المتصفح فقط. لا تنتقل تلقائيًا بين الآيفون والكمبيوتر، وحذف بيانات المتصفح يزيلها.')}</p><button id="export" class="primary">${icon('backup')}${ht('تنزيل نسخة احتياطية')}</button><label class="field">${ht('استعادة نسخة محفوظة')}<input id="import" type="file" accept="application/json,.json"></label><p class="hint">${ht('الاستعادة تستبدل البيانات الحالية بعد تأكيدك. احفظ ملف النسخة في مكان خاص.')}</p><details class="form-advanced"><summary>${ht('مسح البيانات')}</summary><p>${ht('صدّر نسخة أولًا إذا أردت الاحتفاظ بالبيانات.')}</p><button id="clear" class="secondary">${ht('مسح البيانات والبدء من جديد')}</button></details></section>`;
  workshop?.decorate();operations?.decorate();
}
const field=(name,label,type='text',value='',extra='',required=true)=>`<label class="field">${ht(label)}<input ${required?'required':''} name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?`min="0" step="${['qty','stock'].includes(name)?'1':'0.01'}"`:''} ${type==='tel'?'dir="ltr" inputmode="tel" placeholder="0501234567"':''} ${extra}></label>`;
const select=(name,label,options,optional=false,emptyText='')=>`<label class="field">${ht(label)}<select name="${name}" ${optional?'':'required'}><option value="">${ht(emptyText||(optional?'بدون قطعة':'اختر...'))}</option>${options.map(([value,text])=>`<option value="${esc(value)}">${esc(text)}</option>`).join('')}</select></label>`;
function charges(order){return field('labor','أجور العمل بالدرهم','number',order?.labor??'0')+select('partId','قطعة غيار',state.parts.map(part=>[part.id,`${part.name} (${t('{stock} متوفر',{stock:part.stock})}) — ${cash(part.price)}`]),true)+field('qty','كمية القطع','number',order?.qty??'0')+`<p class="hint">${ht('تُضاف ضريبة تجريبية ٥٪. بدون قطعة اترك الكمية صفرًا.')}</p>`}
function vehiclePreviewMarkup(model){const art=vehicleArtwork(model);const mark=art.src?`<img src="${esc(art.src)}" alt="">`:'<span class="vehicle-mark-empty" aria-hidden="true">?</span>';return `${mark}<div><b>${esc(art.src?art.label:t('شعار الشركة'))}</b><small>${ht(art.src?'شعار شركة السيارة المطابق للاسم.':String(model||'').trim()?'لم أتعرف على الشركة بعد. أضف اسمها بالعربي أو الإنجليزي.':'اكتب الشركة أو الموديل لعرض شعارها.')}</small></div>`}
function modelField(label){return field('model',label)+`<div id="vehicle-preview" class="vehicle-preview">${vehiclePreviewMarkup('')}</div>`}
function notificationFields(){return `<div class="form-section notification-options"><label class="field">${ht('لغة رسالة العميل')}<select name="messageLanguage">${languageOptions(preferences.language)}</select></label><label class="check-option"><input type="checkbox" name="previewReceipt" value="yes" ${preferences.openReceiptAfterIntake?'checked':''}><span>${ht('اعرض رسالة الاستلام بعد الحفظ')}</span></label><p class="hint">${ht('هذا يفتح المعاينة فقط. الإرسال يتم من واتساب بعد مراجعتك.')}</p></div>`}
function englishDescription(order){return field('descriptionEn','وصف الخدمة بالإنجليزية (اختياري)','text',order?.descriptionEn||'','dir="ltr" lang="en"',false)}
function documentFields(){return `<label class="field">${ht('لغة المستند')}<select id="print-language" name="documentLanguage">${languageOptions(preferences.uiLanguage,true)}</select></label><p class="hint">${ht('وصف الخدمة يُطبع كما أُدخل؛ اختر اللغة المناسبة عند كتابته.')}</p>`}
function guestQuoteFields(guest={}){return `<div id="guest-quote-fields">${field('guestName','اسم العميل','text',guest.customerName||'')}${field('guestPhone','رقم الهاتف (اختياري)','tel',guest.phone||'','',false)}${field('guestModel','السيارة (الشركة والموديل)','text',guest.vehicleModel||'')}<div id="guest-vehicle-preview" class="vehicle-preview">${vehiclePreviewMarkup(guest.vehicleModel||'')}</div>${field('guestPlate','رقم اللوحة والإمارة','text',guest.plate||'')}<p class="hint">${ht('يمكن إصدار العرض دون حفظ العميل في سجل العملاء.')}</p></div>`}
function guestFrom(data){return {customerName:data.guestName,phone:data.guestPhone||'',vehicleModel:data.guestModel,plate:data.guestPlate}}
function syncQuote(){const group=$('#guest-quote-fields'),registered=$('#fields [name="vehicleId"]');if(!group||!registered)return;const manual=!registered.value;group.hidden=!manual;group.querySelectorAll('input').forEach(input=>input.disabled=!manual)}
function open(kind,options={}){
  $('#error').textContent='';let html='',title='',button='حفظ البيانات',afterSave;
  if(kind==='intake'){
    title='استلام سيارة';button='حفظ الاستلام';
    html=`<p class="hint">${ht('سجّل العميل والسيارة في خطوة واحدة.')}</p>`+select('vehicleId','سيارة مسجلة سابقًا',state.vehicles.map(car=>[car.id,`${car.plate} — ${customer(car)?.name}`]),true,'عميل أو سيارة جديدة')+
      `<div id="new-car-fields">${select('customerId','العميل',state.customers.map(owner=>[owner.id,owner.name]),true,'عميل جديد')}<div id="new-customer-fields">${field('name','اسم العميل')}${field('phone','رقم واتساب العميل','tel')}</div>${modelField('السيارة (الشركة والموديل)')}${field('plate','رقم اللوحة والإمارة')}</div>`+
      field('description','سبب الزيارة / الخدمة')+`<details class="form-advanced"><summary>${ht('التكلفة وقطع الغيار (اختياري الآن)')}</summary>${englishDescription()}${charges()}${documentFields()}</details>`+notificationFields();
    submit=(next,data)=>{
      let vehicleId=data.vehicleId;
      if(!vehicleId){
        if(next.vehicles.some(car=>car.plate.trim().toLowerCase()===data.plate.trim().toLowerCase()))throw Error('هذه اللوحة مسجلة؛ اختر السيارة من القائمة بالأعلى.');
        let customerId=data.customerId;
        if(!customerId){const phone='+'+normalizeWhatsAppPhone(data.phone);customerId=id();next.customers.push({id:customerId,name:data.name.trim(),phone})}
        vehicleId=id();next.vehicles.push({id:vehicleId,customerId,model:data.model.trim(),plate:data.plate.trim(),...(workshop?.vehicleFields(data)||{})});
      }
      return createOrder(next,{...data,vehicleId,kind:'invoice'});
    };
    afterSave=(order,data)=>{page='dashboard';workFilter='active';query='';render();toast('تم استلام السيارة.');if(data.previewReceipt==='yes')openMessage(order.id,'received')};
  }
  if(kind==='customer'){title='عميل جديد';html=field('name','اسم العميل')+field('phone','رقم واتساب العميل','tel');submit=(next,data)=>next.customers.push({id:id(),name:data.name.trim(),phone:'+'+normalizeWhatsAppPhone(data.phone)})}
  if(kind==='vehicle'){
    if(!state.customers.length)return toast('سجّل عميلًا أولًا، أو استخدم «استلام سيارة».');
    title='إضافة سيارة';html=select('customerId','العميل',state.customers.map(owner=>[owner.id,owner.name]))+modelField('الشركة والموديل وسنة الصنع')+field('plate','رقم اللوحة والإمارة');
    submit=(next,data)=>{if(next.vehicles.some(car=>car.plate.trim().toLowerCase()===data.plate.trim().toLowerCase()))throw Error('اللوحة مسجلة مسبقًا');next.vehicles.push({id:id(),customerId:data.customerId,model:data.model.trim(),plate:data.plate.trim(),...(workshop?.vehicleFields(data)||{})})};
  }
  if(kind==='part'){title='قطعة غيار جديدة';html=field('name','اسم القطعة / Part name')+field('stock','الكمية','number','0')+field('cost','تكلفة الشراء للوحدة','number')+field('price','سعر البيع للوحدة','number');submit=(next,data)=>{if(!Number.isInteger(Number(data.stock)))throw Error('الكمية يجب أن تكون عددًا صحيحًا');next.parts.push({id:id(),name:data.name.trim(),stock:amount(data.stock),cost:amount(data.cost),price:amount(data.price)})}}
  if(kind==='restock'){title='إضافة كمية للمخزون';html=field('qty','الكمية الجديدة','number','1');submit=(next,data)=>{if(!Number.isInteger(+data.qty)||+data.qty<1)throw Error('أدخل عددًا صحيحًا موجبًا');next.parts.find(part=>part.id===options.partId).stock+=+data.qty}}
  if(kind==='expense'){title='مصروف جديد';html=field('name','وصف المصروف')+field('amount','المبلغ بالدرهم','number');submit=(next,data)=>next.expenses.push({id:id(),name:data.name.trim(),amount:amount(data.amount)})}
  if(kind==='order'||kind==='quote'){
    if(kind==='order'&&!state.vehicles.length)return open('intake');title=kind==='quote'?'عرض سعر جديد':'فاتورة صيانة';
    html=kind==='quote'?select('vehicleId','سيارة مسجلة (اختياري)',state.vehicles.map(car=>[car.id,`${car.plate} — ${customer(car)?.name}`]),true,'إدخال العميل والسيارة يدويًا')+guestQuoteFields():select('vehicleId','السيارة والعميل',state.vehicles.map(car=>[car.id,`${car.plate} — ${customer(car)?.name}`]));
    html+=field('description','الخدمة / Service description')+englishDescription()+charges()+documentFields();
    submit=(next,data)=>createOrder(next,{...data,kind:kind==='quote'?'quote':'invoice',...(kind==='quote'&&!data.vehicleId?{guest:guestFrom(data)}:{})});
  }
  if(kind==='edit'){
    const order=state.orders.find(entry=>entry.id===options.orderId);if(!order)return;
    if(order.paid)return toast('ألغِ تسجيل الدفع أولًا لتعديل الفاتورة.');
    title='تعديل الصيانة والتكلفة';html=(order.guest?guestQuoteFields(order.guest):'')+field('description','الخدمة','text',order.description)+englishDescription(order)+charges(order);
    submit=(next,data)=>updateOrder(next,order.id,{...data,...(order.guest?{guest:guestFrom(data)}:{})});
  }
  $('#dialog-title').textContent=t(title);$('#fields').innerHTML=html;$('#save-button').textContent=t(button);$('#form').afterSave=afterSave;
  if(kind==='edit')$('#fields [name="partId"]').value=state.orders.find(order=>order.id===options.orderId).partId;
  if(kind==='intake'){if(options.vehicleId)$('#fields [name="vehicleId"]').value=options.vehicleId;syncIntake()}
  if(kind==='quote')syncQuote();
  $('#dialog').showModal();
}
function syncIntake(){
  const vehicleSelect=$('#fields [name="vehicleId"]'),newCar=$('#new-car-fields');if(!newCar)return;
  const existing=!!vehicleSelect.value;newCar.hidden=existing;newCar.querySelectorAll('input,select').forEach(input=>input.disabled=existing);
  if(!existing){const existingCustomer=!!$('#fields [name="customerId"]').value;$('#new-customer-fields').hidden=existingCustomer;$('#new-customer-fields').querySelectorAll('input').forEach(input=>input.disabled=existingCustomer)}
}
function openMessage(orderId,kind){
  const order=state.orders.find(entry=>entry.id===orderId);if(!order||order.kind!=='invoice')return;
  if(kind==='ready'&&!isReady(order))return toast('حدّد أن السيارة جاهزة أولًا.');
  const car=vehicle(order),owner=customer(car);
  messageContext={kind,customerName:owner?.name,model:car?.model,plate:car?.plate,orderNumber:order.number};
  messageDrafts={ar:serviceMessage({...messageContext,language:'ar'}),en:serviceMessage({...messageContext,language:'en'})};
  messageLanguage=order.messageLanguage||preferences.language;
  $('#message-title').textContent=t(kind==='ready'?'إشعار جاهزية السيارة':'إشعار استلام السيارة');
  $('#message-customer').textContent=owner?.name||t('العميل');$('#wa-phone').value=owner?.phone||'';$('#message-language').value=messageLanguage;
  $('#wa-text').value=messageDrafts[messageLanguage];$('#wa-text').dir=messageLanguage==='en'?'ltr':'rtl';$('#wa-text').lang=messageLanguage;
  updateMessageLink();$('#message-dialog').showModal();
}
function switchMessageLanguage(language){if(!['ar','en'].includes(language)||!messageContext)return;messageDrafts[messageLanguage]=$('#wa-text').value;messageLanguage=language;$('#wa-text').value=messageDrafts[language];$('#wa-text').dir=language==='en'?'ltr':'rtl';$('#wa-text').lang=language;savePreferences({language});updateMessageLink()}
function updateMessageLink(){
  const link=$('#wa-send');
  try{const text=$('#wa-text').value.trim();if(!text)throw Error('اكتب نص الرسالة.');link.href=buildWhatsAppUrl($('#wa-phone').value,text);link.removeAttribute('aria-disabled');$('#message-error').textContent=''}
  catch(error){link.removeAttribute('href');link.setAttribute('aria-disabled','true');$('#message-error').textContent=t(error.message)}
}
$('#form').addEventListener('submit',event=>{
  event.preventDefault();try{
    const data=Object.fromEntries(new FormData(event.target));
    if(Object.values(data).some(value=>typeof value==='string'&&value!==''&&!value.trim()))throw Error('أدخل بيانات صحيحة');
    const next=structuredClone(state),result=submit(next,data);save(next);$('#dialog').close();toast('تم الحفظ');$('#form').afterSave?.(result,data);
  }catch(error){$('#error').textContent=t(error.message)}
});
$('#close').onclick=()=>$('#dialog').close();$('#message-close').onclick=()=>$('#message-dialog').close();
$('#wa-send').addEventListener('click',event=>{updateMessageLink();if(!$('#wa-send').hasAttribute('href'))event.preventDefault()});
document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.page)navigate(button.dataset.page);
  if(button.dataset.filter){workFilter=button.dataset.filter;render()}
  if(button.dataset.add)open(button.dataset.add,{vehicleId:button.dataset.vehicle});
  if(button.dataset.edit)open('edit',{orderId:button.dataset.edit});
  if(button.dataset.restock)open('restock',{partId:button.dataset.restock});
  if(button.dataset.message)openMessage(button.dataset.order,button.dataset.message);
  if(button.dataset.paid){const order=state.orders.find(entry=>entry.id===button.dataset.paid);if(!order.paid||confirm(t('إلغاء جميع الدفعات مع الاحتفاظ بسجل الإلغاء؟')))mutate(next=>{const entry=next.orders.find(order=>order.id===button.dataset.paid);if(entry.paid)voidAllPayments(next,entry.id);else recordPayment(next,entry.id,{amount:paymentSummary(entry).remaining})})}
  if(button.dataset.status){
    const order=state.orders.find(entry=>entry.id===button.dataset.status),ready=!isReady(order);
    if(mutate(next=>{next.orders.find(entry=>entry.id===order.id).status=ready?'مكتمل':'قيد العمل'},ready?'السيارة جاهزة للتسليم':'أُعيد فتح الصيانة')&&ready)openMessage(order.id,'ready');
  }
  if(button.dataset.print)printOrder(button.dataset.print);
  if(button.id==='export'){
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download='zakher-backup-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  if(button.id==='clear'&&confirm(t('هل صدّرت نسخة؟ سيتم مسح جميع البيانات المحلية.')))mutate(next=>{for(const key of Object.keys(next))delete next[key];Object.assign(next,empty())});
});
document.addEventListener('input',event=>{
  if(event.target.name==='model'&&$('#vehicle-preview'))$('#vehicle-preview').innerHTML=vehiclePreviewMarkup(event.target.value);
  if(event.target.name==='guestModel'&&$('#guest-vehicle-preview'))$('#guest-vehicle-preview').innerHTML=vehiclePreviewMarkup(event.target.value);
  if(event.target.id==='search'){const position=event.target.selectionStart;query=event.target.value;render();$('#search').focus();if(typeof position==='number')$('#search').setSelectionRange(position,position)}
  if(['wa-phone','wa-text'].includes(event.target.id))updateMessageLink();
});
document.addEventListener('change',async event=>{
  if(event.target.id==='ui-language'&&['ar','en'].includes(event.target.value)){if(savePreferences({uiLanguage:event.target.value}))render()}
  if(event.target.id==='message-language')switchMessageLanguage(event.target.value);
  if(event.target.id==='default-message-language')savePreferences({language:event.target.value});
  if(event.target.id==='receipt-preview-default')savePreferences({openReceiptAfterIntake:event.target.checked});
  if(event.target.matches('.document-language')&&['ar','en','both'].includes(event.target.value))documentChoices.set(event.target.dataset.order,event.target.value);
  if(['vehicleId','customerId'].includes(event.target.name)){syncIntake();syncQuote()}
  if(event.target.id!=='import')return;
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>5_000_000)throw Error('حجم الملف أكبر من المسموح');const next=validateBackup(JSON.parse(await file.text()));if(confirm(t('استبدال جميع البيانات الحالية بالنسخة المختارة؟'))){save(next);toast('تمت استعادة النسخة')}}catch(error){toast(t('تعذّر الاستيراد: {error}',{error:t(error.message)}))}
});
function printOrder(orderId){
  const order=state.orders.find(entry=>entry.id===orderId);if(!order)return;
  const car=vehicle(order),owner=customer(car),language=documentLanguage(order),english=language==='en';
  const label=text=>language==='both'?`${t(text,{},'ar')} / ${t(text,{},'en')}`:t(text,{},language);
  const safeLabel=text=>esc(label(text));
  const amountText=value=>`<bdi dir="ltr">${esc(cash(value,english?'en':'ar'))}</bdi>`;
  const description=english?(order.descriptionEn||order.description):language==='both'&&order.descriptionEn&&order.descriptionEn!==order.description?`${order.description}\n${order.descriptionEn}`:order.description;
  const rows=[`<tr><td><div class="document-description" dir="auto">${esc(description)}</div><small class="document-item-kind">${safeLabel('أجور العمل')}</small></td><td>1</td><td>${amountText(order.labor)}</td></tr>`,...(order.qty?[`<tr><td dir="auto">${esc(order.partName)}</td><td>${order.qty}</td><td>${amountText(order.partPrice*order.qty)}</td></tr>`]:[])];
  const balance=paymentSummary(order);
  const detail=(title,value,ltr=false)=>`<div class="document-detail"><dt>${safeLabel(title)}</dt><dd><bdi${ltr?' dir="ltr"':''}>${esc(value||'—')}</bdi></dd></div>`;
  const totalRow=(title,value,className='')=>`<div class="document-total-row ${className}"><span>${safeLabel(title)}</span><strong>${amountText(value)}</strong></div>`;
  const stampLabel=language==='both'?`<span lang="ar" dir="rtl">${ht('مختوم إلكترونياً',{},'ar')}</span> <span lang="en" dir="ltr">${ht('مختوم إلكترونياً',{},'en')}</span>`:safeLabel('مختوم إلكترونياً');
  const printArea=$('#print-area');printArea.dir=english?'ltr':'rtl';printArea.lang=english?'en':'ar';printArea.dataset.documentLanguage=language;
  printArea.innerHTML=`<div class="document-sheet">
    <div class="print-head">
      <div class="document-brand"><span class="document-brand-mark" aria-hidden="true">ز</span><div><span class="document-eyebrow" dir="ltr">ZAKHER GARAGE</span><h1>${english?'ZAKHER':language==='both'?'زاخر | ZAKHER':'كراج زاخر'}</h1><p>${safeLabel('لصيانة السيارات')}</p></div></div>
      <div class="document-heading"><h2>${safeLabel(order.kind==='quote'?'عرض سعر':'فاتورة تجريبية')}</h2><dl>${detail('رقم المستند',order.number,true)}${detail('التاريخ',new Date(order.date).toLocaleDateString('en-GB',{timeZone:'Asia/Dubai'}),true)}</dl></div>
    </div>
    <div class="document-parties">
      <section class="document-party"><h3>${safeLabel('بيانات العميل')}</h3><dl>${detail('العميل',owner?.name)}${detail('رقم الهاتف',owner?.phone,true)}</dl></section>
      <section class="document-party"><h3>${safeLabel('بيانات السيارة')}</h3><dl>${detail('السيارة',car?.model)}${detail('لوحة المركبة',car?.plate)}</dl></section>
    </div>
    <table class="document-items"><colgroup><col class="document-description-column"><col class="document-quantity-column"><col class="document-amount-column"></colgroup><thead><tr>${['الوصف','الكمية','المبلغ'].map(text=>`<th>${safeLabel(text)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>
    <div class="document-summary"><div class="totals">${totalRow('المجموع',order.subtotal)}${totalRow('الضريبة التجريبية ٥٪',order.tax)}${totalRow('الإجمالي',order.total,'document-grand-total')}${order.kind==='invoice'?`${totalRow('المدفوع',balance.received)}${totalRow('المتبقي',balance.remaining,'document-balance')}`:''}</div></div>
    <div class="document-footer"><div class="document-closing"><span class="document-eyebrow" dir="ltr">ZAKHER · AUTO MAINTENANCE</span><p class="document-thanks">${safeLabel('شكرًا لثقتكم.')}</p><p class="document-disclaimer">${safeLabel('مستند تجريبي، غير معتمد ضريبيًا.')}</p></div><div class="document-seal"><div class="garage-stamp" aria-label="${safeLabel('كراج زاخر لصيانة السيارات')}"><span class="stamp-stars" aria-hidden="true">✦ &nbsp; ✦ &nbsp; ✦</span><span class="stamp-garage">${english?'ZAKHER GARAGE':'كراج زاخر'}</span><strong class="stamp-name" dir="${english?'rtl':'ltr'}">${english?'زاخر':'ZAKHER'}</strong><span class="stamp-service">${english?'AUTO MAINTENANCE':'لصيانة السيارات'}</span></div><p class="electronic-stamp">${stampLabel}</p></div></div>
  </div>`;
  window.print();
}
workshop=initializeWorkshop({getState:()=>state,saveState:save,toast,getLanguage:()=>preferences.uiLanguage,t});
operations=initializeOperations({getState:()=>state,saveState:save,toast,getLanguage:()=>preferences.uiLanguage});
render();
