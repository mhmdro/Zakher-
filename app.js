import {empty,id,amount,createOrder,updateOrder,summary,validateBackup,demo,normalizeWhatsAppPhone,buildWhatsAppUrl,serviceMessage} from './domain.js?v=3';

const $=selector=>document.querySelector(selector);
const key='zakher-garage-v1';
let state;
try {
  state=localStorage.getItem(key)?validateBackup(JSON.parse(localStorage.getItem(key))):demo();
} catch {
  state=empty();
  $('#notice').textContent='تعذّر فتح البيانات المحفوظة. استعد نسخة احتياطية قبل إضافة بيانات جديدة.';
  $('#notice').classList.add('notice-error');$('#content').before($('#notice'));
}
let page='dashboard',query='',workFilter='active',submit,toastTimer;
const tabs=[['dashboard','car','الورشة'],['orders','file','الفواتير'],['customers','users','العملاء'],['more','menu','المزيد']];
const paths={car:'M5 17H3v-6l2-6h14l2 6v6h-2M5 17h14M5 17v3m14-3v3M3 11h18M7 14h.01M17 14h.01',file:'M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h6',users:'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M16 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',menu:'M4 6h16M4 12h16M4 18h16',plus:'M12 5v14M5 12h14',check:'m5 12 4 4L19 6',chat:'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z',box:'m12 3 9 5-9 5-9-5 9-5Zm-9 5v9l9 5 9-5V8M12 13v9',money:'M3 5h18v14H3V5Zm12 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',backup:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5'};
const icon=name=>`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.file}"/></svg>`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=value=>Number(value).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2})+' د.إ';
const vehicle=order=>state.vehicles.find(v=>v.id===order.vehicleId);
const customer=car=>state.customers.find(c=>c.id===car?.customerId);
const isReady=order=>order.status==='مكتمل';
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').style.display='block';toastTimer=setTimeout(()=>$('#toast').style.display='none',4000)}
function save(next){localStorage.setItem(key,JSON.stringify(next));state=next;render()}
function mutate(action,message='تم الحفظ'){try{const next=structuredClone(state);action(next);save(next);toast(message);return true}catch(error){toast(error.message);return false}}
function navigate(target){page=target;query='';render();window.scrollTo({top:0,behavior:'instant'})}
function heading(title,sub,action='',label=''){return `<div class="titlebar"><div><h1>${title}</h1><p class="subtitle">${sub}</p></div>${action?`<button class="primary" data-add="${action}">${icon('plus')}${label}</button>`:''}</div>`}
function stat(title,value,foot,highlight=false){return `<div class="stat ${highlight?'highlight':''}"><label>${title}</label><strong>${value}</strong><small>${foot}</small></div>`}
function table(headers,rows){return rows.length?`<div class="table-wrap"><table><thead><tr>${headers.map(text=>`<th>${text}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`:'<div class="empty">لا توجد بيانات بعد.</div>'}
function searchField(placeholder){return `<input id="search" aria-label="${placeholder}" placeholder="${placeholder}" value="${esc(query)}" type="search">`}
function matches(order){const v=vehicle(order);return [order.number,order.description,customer(v)?.name,v?.model,v?.plate].join(' ').toLowerCase().includes(query.toLowerCase())}
function orderCard(order){
  const car=vehicle(order),owner=customer(car),quote=order.kind==='quote',ready=isReady(order);
  return `<article class="work-card ${ready?'ready':''}">
    <div class="card-top"><span class="pill ${quote?'blue':ready?'done':''}">${quote?'عرض سعر':ready?'جاهزة للتسليم':'داخل الورشة'}</span><span class="order-number" dir="ltr">${esc(order.number)}</span></div>
    <div class="vehicle-heading"><div class="vehicle-emblem" aria-hidden="true">${icon('car')}</div><div><h2 class="car-name" dir="auto">${esc(car?.model)}</h2><span class="vehicle-subtitle">بطاقة صيانة</span></div></div>
    <div class="plate"><span class="plate-label">لوحة المركبة</span><bdi class="plate-number" dir="auto">${esc(car?.plate)}</bdi></div>
    <div class="card-info"><div class="info-item"><span class="info-label">العميل</span><p class="info-value customer-line">${esc(owner?.name)}</p></div><div class="info-item"><span class="info-label">الخدمة</span><p class="info-value service-description">${esc(order.description)}</p></div></div>
    ${quote?'':`<div class="card-actions">${!ready?`<button class="primary" data-status="${esc(order.id)}">${icon('check')}السيارة جاهزة</button>`:''}<button class="whatsapp" data-message="${ready?'ready':'received'}" data-order="${esc(order.id)}">${icon('chat')}${ready?'واتساب: السيارة جاهزة':'واتساب: تم الاستلام'}</button></div>`}
    <details class="order-details"><summary>${quote?'تفاصيل عرض السعر':'الفاتورة والمزيد'}</summary><p>الإجمالي: <b>${cash(order.total)}</b> <small>شامل الضريبة التجريبية ٥٪</small></p>${quote?'':`<p>الدفع: <b>${order.paid?'مدفوعة':'غير مدفوعة'}</b></p>`}<div class="details-actions">${!order.paid?`<button class="secondary" data-edit="${esc(order.id)}">تعديل الصيانة والتكلفة</button>`:''}<button class="secondary" data-print="${esc(order.id)}">طباعة ${quote?'العرض':'الفاتورة'}</button>${quote?'':`<button class="secondary" data-paid="${esc(order.id)}">${order.paid?'إلغاء تسجيل الدفع':'تسجيل الدفع'}</button>${ready?`<button class="secondary" data-status="${esc(order.id)}">إعادة فتح الصيانة</button><button class="secondary" data-message="received" data-order="${esc(order.id)}">رسالة الاستلام</button>`:''}`}</div></details>
  </article>`;
}
function render(){
  const activeTab=['parts','finance','backup'].includes(page)?'more':page;
  $('#nav').innerHTML=tabs.map(([target,i,title])=>`<button data-page="${target}" ${target===activeTab?'aria-current="page"':''} class="${target===activeTab?'active':''}">${icon(i)}<span>${title}</span></button>`).join('');
  const content=$('#content'),s=summary(state);
  if(page==='dashboard'){
    const invoices=[...state.orders].reverse().filter(o=>o.kind==='invoice');
    const active=invoices.filter(o=>!isReady(o)),ready=invoices.filter(isReady);
    const visible=invoices.filter(o=>(workFilter==='all'||(workFilter==='ready'?isReady(o):!isReady(o)))&&matches(o));
    content.innerHTML=`<section class="hero"><div class="hero-copy"><span class="section-kicker" dir="ltr">WORKSHOP / 01</span><h1>سيارات الورشة</h1><p>إدارة الصيانة، من الاستلام إلى التسليم.</p></div><button class="primary intake-cta" data-add="intake">${icon('plus')}استلام سيارة</button></section>
      <div class="workshop-counts" aria-label="حالة السيارات"><button class="count-card ${workFilter==='active'?'active':''}" data-filter="active" aria-pressed="${workFilter==='active'}"><strong>${active.length}</strong><span>داخل الورشة</span></button><button class="count-card ${workFilter==='ready'?'active':''}" data-filter="ready" aria-pressed="${workFilter==='ready'}"><strong>${ready.length}</strong><span>جاهزة للتسليم</span></button><button class="count-card ${workFilter==='all'?'active':''}" data-filter="all" aria-pressed="${workFilter==='all'}"><strong>${invoices.length}</strong><span>كل السيارات</span></button></div>
      <div class="list-heading"><div><h2>${workFilter==='ready'?'جاهزة للتسليم':workFilter==='all'?'جميع السيارات':'الصيانة الجارية'}</h2><p class="list-caption">عرض ${visible.length} من ${invoices.length} سيارة</p></div><div class="toolbar">${searchField('الاسم أو اللوحة')}</div></div><div class="work-list">${visible.map(orderCard).join('')||`<div class="empty-state"><h2>${query?'لا توجد سيارة بهذه البيانات':workFilter==='ready'?'لا توجد سيارات جاهزة بعد':'لا توجد سيارات هنا حاليًا'}</h2><p>${query?'جرّب اسم العميل أو رقم اللوحة.':'اضغط «استلام سيارة» لبدء أمر جديد.'}</p></div>`}</div>`;
  }
  if(page==='orders')content.innerHTML=heading('الفواتير وعروض الأسعار','ابحث عن مستند، اطبعه، أو سجّل الدفع.','order','فاتورة جديدة')+`<div class="toolbar">${searchField('رقم الفاتورة، العميل أو اللوحة')}<button class="secondary" data-add="quote">${icon('plus')}عرض سعر</button></div><div class="work-list">${[...state.orders].reverse().filter(matches).map(orderCard).join('')||'<div class="empty-state">لا توجد مستندات مطابقة.</div>'}</div>`;
  if(page==='customers'){
    const list=state.customers.filter(c=>[c.name,c.phone,...state.vehicles.filter(v=>v.customerId===c.id).map(v=>v.plate+' '+v.model)].join(' ').toLowerCase().includes(query.toLowerCase()));
    content.innerHTML=heading('عملاؤك وسياراتهم','بيانات العميل في مكان واحد.','customer','عميل جديد')+`<div class="toolbar">${searchField('اسم العميل، الهاتف أو اللوحة')}<button class="secondary" data-add="vehicle">إضافة سيارة</button></div><div class="customer-list">${list.map(c=>`<article class="customer-card"><h2>${esc(c.name)}</h2><p dir="ltr">${esc(c.phone)}</p>${state.vehicles.filter(v=>v.customerId===c.id).map(v=>`<div class="customer-vehicle"><div><b dir="auto">${esc(v.model)}</b><small>${esc(v.plate)}</small></div><button class="secondary" data-add="intake" data-vehicle="${esc(v.id)}">استلام السيارة</button></div>`).join('')||'<p class="hint">لم تسجّل سيارة لهذا العميل بعد.</p>'}</article>`).join('')||'<div class="empty-state">لم يُسجّل عميل بهذه البيانات.</div>'}</div>`;
  }
  if(page==='more')content.innerHTML=heading('أدوات الكراج','افتح ما تحتاجه عندما تحتاجه.')+`<div class="more-grid"><button class="menu-card" data-page="parts">${icon('box')}<b>قطع الغيار والمخزون</b><span>الكميات وأسعار الشراء والبيع</span></button><button class="menu-card" data-page="finance">${icon('money')}<b>الحسابات والمصاريف</b><span>الربح، التحصيل والمصاريف</span></button><button class="menu-card" data-page="backup">${icon('backup')}<b>النسخ الاحتياطي</b><span>احفظ بياناتك أو انقلها لجهاز آخر</span></button></div><div class="panel help-panel"><h2>كيف تراسل العميل؟</h2><p>افتح بطاقة السيارة واضغط زر واتساب. راجع الرقم والرسالة، ثم افتح واتساب واضغط إرسال.</p><p class="hint">عند الضغط على «السيارة جاهزة» تظهر رسالة الجاهزية لتراجعها. لا يتم إرسال أي رسالة تلقائيًا.</p></div>`;
  if(page==='parts')content.innerHTML=heading('قطع الغيار','تابع المتوفر وأضف كميات جديدة.','part','قطعة جديدة')+`<section class="panel">${table(['القطعة','المتوفر','التكلفة','سعر البيع',''],state.parts.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td><span class="pill ${p.stock>5?'done':''}">${p.stock}</span></td><td>${cash(p.cost)}</td><td>${cash(p.price)}</td><td><button class="secondary" data-restock="${esc(p.id)}">إضافة كمية</button></td></tr>`))}</section>`;
  if(page==='finance')content.innerHTML=heading('حسابات الكراج','ملخص لجميع العمليات المسجلة بالدرهم.','expense','مصروف جديد')+`<div class="stats">${stat('الإيرادات',cash(s.revenue),'قبل الضريبة',true)}${stat('تكلفة القطع',cash(s.cost),'وقت إصدار الفاتورة')}${stat('المصاريف',cash(s.expenses),'مصاريف التشغيل')}${stat('الربح التقديري',cash(s.profit),'بعد تكلفة القطع والمصاريف')}</div><section class="panel"><div class="panel-head"><h2>المصاريف</h2><span>غير المحصّل: ${cash(s.unpaid)}</span></div>${table(['الوصف','المبلغ'],state.expenses.map(e=>`<tr><td>${esc(e.name)}</td><td>${cash(e.amount)}</td></tr>`))}<div class="finance-note">الربح = الفواتير قبل الضريبة − تكلفة القطع − المصاريف. عروض الأسعار مستبعدة. هذا ملخص تجريبي.</div></section>`;
  if(page==='backup')content.innerHTML=heading('احفظ نسخة من بياناتك','النسخة الاحتياطية تساعدك على استعادتها أو نقلها.')+`<section class="panel backup"><h2>بيانات هذا الجهاز</h2><p>بياناتك محفوظة في هذا المتصفح فقط. لا تنتقل تلقائيًا بين الآيفون والكمبيوتر، وحذف بيانات المتصفح يزيلها.</p><button id="export" class="primary">${icon('backup')}تنزيل نسخة احتياطية</button><label class="field">استعادة نسخة محفوظة<input id="import" type="file" accept="application/json,.json"></label><p class="hint">الاستعادة تستبدل البيانات الحالية بعد تأكيدك. احفظ ملف النسخة في مكان خاص.</p><details class="form-advanced"><summary>مسح البيانات</summary><p>صدّر نسخة أولًا إذا أردت الاحتفاظ بالبيانات.</p><button id="clear" class="secondary">مسح البيانات والبدء من جديد</button></details></section>`;
}
const field=(name,label,type='text',value='',extra='')=>`<label class="field">${label}<input required name="${name}" type="${type}" value="${esc(value)}" ${type==='number'?`min="0" step="${['qty','stock'].includes(name)?'1':'0.01'}"`:''} ${type==='tel'?'dir="ltr" inputmode="tel" placeholder="0501234567"':''} ${extra}></label>`;
const select=(name,label,options,optional=false,emptyText='')=>`<label class="field">${label}<select name="${name}" ${optional?'':'required'}><option value="">${emptyText||(optional?'بدون قطعة':'اختر...')}</option>${options.map(([value,text])=>`<option value="${esc(value)}">${esc(text)}</option>`).join('')}</select></label>`;
function charges(order){return field('labor','أجور العمل بالدرهم','number',order?.labor??'0')+select('partId','قطعة غيار',state.parts.map(p=>[p.id,`${p.name} (${p.stock} متوفر) — ${cash(p.price)}`]),true)+field('qty','كمية القطع','number',order?.qty??'0')+'<p class="hint">تُضاف ضريبة تجريبية ٥٪. بدون قطعة اترك الكمية صفرًا.</p>'}
function open(kind,options={}){
  $('#error').textContent='';let html='',title='',button='حفظ البيانات',afterSave;
  if(kind==='intake'){
    title='استلام سيارة';button='حفظ الاستلام';
    html='<p class="hint">سجّل العميل والسيارة في خطوة واحدة.</p>'+select('vehicleId','سيارة مسجلة سابقًا',state.vehicles.map(v=>[v.id,`${v.plate} — ${customer(v)?.name}`]),true,'عميل أو سيارة جديدة')+
      `<div id="new-car-fields">${select('customerId','العميل',state.customers.map(c=>[c.id,c.name]),true,'عميل جديد')}<div id="new-customer-fields">${field('name','اسم العميل')}${field('phone','رقم واتساب العميل','tel')}</div>${field('model','السيارة (الشركة والموديل)')}${field('plate','رقم اللوحة والإمارة')}</div>`+
      field('description','سبب الزيارة / الخدمة')+`<details class="form-advanced"><summary>التكلفة وقطع الغيار (اختياري الآن)</summary>${charges()}</details>`;
    submit=(s,d)=>{
      let vehicleId=d.vehicleId;
      if(!vehicleId){
        if(s.vehicles.some(v=>v.plate.trim().toLowerCase()===d.plate.trim().toLowerCase()))throw Error('هذه اللوحة مسجلة؛ اختر السيارة من القائمة بالأعلى.');
        let customerId=d.customerId;
        if(!customerId){const phone='+'+normalizeWhatsAppPhone(d.phone);customerId=id();s.customers.push({id:customerId,name:d.name.trim(),phone})}
        vehicleId=id();s.vehicles.push({id:vehicleId,customerId,model:d.model.trim(),plate:d.plate.trim()});
      }
      return createOrder(s,{...d,vehicleId,kind:'invoice'});
    };
    afterSave=()=>{page='dashboard';workFilter='active';query='';render();toast('تم استلام السيارة. يمكنك إرسال إشعار واتساب من بطاقتها.')};
  }
  if(kind==='customer'){title='عميل جديد';html=field('name','اسم العميل')+field('phone','رقم واتساب العميل','tel');submit=(s,d)=>s.customers.push({id:id(),name:d.name.trim(),phone:'+'+normalizeWhatsAppPhone(d.phone)})}
  if(kind==='vehicle'){if(!state.customers.length)return toast('سجّل عميلًا أولًا، أو استخدم «استلام سيارة».');title='إضافة سيارة';html=select('customerId','العميل',state.customers.map(c=>[c.id,c.name]))+field('model','الشركة والموديل وسنة الصنع')+field('plate','رقم اللوحة والإمارة');submit=(s,d)=>{if(s.vehicles.some(v=>v.plate.trim().toLowerCase()===d.plate.trim().toLowerCase()))throw Error('اللوحة مسجلة مسبقًا');s.vehicles.push({id:id(),customerId:d.customerId,model:d.model.trim(),plate:d.plate.trim()})}}
  if(kind==='part'){title='قطعة غيار جديدة';html=field('name','اسم القطعة / Part name')+field('stock','الكمية','number','0')+field('cost','تكلفة الشراء للوحدة','number')+field('price','سعر البيع للوحدة','number');submit=(s,d)=>{if(!Number.isInteger(Number(d.stock)))throw Error('الكمية يجب أن تكون عددًا صحيحًا');s.parts.push({id:id(),name:d.name.trim(),stock:amount(d.stock),cost:amount(d.cost),price:amount(d.price)})}}
  if(kind==='restock'){title='إضافة كمية للمخزون';html=field('qty','الكمية الجديدة','number','1');submit=(s,d)=>{if(!Number.isInteger(+d.qty)||+d.qty<1)throw Error('أدخل عددًا صحيحًا موجبًا');s.parts.find(p=>p.id===options.partId).stock+=+d.qty}}
  if(kind==='expense'){title='مصروف جديد';html=field('name','وصف المصروف')+field('amount','المبلغ بالدرهم','number');submit=(s,d)=>s.expenses.push({id:id(),name:d.name.trim(),amount:amount(d.amount)})}
  if(kind==='order'||kind==='quote'){if(!state.vehicles.length)return open('intake');title=kind==='quote'?'عرض سعر جديد':'فاتورة صيانة';html=select('vehicleId','السيارة والعميل',state.vehicles.map(v=>[v.id,`${v.plate} — ${customer(v)?.name}`]))+field('description','الخدمة / Service description')+charges();submit=(s,d)=>createOrder(s,{...d,kind:kind==='quote'?'quote':'invoice'})}
  if(kind==='edit'){
    const order=state.orders.find(o=>o.id===options.orderId);
    if(!order)return;
    if(order.paid)return toast('ألغِ تسجيل الدفع أولًا لتعديل الفاتورة.');
    title='تعديل الصيانة والتكلفة';html=field('description','الخدمة', 'text',order.description)+charges(order);
    submit=(s,d)=>updateOrder(s,order.id,d);
  }
  $('#dialog-title').textContent=title;$('#fields').innerHTML=html;$('#save-button').textContent=button;$('#form').afterSave=afterSave;
  if(kind==='edit')$('#fields [name="partId"]').value=state.orders.find(o=>o.id===options.orderId).partId;
  if(kind==='intake'){if(options.vehicleId)$('#fields [name="vehicleId"]').value=options.vehicleId;syncIntake()}
  $('#dialog').showModal();
}
function syncIntake(){
  const vehicleSelect=$('#fields [name="vehicleId"]'),newCar=$('#new-car-fields');if(!newCar)return;
  const existing=!!vehicleSelect.value;
  newCar.hidden=existing;
  newCar.querySelectorAll('input,select').forEach(input=>input.disabled=existing);
  if(!existing){const existingCustomer=!!$('#fields [name="customerId"]').value;$('#new-customer-fields').hidden=existingCustomer;$('#new-customer-fields').querySelectorAll('input').forEach(input=>input.disabled=existingCustomer)}
}
function openMessage(orderId,kind){
  const order=state.orders.find(o=>o.id===orderId);if(!order||order.kind!=='invoice')return;
  if(kind==='ready'&&!isReady(order))return toast('حدّد أن السيارة جاهزة أولًا.');
  const car=vehicle(order),owner=customer(car);
  $('#message-title').textContent=kind==='ready'?'إشعار جاهزية السيارة':'إشعار استلام السيارة';
  $('#message-customer').textContent=owner?.name||'العميل';$('#wa-phone').value=owner?.phone||'';
  $('#wa-text').value=serviceMessage({kind,customerName:owner?.name,model:car?.model,plate:car?.plate,orderNumber:order.number});
  updateMessageLink();$('#message-dialog').showModal();
}
function updateMessageLink(){
  const link=$('#wa-send');
  try{const text=$('#wa-text').value.trim();if(!text)throw Error('اكتب نص الرسالة.');link.href=buildWhatsAppUrl($('#wa-phone').value,text);link.removeAttribute('aria-disabled');$('#message-error').textContent=''}
  catch(error){link.removeAttribute('href');link.setAttribute('aria-disabled','true');$('#message-error').textContent=error.message}
}
$('#form').addEventListener('submit',event=>{
  event.preventDefault();try{
    const data=Object.fromEntries(new FormData(event.target));
    if(Object.values(data).some(value=>typeof value==='string'&&value!==''&&!value.trim()))throw Error('أدخل بيانات صحيحة');
    const next=structuredClone(state);submit(next,data);save(next);$('#dialog').close();toast('تم الحفظ');$('#form').afterSave?.();
  }catch(error){$('#error').textContent=error.message}
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
  if(button.dataset.paid)mutate(s=>{const order=s.orders.find(o=>o.id===button.dataset.paid);order.paid=!order.paid});
  if(button.dataset.status){
    const order=state.orders.find(o=>o.id===button.dataset.status),ready=!isReady(order);
    if(mutate(s=>{s.orders.find(o=>o.id===order.id).status=ready?'مكتمل':'قيد العمل'},ready?'السيارة جاهزة للتسليم':'أُعيد فتح الصيانة')&&ready)openMessage(order.id,'ready');
  }
  if(button.dataset.print)printOrder(button.dataset.print);
  if(button.id==='export'){
    const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const anchor=document.createElement('a');anchor.href=url;anchor.download='zakher-backup-'+new Date().toISOString().slice(0,10)+'.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  if(button.id==='clear'&&confirm('هل صدّرت نسخة؟ سيتم مسح جميع البيانات المحلية.'))mutate(s=>Object.assign(s,empty()));
});
document.addEventListener('input',event=>{
  if(event.target.id==='search'){const pos=event.target.selectionStart;query=event.target.value;render();$('#search').focus();if(typeof pos==='number')$('#search').setSelectionRange(pos,pos)}
  if(['wa-phone','wa-text'].includes(event.target.id))updateMessageLink();
});
document.addEventListener('change',async event=>{
  if(['vehicleId','customerId'].includes(event.target.name))syncIntake();
  if(event.target.id!=='import')return;
  const file=event.target.files[0];if(!file)return;
  try{if(file.size>5_000_000)throw Error('حجم الملف أكبر من المسموح');const next=validateBackup(JSON.parse(await file.text()));if(confirm('استبدال جميع البيانات الحالية بالنسخة المختارة؟')){save(next);toast('تمت استعادة النسخة')}}catch(error){toast('تعذّر الاستيراد: '+error.message)}
});
function printOrder(orderId){
  const order=state.orders.find(o=>o.id===orderId),car=vehicle(order),owner=customer(car);
  $('#print-area').innerHTML=`<div class="print-head"><div><h1>زاخر | ZAKHER</h1><p>لصيانة السيارات · Auto Maintenance</p></div><div><h2>${order.kind==='quote'?'عرض سعر / Quotation':'فاتورة تجريبية / Demo Invoice'}</h2><p dir="ltr">${esc(order.number)}<br>${new Date(order.date).toLocaleDateString('en-GB')}</p></div></div><p>العميل / Customer: ${esc(owner?.name)}<br>الهاتف / Phone: ${esc(owner?.phone)}<br>السيارة / Vehicle: ${esc(car?.model)}<br>اللوحة / Plate: ${esc(car?.plate)}</p>${table(['الوصف / Description','الكمية / Qty','المبلغ / Amount'],[`<tr><td>${esc(order.description)} — أجور العمل / Labor</td><td>1</td><td>${cash(order.labor)}</td></tr>`,...(order.qty?[`<tr><td>${esc(order.partName)}</td><td>${order.qty}</td><td>${cash(order.partPrice*order.qty)}</td></tr>`]:[])])}<div class="totals">المجموع / Subtotal: ${cash(order.subtotal)}<br>الضريبة التجريبية / Demo VAT 5%: ${cash(order.tax)}<br><b>الإجمالي / Total: ${cash(order.total)}</b></div><p>شكرًا لثقتكم / Thank you for your trust.<br>مستند تجريبي، غير معتمد ضريبيًا / Demo document, not a certified tax invoice.</p>`;
  window.print();
}
if($('#current-date'))$('#current-date').textContent=new Intl.DateTimeFormat('ar-AE',{weekday:'long',day:'numeric',month:'long',timeZone:'Asia/Dubai',calendar:'gregory'}).format(new Date());
render();
