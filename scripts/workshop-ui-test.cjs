const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');

const baseURL=process.env.BASE_URL || 'http://127.0.0.1:3000';
const storageKey='zakher-garage-v1';
// Public sample VINs and wholly synthetic workshop data; never customer data.
const sampleVin='1M8GDM9AXKP042788',otherSampleVin='1HGCM82633A004352';
const legacy={
  customers:[{id:'legacy-customer',name:'Legacy Customer',phone:'0501234567'}],
  vehicles:[{id:'legacy-car',customerId:'legacy-customer',model:'Nissan Altima 2022',plate:'TEST 12345'}],
  parts:[{id:'legacy-part',name:'فلتر زيت / Oil filter',stock:5,cost:10,price:25}],
  orders:[
    {id:'legacy-order',number:'INV-1001',date:'2026-11-01T10:00:00.000Z',vehicleId:'legacy-car',description:'صيانة محفوظة',kind:'invoice',status:'قيد العمل',paid:false,labor:100,qty:1,partId:'legacy-part',partName:'فلتر زيت / Oil filter',partPrice:25,cost:10,subtotal:125,tax:6.25,total:131.25},
    {id:'legacy-quote',number:'Q-1002',date:'2026-11-01T11:00:00.000Z',vehicleId:'legacy-car',description:'عرض محفوظ',kind:'quote',status:'عرض سعر',paid:false,labor:50,qty:0,partId:'',partName:'',partPrice:0,cost:0,subtotal:50,tax:2.5,total:52.5},
  ],
  expenses:[{id:'legacy-expense',name:'Legacy expense',amount:30}],
};
const mockedVpic={Count:1,Results:[{
  VIN:sampleVin,Make:'MCI',Model:'MC-9',ModelYear:'1989',DisplacementL:'9',
  EngineCylinders:'6',FuelTypePrimary:'Diesel',ErrorCode:'0',ErrorText:'',
}]};
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}};

(async()=>{
  let browser,context,lookupGate;
  try {
    browser=await (process.env.CDP_URL
      ?chromium.connectOverCDP(process.env.CDP_URL)
      :chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}));
    context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(({key,fixture})=>{
      if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(fixture));
    },{key:storageKey,fixture:legacy});
    let externalRequests=0,sendRequests=0,mockedLookups=0;
    // Fulfil only this public sample lookup locally. Never contact vPIC or WhatsApp.
    await context.route('**/*',async route=>{
      const request=route.request(),raw=request.url();
      if(!/^https?:/.test(raw))return route.continue();
      const url=new URL(raw);
      if(url.origin==='https://vpic.nhtsa.dot.gov'&&
        url.pathname===`/api/vehicles/DecodeVinValuesExtended/${sampleVin}`&&request.method()==='GET'){
        mockedLookups++;
        if(lookupGate){const gate=lookupGate;lookupGate=null;gate.seen.resolve();await gate.release.promise}
        return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(mockedVpic)});
      }
      if(url.origin!==new URL(baseURL).origin){externalRequests++;return route.abort()}
      if(!['GET','HEAD'].includes(request.method())){sendRequests++;return route.abort()}
      return route.continue();
    });
    const page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(baseURL);await page.locator('h1').waitFor();
    const data=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),storageKey);
    const card=id=>page.locator('article.work-card').filter({has:page.locator(`[data-print="${id}"]`)});
    const closeWorkshop=async()=>{
      if(await page.locator('#workshop-dialog').evaluate(element=>element.open))await page.locator('[data-workshop-close]').click();
    };
    const nav=async target=>{
      await closeWorkshop();
      if(['parts','finance','backup','notifications'].includes(target))await page.locator('#nav [data-page="more"]').click();
      await page.locator(`#nav [data-page="${target}"],#content [data-page="${target}"]`).first().click();
    };
    const suppliersPage=async()=>{await nav('more');await page.locator('[data-workshop-suppliers]').click();await page.locator('#workshop-dialog[open]').waitFor()};
    const fillSupplier=async({name,phone,brands,active=true,notes=''})=>{
      await page.locator('#supplier-form [name="name"]').fill(name);
      await page.locator('#supplier-form [name="phone"]').fill(phone);
      for(const input of await page.locator('#supplier-form [name="brands"]').all())await input.setChecked(brands.includes(await input.getAttribute('value')));
      await page.locator('#supplier-form [name="active"]').setChecked(active);
      await page.locator('#supplier-form [name="notes"]').fill(notes);
    };
    const saveSupplier=async()=>{
      await page.locator('#supplier-form button[type="submit"]').click();
      await page.waitForFunction(()=>!document.querySelector('#supplier-form'));
    };
    const addSupplier=async values=>{
      await page.locator('[data-workshop-new-supplier]').click();await fillSupplier(values);await saveSupplier();
      return (await data()).suppliers.at(-1).id;
    };
    const expand=async id=>{
      const details=card(id).locator('details.order-details');
      if(!await details.evaluate(element=>element.open))await details.locator('summary').click();
    };
    const openParts=async()=>{
      await nav('dashboard');await expand('legacy-order');
      await card('legacy-order').locator('[data-procurement="legacy-order"]').click();
      await page.locator('#parts-request-form').waitFor();
    };
    const vinScope=()=>page.locator('#parts-request-form [data-vin-scope]');
    const expandVin=async()=>{if(!await vinScope().evaluate(element=>element.open))await vinScope().locator('summary').click()};
    const assertNoOverflow=async label=>{
      const bounds=await page.evaluate(()=>({viewport:innerWidth,root:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(element=>{
        const rect=element.getBoundingClientRect();return {id:element.id,x:rect.x,right:rect.right,scroll:element.scrollWidth,client:element.clientWidth};
      })}));
      assert(bounds.root<=bounds.viewport,`${label}: root horizontal overflow`);
      for(const dialog of bounds.dialogs){assert(dialog.x>=-.5&&dialog.right<=bounds.viewport+.5,`${label}: dialog outside viewport`);assert(dialog.scroll<=dialog.client,`${label}: inner dialog overflow`)}
    };
    const assertAiUnavailable=async()=>{
      const button=page.locator('#parts-request-form button[disabled]').filter({hasText:/AI|الذكاء الاصطناعي/});
      assert.equal(await button.count(),1);assert(await button.isDisabled());
      assert(/غير متصل|not connected/i.test(await button.textContent()));
      const status=await page.locator('#parts-translation-status').textContent();
      assert(/ليس ترجمة AI|ليست AI|not AI/i.test(status),'Dictionary must never be presented as AI');
    };

    // New optional features must not reset or rewrite pre-existing records.
    assert.deepEqual(await data(),legacy);
    await page.reload();await page.locator('h1').waitFor();assert.deepEqual(await data(),legacy);
    await suppliersPage();await page.locator('[data-workshop-new-supplier]').click();
    await fillSupplier({name:'No-brand supplier',phone:'0501110001',brands:[]});
    await page.locator('#supplier-form button[type="submit"]').click();
    assert((await page.locator('#workshop-error').textContent()).includes('اختر ماركة'));
    assert.equal((await data()).suppliers,undefined,'Invalid supplier cannot persist a partial record');
    await fillSupplier({name:'Nissan Shop',phone:'0501110001',brands:['nissan']});await saveSupplier();
    const nissanId=(await data()).suppliers[0].id;
    const toyotaId=await addSupplier({name:'Toyota Shop',phone:'0502220001',brands:['toyota']});
    const generalId=await addSupplier({name:'General Parts',phone:'0502220002',brands:['*']});
    const inactiveId=await addSupplier({name:'Inactive Nissan',phone:'0502220003',brands:['nissan'],active:false});
    const disposableId=await addSupplier({name:'Temporary Supplier',phone:'0502220004',brands:['toyota']});
    await page.locator(`[data-workshop-edit-supplier="${disposableId}"]`).click();
    await fillSupplier({name:'Edited Temporary Supplier',phone:'0502220005',brands:['toyota','nissan'],active:false,notes:'Edited note'});await saveSupplier();
    let saved=await data(),edited=saved.suppliers.find(supplier=>supplier.id===disposableId);
    assert.equal(edited.name,'Edited Temporary Supplier');assert.equal(edited.phone,'+971502220005');assert.equal(edited.active,false);assert.deepEqual(edited.brands,['nissan','toyota']);assert.equal(edited.notes,'Edited note');
    page.once('dialog',dialog=>dialog.accept());await page.locator(`[data-workshop-delete-supplier="${disposableId}"]`).click();
    await page.waitForFunction(id=>!document.querySelector(`[data-workshop-delete-supplier="${id}"]`),disposableId);
    assert(!(await data()).suppliers.some(supplier=>supplier.id===disposableId));
    await page.locator(`[data-workshop-edit-supplier="${nissanId}"]`).click();
    await fillSupplier({name:'Nissan Genuine Parts',phone:'0501110002',brands:['nissan'],notes:'Synthetic directory entry'});await saveSupplier();
    saved=await data();assert.deepEqual(saved.customers,legacy.customers);assert.deepEqual(saved.orders,legacy.orders);assert.deepEqual(saved.vehicles,legacy.vehicles);assert.deepEqual(saved.parts,legacy.parts);assert.deepEqual(saved.expenses,legacy.expenses);

    await openParts();
    let choices=await page.locator('#parts-supplier option').evaluateAll(options=>options.map(option=>option.value).filter(Boolean));
    assert.deepEqual(choices,[nissanId,generalId],'Only exact-make and general active suppliers are recommended');
    assert(!choices.includes(toyotaId)&&!choices.includes(inactiveId));
    await page.locator('#parts-request-form [name="model"]').fill('Toyota Camry');
    choices=await page.locator('#parts-supplier option').evaluateAll(options=>options.map(option=>option.value).filter(Boolean));
    assert.deepEqual(choices,[toyotaId,generalId],'Changing the make refreshes specialty matching');
    await page.locator('#parts-request-form [name="model"]').fill('Unknown Test Vehicle');
    choices=await page.locator('#parts-supplier option').evaluateAll(options=>options.map(option=>option.value).filter(Boolean));
    assert.deepEqual(choices,[generalId],'An unknown make must not invent a specialist match');
    await page.locator('#parts-request-form [name="model"]').fill('Nissan Altima 2022');
    await assertAiUnavailable();
    assert(/قاموس|common English part names/i.test(await page.locator('[data-workshop-dictionary]').textContent()));
    await page.locator('#parts-ar').fill('فلتر زيت\nفحمات فرامل عدد 2\nقطعة غير معروفة XYZ-123');
    await page.locator('[data-workshop-dictionary]').click();
    assert.equal(await page.locator('#parts-en').inputValue(),'Oil filter\nفحمات فرامل عدد 2\nقطعة غير معروفة XYZ-123');
    assert(/ليست AI|not AI/.test(await page.locator('#parts-translation-status').textContent()));
    const arParts='فلتر زيت عدد 2 — A&B-42\nفحمات فرامل طقم 1',enParts='Oil filter x2 — PN A&B-42\nBrake pads set x1';
    await page.locator('#parts-ar').fill(arParts);await page.locator('#parts-en').fill(enParts);
    await expandVin();await vinScope().locator('[name="vin"]').fill(sampleVin);
    await vinScope().locator('[name="year"]').fill('2022');await vinScope().locator('[name="engine"]').fill('2.5 L');await vinScope().locator('[name="fuel"]').fill('Petrol');
    await page.locator('#parts-request-form button[type="submit"]').click();
    await page.waitForFunction(vin=>JSON.parse(localStorage.getItem('zakher-garage-v1')).vehicles[0].vin===vin,sampleVin);
    saved=await data();assert.equal(saved.vehicles[0].year,2022);assert.equal(saved.vehicles[0].engine,'2.5 L');assert.equal(saved.vehicles[0].fuel,'Petrol');
    assert.equal(saved.orders[0].partsRequest.arText,arParts);assert.equal(saved.orders[0].partsRequest.enText,enParts);assert.equal(saved.orders[0].partsRequest.translationSource,'manual');
    assert.deepEqual(saved.parts,legacy.parts,'Saving a procurement enquiry does not consume inventory');
    assert.deepEqual(saved.orders.map(({partsRequest,...base})=>base),legacy.orders,'Procurement does not alter historic charges or maintenance status');
    await page.locator('#parts-supplier').selectOption(nissanId);await page.locator('#parts-message-language').selectOption('en');
    await page.locator('[data-workshop-prepare]').click();
    let message=await page.locator('#supplier-message').inputValue();
    for(const text of [sampleVin,'Oil filter x2','Brake pads set x1','A&B-42','INV-1001'])assert(message.includes(text));
    let link=new URL(await page.locator('#supplier-whatsapp').getAttribute('href'));
    assert.equal(link.origin,'https://wa.me');assert.equal(link.pathname,'/971501110002');assert.equal(link.searchParams.get('text'),message);assert.equal([...link.searchParams].length,1);
    const changedDraft='Edited parts enquiry & quote\nقطع غيار عدد 2 — A&B-42';
    await page.locator('#supplier-message').fill(changedDraft);link=new URL(await page.locator('#supplier-whatsapp').getAttribute('href'));
    assert.equal(link.searchParams.get('text'),changedDraft,'Edits to the prepared draft must update the actual WhatsApp link');assert.equal([...link.searchParams].length,1);
    await page.locator('#supplier-message').fill('   ');assert.equal(await page.locator('#supplier-whatsapp').getAttribute('href'),null);assert.equal(await page.locator('#supplier-whatsapp').getAttribute('aria-disabled'),'true');
    await page.locator('#supplier-message').fill(changedDraft);assert.equal(await page.locator('#supplier-whatsapp').getAttribute('aria-disabled'),null);
    await page.locator('#parts-message-language').selectOption('ar');assert.equal(await page.locator('#supplier-whatsapp').getAttribute('href'),null);
    await page.locator('[data-workshop-prepare]').click();message=await page.locator('#supplier-message').inputValue();for(const text of [sampleVin,...arParts.split('\n')])assert(message.includes(text));
    await closeWorkshop();await page.reload();await page.locator('h1').waitFor();
    const afterReload=await data();assert.equal(afterReload.vehicles[0].vin,sampleVin);assert.equal(afterReload.orders[0].partsRequest.enText,enParts);assert.equal(afterReload.suppliers.length,4);
    assert.deepEqual(afterReload.customers,legacy.customers);assert.deepEqual(afterReload.parts,legacy.parts);assert.deepEqual(afterReload.expenses,legacy.expenses);

    // Mock the official service: lookup is review-only until the user applies it.
    await openParts();await expandVin();const beforeLookup=await data();
    await vinScope().locator('[data-vin-lookup]').click();await vinScope().locator('[data-vin-apply]').waitFor();
    assert((await vinScope().locator('.vin-result').textContent()).includes('MCI'));
    assert.equal(await page.locator('#parts-request-form [name="model"]').inputValue(),'Nissan Altima 2022');assert.equal(await vinScope().locator('[name="year"]').inputValue(),'2022');assert.deepEqual(await data(),beforeLookup);
    await vinScope().locator('[data-vin-apply]').click();assert.equal(await page.locator('#parts-request-form [name="model"]').inputValue(),'MCI MC-9');assert.equal(await vinScope().locator('[name="year"]').inputValue(),'1989');assert((await vinScope().locator('[name="engine"]').inputValue()).includes('9 L'));assert.deepEqual(await data(),beforeLookup,'Applying decoded data only updates the unsaved form');
    await vinScope().locator('[name="vin"]').fill(otherSampleVin);assert.equal(await vinScope().locator('[data-vin-apply]').count(),0,'Changing VIN removes a stale decoded result');
    await page.locator('#parts-request-form [name="model"]').fill('Nissan Altima 2022');await vinScope().locator('[name="year"]').fill('2022');await vinScope().locator('[name="vin"]').fill(sampleVin);
    lookupGate={seen:deferred(),release:deferred()};const gate=lookupGate;
    await vinScope().locator('[data-vin-lookup]').click();await gate.seen.promise;
    await vinScope().locator('[name="vin"]').fill(otherSampleVin);gate.release.resolve();
    await page.waitForFunction(()=>!document.querySelector('#parts-request-form [data-vin-lookup]').disabled);
    assert.equal(await vinScope().locator('[data-vin-apply]').count(),0,'A late result for an old VIN cannot be applied');
    assert(/تغيّر رقم الشاصي|VIN changed/.test(await vinScope().locator('.vin-status').textContent()));
    assert.equal(await page.locator('#parts-request-form [name="model"]').inputValue(),'Nissan Altima 2022');assert.deepEqual(await data(),beforeLookup);
    await closeWorkshop();

    // Both supported UI directions cover new dialogs and the supplier checklist.
    for(const language of ['ar','en']){
      await page.locator('#ui-language').selectOption(language);
      assert.equal(await page.locator('html').getAttribute('lang'),language);assert.equal(await page.locator('html').getAttribute('dir'),language==='en'?'ltr':'rtl');
      for(const width of [390,320]){
        await page.setViewportSize({width,height:844});await suppliersPage();await assertNoOverflow(`Supplier directory ${language} ${width}`);
        if(language==='en')assert.equal(await page.locator('#workshop-title').textContent(),'Parts suppliers');
        await page.locator('[data-workshop-new-supplier]').click();await assertNoOverflow(`Supplier form ${language} ${width}`);
        assert.equal(await page.locator('#supplier-form [name="brands"][value="nissan"]').count(),1);assert.equal(await page.locator('#supplier-form [name="brands"][value="toyota"]').count(),1);assert.equal(await page.locator('#supplier-form [name="brands"][value="*"]').count(),1);
        if(language==='en')assert.equal((await page.locator('#supplier-form legend').textContent()).trim(),'Supported makes');
        await closeWorkshop();await openParts();await expandVin();await assertNoOverflow(`Parts/VIN form ${language} ${width}`);await assertAiUnavailable();
        if(language==='en'){
          assert.equal(await page.locator('#workshop-title').textContent(),'Workshop sheet and parts enquiry');
          for(const text of ['Vehicle make and model','Required parts','Suggested suppliers','Save workshop sheet'])assert((await page.locator('#parts-request-form').textContent()).includes(text));
          assert.equal(await page.locator('#parts-request-form').evaluate(element=>getComputedStyle(element).direction),'ltr');
        }
        await page.locator('#parts-supplier').selectOption(generalId);await page.locator('#parts-message-language').selectOption(language);await page.locator('[data-workshop-prepare]').click();await assertNoOverflow(`Supplier preview ${language} ${width}`);
        assert.equal(await page.locator('#supplier-message').getAttribute('dir'),language==='en'?'ltr':'rtl');
        await closeWorkshop();
      }
    }
    // Print-language choices must not translate or rewrite user-owned descriptions.
    await page.setViewportSize({width:1440,height:1000});await nav('orders');const beforePrinting=await data();
    await page.evaluate(()=>window.print=()=>{window.__zakherWorkshopPrints=(window.__zakherWorkshopPrints||0)+1});
    let printCount=0;
    for(const order of legacy.orders){await expand(order.id);for(const language of ['ar','en','both']){
      await card(order.id).locator('.document-language').selectOption(language);await card(order.id).locator(`[data-print="${order.id}"]`).click();printCount++;
      const print=page.locator('#print-area');assert.equal(await print.getAttribute('data-document-language'),language);assert.equal(await print.getAttribute('dir'),language==='en'?'ltr':'rtl');
      const text=await print.textContent();assert(text.includes(order.description),'Printing keeps the user-entered description when no English description exists');
      const title=await print.locator('h2').textContent(),ar=order.kind==='quote'?'عرض سعر':'فاتورة تجريبية',en=order.kind==='quote'?'Quotation':'Demo invoice';
      assert.equal(title,language==='ar'?ar:language==='en'?en:ar+' / '+en);
    }}
    assert.equal(await page.evaluate(()=>window.__zakherWorkshopPrints),printCount);assert.deepEqual(await data(),beforePrinting);

    // Optional VIN details also save through the ordinary single-step intake form.
    await nav('dashboard');await page.locator('[data-add="intake"]').click();await page.locator('#form [data-vin-scope]').waitFor();
    for(const [name,value] of Object.entries({name:'Synthetic VIN Intake',phone:'0503330001',model:'Honda Accord',plate:'TEST-VIN-2026',description:'Synthetic inspection'}))await page.locator(`#form [name="${name}"]`).fill(value);
    const intakeVin=page.locator('#form [data-vin-scope]');await intakeVin.locator('summary').click();
    for(const [name,value] of Object.entries({vin:otherSampleVin,year:'2003',engine:'2.4 L',fuel:'Gasoline'}))await intakeVin.locator(`[name="${name}"]`).fill(value);
    await assertNoOverflow('Intake with VIN details');await page.locator('#form button[type="submit"]').click();await page.waitForFunction(()=>!document.querySelector('#dialog').open);
    saved=await data();assert.equal(saved.vehicles.at(-1).vin,otherSampleVin);assert.equal(saved.vehicles.at(-1).year,2003);assert.equal(saved.vehicles.at(-1).engine,'2.4 L');assert.equal(saved.customers[0].id,legacy.customers[0].id);assert.equal(saved.orders[0].number,legacy.orders[0].number);assert.equal(saved.vehicles[0].vin,sampleVin);
    await page.reload();await page.locator('h1').waitFor();assert.deepEqual(await data(),saved);
    assert.equal(mockedLookups,2,'Only the two intercepted public-sample lookups were requested');
    assert.equal(externalRequests,0,'No unmocked external destination may be contacted');assert.equal(sendRequests,0,'No send-style requests');assert.equal(context.pages().length,1,'No supplier/WhatsApp popup');assert.deepEqual(errors,[]);
    console.log('PASS: legacy preservation; supplier create/edit/delete and validation; exact/general make recommendations; honest dictionary/unavailable AI; parts/VIN save/reload; encoded bilingual supplier drafts and edit synchronization; mock vPIC review/apply/stale protection; Arabic/English 390/320px supplier and VIN dialogs; localized invoice/quote printing; optional intake VIN; zero external sends or JS errors');
  } finally {
    lookupGate?.release.resolve();await context?.close();await browser?.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1});
