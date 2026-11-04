const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const {mkdtemp,readFile,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');

const storageKey='zakher-garage-v1';
const baseURL=process.env.BASE_URL || 'http://127.0.0.1:3000';
// This is the pre-redesign storage shape: loading it must not reset user data.
const legacy={
  customers:[{id:'legacy-customer',name:'عميل محفوظ سابقًا',phone:'0501234567'}],
  vehicles:[{id:'legacy-car',customerId:'legacy-customer',model:'Legacy Toyota 2022',plate:'أبوظبي 12345'}],
  parts:[{id:'legacy-part',name:'فلتر محفوظ / Legacy filter',stock:5,cost:10,price:25}],
  orders:[{id:'legacy-order',number:'INV-1001',date:'2026-11-01T10:00:00.000Z',vehicleId:'legacy-car',description:'صيانة محفوظة قبل التحديث',kind:'invoice',status:'قيد العمل',paid:false,labor:100,qty:1,partId:'legacy-part',partName:'فلتر محفوظ / Legacy filter',partPrice:25,cost:10,subtotal:125,tax:6.25,total:131.25}],
  expenses:[{id:'legacy-expense',name:'مصروف محفوظ',amount:30}]
};

(async()=>{
  let browser,context,temp;
  try {
    temp=await mkdtemp(join(tmpdir(),'zakher-ui-'));
    browser=await (process.env.CDP_URL
      ?chromium.connectOverCDP(process.env.CDP_URL)
      :chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}));
    context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(({key,fixture})=>{
      if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(fixture));
    },{key:storageKey,fixture:legacy});
    let externalRequests=0,sendRequests=0;
    // Block external destinations and any send-style requests, even if a UI regresses.
    await context.route('**/*',route=>{
      const request=route.request(),url=request.url();
      if(!/^https?:/.test(url))return route.continue();
      if(new URL(url).origin!==new URL(baseURL).origin){externalRequests++;return route.abort()}
      if(!['GET','HEAD'].includes(request.method())){sendRequests++;return route.abort()}
      return route.continue();
    });
    const p=await context.newPage(),errors=[];
    p.on('pageerror',error=>errors.push(error.message));
    await p.goto(baseURL);
    await p.waitForSelector('h1');
    const data=()=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
    const nav=async target=>{
      if(['parts','finance','backup','notifications'].includes(target))await p.locator('#nav [data-page="more"]').click();
      await p.locator(`[data-page="${target}"]`).first().click();
    };
    const card=id=>p.locator('article.work-card').filter({has:p.locator(`[data-print="${id}"]`)});
    const expand=async id=>{
      const details=card(id).locator('details.order-details');
      if(!await details.evaluate(element=>element.open))await details.locator('summary').click();
    };
    const fillForm=async values=>{
      for(const [name,value] of Object.entries(values)){
        const input=p.locator(`#form [name="${name}"]`);
        if(await input.evaluate(element=>element.tagName)==='SELECT')await input.selectOption(value);
        else await input.fill(value);
      }
    };
    const saveForm=async()=>{
      await p.locator('#form button[type="submit"]').click();
      await p.waitForFunction(()=>!document.querySelector('#dialog').open);
    };
    const assertVehiclePreview=async()=>{
      const model=p.locator('#form [name="model"]'),preview=p.locator('#vehicle-preview');
      await model.fill('Toyota Land Cruiser 2022');
      assert((await preview.locator('img').getAttribute('src')).endsWith('/suv-large.svg'));
      assert((await preview.locator('b').textContent()).includes('Toyota Land Cruiser'));
      await p.waitForFunction(()=>{const image=document.querySelector('#vehicle-preview img');return image?.complete&&image.naturalWidth>0});
      const suvSource=await preview.locator('img').getAttribute('src');
      await model.fill('Toyota Camry 2024');
      assert((await preview.locator('img').getAttribute('src')).endsWith('/sedan-camry.svg'));
      assert.notEqual(await preview.locator('img').getAttribute('src'),suvSource,'Changing model changes the visible vehicle illustration');
      assert((await preview.locator('b').textContent()).includes('Toyota Camry'));
      await p.waitForFunction(()=>{const image=document.querySelector('#vehicle-preview img');return image?.complete&&image.naturalWidth>0});
    };
    const add=async(kind,values)=>{
      await p.locator(`[data-add="${kind}"]`).first().click();
      if(['intake','vehicle'].includes(kind)&&values.model)await assertVehiclePreview();
      if(['labor','partId','qty'].some(name=>Object.hasOwn(values,name))&&await p.locator('#form details.form-advanced').count()){
        await p.locator('#form details.form-advanced > summary').click();
      }
      await fillForm(values);await saveForm();
    };
    const edit=async(id,values)=>{
      await expand(id);await card(id).locator(`[data-edit="${id}"]`).click();
      await fillForm(values);await saveForm();
    };
    const closeMessage=()=>p.locator('#message-close').click();
    const noOverflow=async label=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow: ${label}`);

    assert.deepEqual(await data(),legacy,'Legacy customer/car/order/stock must survive initial load');
    await p.reload();await p.waitForSelector('h1');
    assert.deepEqual(await data(),legacy,'Reload must retain the existing storage key and data');
    assert.equal(await p.locator('#nav button').count(),4,'Primary navigation stays compact');

    // Previewing/editing a receipt must not change an order or claim delivery.
    assert.equal(await card('legacy-order').locator('[data-message="ready"]').count(),0);
    await card('legacy-order').locator('[data-message="received"]').click();
    assert.equal(await p.locator('#message-customer').textContent(),'عميل محفوظ سابقًا');
    assert.equal(await p.locator('#wa-phone').inputValue(),'0501234567');
    assert.equal(await p.locator('#message-language').inputValue(),'ar');
    assert.equal(await p.locator('#wa-text').getAttribute('dir'),'rtl');
    const receipt=await p.locator('#wa-text').inputValue();
    assert(receipt.includes('👋'));assert(receipt.includes('🧾'));assert(receipt.includes('\n\n'));
    for(const text of ['تم استلام سيارتك','Legacy Toyota 2022','أبوظبي 12345','INV-1001'])assert(receipt.includes(text));
    let link=new URL(await p.locator('#wa-send').getAttribute('href'));
    assert.equal(link.pathname,'/971501234567');assert.equal(link.searchParams.get('text'),receipt);
    assert.equal(await p.locator('#wa-send').textContent(),'فتح واتساب للإرسال');
    assert((await p.locator('#message-dialog').textContent()).includes('اضغط إرسال داخل واتساب'));
    assert(!(await p.locator('#message-dialog').textContent()).includes('تم إرسال'));
    await p.locator('#wa-phone').fill('bad phone');
    assert.equal(await p.locator('#wa-send').getAttribute('href'),null);
    assert.equal(await p.locator('#wa-send').getAttribute('aria-disabled'),'true');
    assert((await p.locator('#message-error').textContent()).includes('أدخل رقم واتساب'));
    await p.locator('#wa-phone').fill('+44 7700 900123');
    const edited='مرحبًا أحمد & خالد\nتم الاستلام / Test?';
    await p.locator('#wa-text').fill(edited);
    link=new URL(await p.locator('#wa-send').getAttribute('href'));
    assert.equal(link.pathname,'/447700900123');assert.equal(link.searchParams.get('text'),edited);
    assert.equal([...link.searchParams].length,1,'Message ampersands cannot create extra query parameters');
    // Switching languages keeps each edited draft, updates direction and never mutates order data.
    await p.locator('#message-language').selectOption('en');
    assert.equal(await p.locator('#wa-text').getAttribute('dir'),'ltr');
    const englishReceipt=await p.locator('#wa-text').inputValue();
    for(const text of ['Zakher Garage',"We've received your vehicle",'Plate: أبوظبي 12345','Service order: INV-1001','👋'])assert(englishReceipt.includes(text));
    const englishDraft='Hello & welcome 👋\nYour vehicle is with Zakher Garage.';
    await p.locator('#wa-text').fill(englishDraft);
    await p.locator('#message-language').selectOption('ar');
    assert.equal(await p.locator('#wa-text').inputValue(),edited);assert.equal(await p.locator('#wa-text').getAttribute('dir'),'rtl');
    await p.locator('#message-language').selectOption('en');assert.equal(await p.locator('#wa-text').inputValue(),englishDraft);
    link=new URL(await p.locator('#wa-send').getAttribute('href'));assert.equal(link.searchParams.get('text'),englishDraft);
    await p.locator('#message-language').selectOption('ar');assert.equal(await p.locator('#wa-text').inputValue(),edited);
    await p.locator('#wa-text').fill('   ');assert.equal(await p.locator('#wa-send').getAttribute('href'),null);
    await closeMessage();assert.deepEqual(await data(),legacy,'Preview edits must not mutate saved contact/order data');

    // Marking ready changes status first, then prepares a user-confirmed message.
    await card('legacy-order').locator('[data-status="legacy-order"]').click();
    await p.waitForSelector('#message-dialog[open]');
    let saved=await data();assert.equal(saved.orders[0].status,'مكتمل');assert.equal(saved.orders[0].paid,false);
    assert.equal(await p.locator('#wa-phone').inputValue(),'0501234567','Preview-only phone edits are not saved to the customer');
    const ready=await p.locator('#wa-text').inputValue();
    assert(ready.includes('جاهزة للاستلام'));assert(!ready.includes('تم تسليم'));assert(!ready.includes('مدفوعة'));
    await closeMessage();await p.locator('[data-filter="ready"]').click();
    assert.equal(await card('legacy-order').count(),1);
    await expand('legacy-order');await card('legacy-order').locator('[data-status="legacy-order"]').click();
    assert.equal(await p.locator('#message-dialog').evaluate(element=>element.open),false,'Reopening repair must not open a ready notification');
    assert.equal((await data()).orders[0].status,'قيد العمل');
    await p.locator('[data-filter="active"]').click();

    // One form creates a new customer, car and maintenance order without finances.
    await add('intake',{name:'عميل استلام جديد',phone:'٠٥٠١١١٢٢٣٣',model:'Intake Car 2026',plate:'TEST 100',description:'فحص أولي / Initial inspection',messageLanguage:'en'});
    saved=await data();assert.equal(saved.customers.length,2);assert.equal(saved.vehicles.length,2);assert.equal(saved.orders.length,2);
    const cid=saved.customers.at(-1).id,vid=saved.vehicles.at(-1).id,intakeId=saved.orders.at(-1).id;
    assert.equal(saved.customers.at(-1).phone,'+971501112233');assert.equal(saved.orders.at(-1).total,0);
    assert.equal(saved.orders.at(-1).messageLanguage,'en');
    assert.equal(saved.orders.at(-1).vehicleId,vid);assert.equal(saved.vehicles.at(-1).customerId,cid);
    await card(intakeId).locator('[data-message="received"]').click();
    assert.equal(new URL(await p.locator('#wa-send').getAttribute('href')).pathname,'/971501112233');
    assert.equal(await p.locator('#message-language').inputValue(),'en');assert.equal(await p.locator('#wa-text').getAttribute('dir'),'ltr');
    assert((await p.locator('#wa-text').inputValue()).includes("We've received your vehicle"));await closeMessage();

    // A new car can belong to an existing customer, without duplicate contacts.
    await add('intake',{customerId:'legacy-customer',model:'Another Car',plate:'TEST 200',description:'فحص سيارة ثانية'});
    saved=await data();assert.equal(saved.customers.length,2);assert.equal(saved.vehicles.length,3);
    assert.equal(saved.vehicles.at(-1).customerId,'legacy-customer');
    // A returning car creates only a new order; no duplicate customer/car.
    await add('intake',{vehicleId:vid,description:'زيارة متابعة'});
    saved=await data();assert.equal(saved.customers.length,2);assert.equal(saved.vehicles.length,3);assert.equal(saved.orders.length,4);
    assert.equal(saved.orders.at(-1).vehicleId,vid);
    // Optional intake charges can be entered later, then changed without a new order.
    await edit(intakeId,{labor:'80',partId:'legacy-part',qty:'1'});
    saved=await data();let editedOrder=saved.orders.find(order=>order.id===intakeId);
    assert.equal(editedOrder.total,110.25);assert.equal(editedOrder.cost,10);
    assert.equal(saved.parts[0].stock,4);assert.equal(saved.orders.length,4);
    await edit(intakeId,{labor:'0',partId:'',qty:'0'});
    saved=await data();editedOrder=saved.orders.find(order=>order.id===intakeId);
    assert.equal(editedOrder.total,0);assert.equal(editedOrder.cost,0);
    assert.equal(saved.parts[0].stock,5,'Removing a billed part restores its stock');
    await nav('customers');
    assert((await p.locator('#content').textContent()).includes('عميل استلام جديد'));
    const returning=p.locator(`[data-add="intake"][data-vehicle="${vid}"]`);
    await returning.click();assert.equal(await p.locator('#form [name="vehicleId"]').inputValue(),vid);
    assert(await p.locator('#form [name="name"]').isDisabled());await p.locator('#close').click();
    await p.locator('[data-add="vehicle"]').first().click();await assertVehiclePreview();await p.locator('#close').click();

    await nav('parts');await add('part',{name:'Test part',stock:'3',cost:'10',price:'25'});
    const pid=(await data()).parts.at(-1).id;
    await nav('orders');await add('order',{vehicleId:vid,description:'اختبار / Repair',labor:'100',partId:pid,qty:'2'});
    saved=await data();const oid=saved.orders.at(-1).id;
    assert.equal(saved.parts.at(-1).stock,1);assert.equal(saved.orders.at(-1).total,157.5);assert.equal(saved.orders.at(-1).cost,20);
    assert.equal(saved.parts[0].stock,5,'Loading/redesign must not deduct historic stock again');
    // Edit pre-fills existing charges. Failed stock validation keeps persisted data intact.
    await expand(oid);await card(oid).locator(`[data-edit="${oid}"]`).click();
    assert.equal(await p.locator('#form [name="labor"]').inputValue(),'100');
    assert.equal(await p.locator('#form [name="partId"]').inputValue(),pid);
    assert.equal(await p.locator('#form [name="qty"]').inputValue(),'2');
    const beforeInvalidEdit=await data();await fillForm({qty:'100'});
    await p.locator('#form button[type="submit"]').click();
    assert(await p.locator('#dialog').evaluate(element=>element.open));
    assert((await p.locator('#error').textContent()).includes('متوفرة'));
    assert.deepEqual(await data(),beforeInvalidEdit,'Failed edit cannot partially update stock or invoice');
    await fillForm({labor:'120',qty:'1'});await saveForm();
    saved=await data();editedOrder=saved.orders.find(order=>order.id===oid);
    assert.equal(saved.parts.at(-1).stock,2);assert.equal(editedOrder.total,152.25);assert.equal(editedOrder.cost,10);
    await edit(oid,{labor:'100',qty:'2'});
    saved=await data();editedOrder=saved.orders.find(order=>order.id===oid);
    assert.equal(saved.parts.at(-1).stock,1);assert.equal(editedOrder.total,157.5);assert.equal(editedOrder.cost,20);
    await expand(oid);await card(oid).locator(`[data-paid="${oid}"]`).click();
    assert.equal(await card(oid).locator('[data-edit]').count(),0,'Paid invoices must not offer editing');
    await card(oid).locator(`[data-status="${oid}"]`).click();
    await p.waitForSelector('#message-dialog[open]');
    assert((await p.locator('#wa-text').inputValue()).includes('جاهزة للاستلام'));await closeMessage();
    await add('quote',{vehicleId:vid,description:'Quote',labor:'10',partId:pid,qty:'5'});
    await p.reload();await p.waitForSelector('h1');
    saved=await data();assert.equal(saved.parts.at(-1).stock,1);
    assert(saved.orders.find(order=>order.id===oid).paid);assert.equal(saved.orders.find(order=>order.id===oid).status,'مكتمل');
    assert.equal(saved.orders.find(order=>order.id===oid).cost,20);
    assert.equal(saved.orders.find(order=>order.id===intakeId).messageLanguage,'en','Intake language survives reload');

    await nav('finance');await add('expense',{name:'Test expense',amount:'20'});
    assert((await p.locator('.stat').nth(0).textContent()).includes('275.00'));
    assert((await p.locator('.stat').nth(3).textContent()).includes('195.00'),'Profit excludes quote and VAT, includes costs and expenses');
    await nav('orders');await expand(oid);
    await p.evaluate(()=>window.print=()=>{window.__zakherPrintCalls=(window.__zakherPrintCalls||0)+1});
    await card(oid).locator(`[data-print="${oid}"]`).click();
    assert.equal(await p.evaluate(()=>window.__zakherPrintCalls),1);
    assert((await p.locator('#print-area').textContent()).includes('157.50'));
    assert((await p.locator('#print-area').textContent()).includes('Demo Invoice'));

    // Export, change data, then import: verify restoration rather than a toast only.
    await nav('backup');const beforeBackup=await data();
    const downloadPromise=p.waitForEvent('download');await p.locator('#export').click();
    const download=await downloadPromise,backupPath=join(temp,'backup.json');await download.saveAs(backupPath);
    assert.deepEqual(JSON.parse(await readFile(backupPath,'utf8')),beforeBackup);
    await nav('finance');await add('expense',{name:'بعد النسخة',amount:'7'});
    assert.equal((await data()).expenses.length,beforeBackup.expenses.length+1);
    await nav('backup');let confirmations=0;
    p.once('dialog',async dialog=>{confirmations++;await dialog.accept()});
    await p.locator('#import').setInputFiles(backupPath);
    await p.waitForFunction(()=>document.querySelector('#toast').textContent==='تمت استعادة النسخة');
    assert.equal(confirmations,1);assert.deepEqual(await data(),beforeBackup);

    // Preferences are separate from garage records; preview automation is not sending automation.
    const beforePreferences=await data();await nav('notifications');
    assert(await p.locator('#auto-whatsapp-toggle').isDisabled());
    assert.equal(await p.locator('#auto-whatsapp-toggle').isChecked(),false);
    assert((await p.locator('#auto-whatsapp-status').textContent()).includes('لا يتم إرسال أي رسالة تلقائيًا'));
    assert((await p.locator('#content').textContent()).includes('غير متصل'));
    await p.locator('#default-message-language').selectOption('en');await p.locator('#receipt-preview-default').check();
    assert.deepEqual(await data(),beforePreferences,'Changing preferences must not modify garage data');
    await p.reload();await p.waitForSelector('h1');await nav('notifications');
    assert.equal(await p.locator('#default-message-language').inputValue(),'en');
    assert(await p.locator('#receipt-preview-default').isChecked());
    assert.deepEqual(await data(),beforePreferences,'Preferences survive reload independently of garage data');
    await nav('dashboard');await card('legacy-order').locator('[data-message="received"]').click();
    assert.equal(await p.locator('#message-language').inputValue(),'en','Legacy orders without language use the saved default');
    assert((await p.locator('#wa-text').inputValue()).includes("We've received your vehicle"));
    await closeMessage();assert(!Object.hasOwn((await data()).orders[0],'messageLanguage'));
    await p.locator('[data-add="intake"]').first().click();
    assert.equal(await p.locator('#form [name="messageLanguage"]').inputValue(),'en');
    assert(await p.locator('#form [name="previewReceipt"]').isChecked());
    await fillForm({vehicleId:vid,description:'English default receipt preview'});await saveForm();
    await p.waitForSelector('#message-dialog[open]');
    saved=await data();const automaticPreviewOrder=saved.orders.at(-1);
    assert.equal(automaticPreviewOrder.messageLanguage,'en');assert.equal(automaticPreviewOrder.vehicleId,vid);
    assert.equal(await p.locator('#message-language').inputValue(),'en');
    assert.equal(await p.locator('#wa-text').getAttribute('dir'),'ltr');
    assert((await p.locator('#wa-text').inputValue()).includes("We've received your vehicle"));
    assert.equal(externalRequests,0);assert.equal(sendRequests,0);await closeMessage();
    await card(automaticPreviewOrder.id).locator(`[data-status="${automaticPreviewOrder.id}"]`).click();
    await p.waitForSelector('#message-dialog[open]');
    assert.equal(await p.locator('#message-language').inputValue(),'en');
    assert((await p.locator('#wa-text').inputValue()).includes('ready for collection'));await closeMessage();
    // The operator can suppress the preview for one intake even when the default is enabled.
    await p.locator('[data-add="intake"]').first().click();await p.locator('#form [name="previewReceipt"]').uncheck();
    await fillForm({vehicleId:vid,description:'Intake without a preview'});await saveForm();
    assert.equal(await p.locator('#message-dialog').evaluate(element=>element.open),false);

    await p.setViewportSize({width:390,height:844});await nav('dashboard');await noOverflow('workshop at 390px');
    await p.screenshot({path:'/tmp/zakher-mobile.png',fullPage:true});
    await card(intakeId).locator('[data-message="received"]').click();await noOverflow('WhatsApp preview at 390px');
    assert(await p.locator('#wa-send').isVisible());await closeMessage();
    for(const target of ['customers','orders','more','finance','parts','backup','notifications']){await nav(target);await noOverflow(target+' at 390px')}
    await p.setViewportSize({width:1440,height:1000});await nav('dashboard');
    await p.screenshot({path:'/tmp/zakher-desktop.png',fullPage:true});
    assert.equal(externalRequests,0,'Tests must never open external destinations, including WhatsApp');
    assert.equal(sendRequests,0,'Static demo must not attempt backend sends');
    assert.equal(context.pages().length,1,'No WhatsApp popup should be opened');
    assert.deepEqual(errors,[],'No JavaScript errors');
    console.log('PASS: legacy-data preservation; new/existing/returning intake; bilingual emoji templates, edited drafts, preferences and optional auto-receipt preview; dynamic car art; receipt/ready previews and phone validation; no WhatsApp sends; invoice editing/atomic stock validation/paid edit protection; inventory/VAT/cost/payment; quote; profit; bilingual print; export/change/import; 390px pages/dialog; no JS errors');
  } finally {
    await context?.close();await browser?.close();if(temp)await rm(temp,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1});
