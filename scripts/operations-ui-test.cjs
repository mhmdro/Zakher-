const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const {mkdtemp,readFile,rm}=require('node:fs/promises');
const {tmpdir}=require('node:os');
const {join}=require('node:path');
const baseURL=process.env.BASE_URL || 'http://127.0.0.1:3000';
const key='zakher-garage-v1';
const empty={customers:[],vehicles:[],parts:[],orders:[],expenses:[]};
const fixture={
  customers:[{id:'customer',name:'عميل تجريبي',phone:'0501234567'}],
  vehicles:[{id:'car',customerId:'customer',model:'Nissan Altima',plate:'TEST 32198'}],
  parts:[{id:'part',name:'Oil filter',stock:5,cost:10,price:25}],
  orders:[{id:'invoice',number:'INV-1001',date:'2026-10-01T10:00:00.000Z',vehicleId:'car',description:'صيانة اختبارية',kind:'invoice',status:'قيد العمل',paid:false,labor:200,qty:1,partId:'part',partName:'Oil filter',partPrice:25,cost:10,subtotal:225,tax:11.25,total:236.25}],
  expenses:[{id:'expense',name:'Manual expense',amount:40}],
};
(async()=>{
  let browser,context,temp;
  try{
    temp=await mkdtemp(join(tmpdir(),'zakher-operations-'));
    browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
    context=await browser.newContext({viewport:{width:1440,height:1000}});
    await context.addInitScript(({key,empty})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,JSON.stringify(empty));window.print=()=>{window.testPrintCount=(window.testPrintCount||0)+1}},{key,empty});
    let external=0,send=0;
    await context.route('**/*',route=>{
      const request=route.request();if(!/^https?:/.test(request.url()))return route.continue();
      if(new URL(request.url()).origin!==new URL(baseURL).origin){external++;return route.abort()}
      if(!['GET','HEAD'].includes(request.method())){send++;return route.abort()}
      return route.continue();
    });
    const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.clock.setFixedTime(new Date('2026-11-04T09:00:00Z'));
    await p.goto(baseURL);await p.locator('h1').waitFor();
    const data=()=>p.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);
    const close=async()=>{if(await p.locator('#operations-dialog').evaluate(e=>e.open))await p.locator('[data-operations-close]').click()};
    const nav=async target=>{await close();if(['finance','backup'].includes(target))await p.locator('#nav [data-page="more"]').click();await p.locator(`[data-page="${target}"]`).first().click()};
    const card=id=>p.locator(`article.work-card[data-order-id="${id}"]`);
    const expand=async id=>{const d=card(id).locator('details.order-details');if(!await d.evaluate(e=>e.open))await d.locator('summary').click()};
    const fill=async(scope,values)=>{for(const [name,value] of Object.entries(values)){const input=p.locator(`${scope} [name="${name}"]`);if(await input.evaluate(e=>e.tagName)==='SELECT')await input.selectOption(value);else await input.fill(value)}};
    const submitMain=async()=>{await p.locator('#form button[type="submit"]').click();await p.waitForFunction(()=>!document.querySelector('#dialog').open)};
    const staff=async()=>{await nav('more');await p.locator('[data-operations-employees]').click()};
    const openPayments=async()=>{await nav('orders');await expand('invoice');await p.locator('[data-operations-payments="invoice"]').click()};
    const overflow=async label=>{
      const result=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,dialogs:[...document.querySelectorAll('dialog[open]')].map(e=>({x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,scroll:e.scrollWidth,client:e.clientWidth}))}));
      assert(result.scroll<=result.width,label+' page overflow');for(const d of result.dialogs){assert(d.x>=-.5&&d.right<=result.width+.5,label+' dialog bounds');assert(d.scroll<=d.client,label+' inner dialog overflow')}
    };

    // A quote is possible before the first customer or car has been registered.
    assert.deepEqual(await data(),empty);await nav('orders');await p.locator('[data-add="quote"]').click();
    assert.equal(await p.locator('#form [name="vehicleId"]').inputValue(),'');
    await fill('#form',{guestName:'ضيف & تجربة',guestPhone:'0507777777',guestModel:'نيسان التيما',guestPlate:'TEST 999',description:'فحص تجريبي',descriptionEn:'Sample inspection',labor:'100',documentLanguage:'both'});
    assert((await p.locator('#guest-vehicle-preview img').getAttribute('src')).endsWith('/nissan.svg'));
    await submitMain();let saved=await data();const quoteId=saved.orders[0].id;
    assert.equal(saved.customers.length,0);assert.equal(saved.vehicles.length,0);assert.equal(saved.orders[0].total,105);
    assert.equal(saved.orders[0].guest.customerName,'ضيف & تجربة');assert.equal(saved.orders[0].vehicleId,'');
    assert((await card(quoteId).textContent()).includes('ضيف & تجربة'));await expand(quoteId);
    assert.equal(await card(quoteId).locator('[data-procurement]').count(),0,'A guest quote must not try to edit a nonexistent registered vehicle');
    for(const language of ['ar','en','both']){
      await card(quoteId).locator('.document-language').selectOption(language);await card(quoteId).locator('[data-print]').click();
      const print=p.locator('#print-area');assert.equal(await print.getAttribute('data-document-language'),language);
      for(const text of ['ضيف & تجربة','TEST 999','نيسان التيما'])assert((await print.textContent()).includes(text));
      assert((await print.textContent()).includes(language==='en'?'Quotation':'عرض سعر'));
    }
    await card(quoteId).locator('[data-edit]').click();await fill('#form',{guestName:'ضيف بعد التعديل',guestModel:'Toyota Camry',guestPlate:'TEST 1000',labor:'150'});await submitMain();
    saved=await data();assert.equal(saved.orders[0].guest.customerName,'ضيف بعد التعديل');assert.equal(saved.orders[0].total,157.5);assert.equal(saved.customers.length,0);

    // Import synthetic registered data through the real backup flow, preserving the guest quote.
    const merged={...structuredClone(fixture),orders:[...fixture.orders,...saved.orders]};
    await nav('backup');p.once('dialog',d=>d.accept());await p.locator('#import').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(merged))});
    await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).customers.length===1,key);
    assert.deepEqual(await data(),merged);await nav('orders');await p.locator('[data-add="quote"]').click();await p.locator('#form [name="vehicleId"]').selectOption('car');
    assert(await p.locator('#guest-quote-fields').isHidden());assert(await p.locator('#form [name="guestName"]').isDisabled());await fill('#form',{description:'Registered quote',labor:'50'});await submitMain();
    assert.equal((await data()).orders.at(-1).vehicleId,'car');assert.equal((await data()).orders.at(-1).guest,undefined);assert.equal((await data()).parts[0].stock,5);

    // Partial payment, printable receipt balance, overpayment rejection and retained cancellation history.
    await openPayments();await fill('#customer-payment-form',{amount:'100',note:'Cash'});await p.locator('#customer-payment-form button[type="submit"]').click();
    saved=await data();assert.equal(saved.orders[0].payments[0].amount,100);assert.equal(saved.orders[0].paid,false);
    assert((await p.locator('#operations-dialog').textContent()).includes('136.25'));
    await p.locator('#customer-payment-form [name="amount"]').fill('200');await p.locator('#customer-payment-form button[type="submit"]').click();assert.deepEqual(await data(),saved);
    assert.equal(await p.locator('#customer-payment-form [name="amount"]').evaluate(e=>e.validity.rangeOverflow),true);
    await p.locator('#customer-payment-form [name="amount"]').fill('0');await p.locator('#customer-payment-form button[type="submit"]').click();assert.deepEqual(await data(),saved);assert.equal(await p.locator('#customer-payment-form [name="amount"]').evaluate(e=>e.validity.rangeUnderflow),true);
    await p.locator('[data-debt-message="invoice"]').click();let draft=await p.locator('#ops-debt-text').inputValue();for(const text of ['136.25','100.00','236.25','INV-1001'])assert(draft.includes(text));
    let link=new URL(await p.locator('#ops-debt-send').getAttribute('href'));assert.equal(link.pathname,'/971501234567');assert.equal(link.searchParams.get('text'),draft);
    await p.locator('#ops-debt-text').fill('تذكير معدل & 136.25');await p.locator('#ops-debt-language').selectOption('en');assert((await p.locator('#ops-debt-text').inputValue()).includes('Outstanding: AED 136.25'));assert.equal(await p.locator('#ops-debt-text').getAttribute('dir'),'ltr');
    await p.locator('#ops-debt-language').selectOption('ar');assert.equal(await p.locator('#ops-debt-text').inputValue(),'تذكير معدل & 136.25');
    await p.locator('#ops-debt-phone').fill('bad');assert.equal(await p.locator('#ops-debt-send').getAttribute('href'),null);
    await close();await expand('invoice');await card('invoice').locator('[data-print]').click();for(const text of ['136.25','100.00'])assert((await p.locator('#print-area').textContent()).includes(text));
    await openPayments();await p.locator('[data-pay-remaining]').click();saved=await data();assert.equal(saved.orders[0].paid,true);assert.equal(saved.orders[0].payments.length,2);
    const cancelled=saved.orders[0].payments[1].id;p.once('dialog',d=>d.accept());await p.locator(`[data-void-payment="${cancelled}"]`).click();
    saved=await data();assert.equal(saved.orders[0].paid,false);assert(saved.orders[0].payments[1].voidedAt);assert.equal(await p.locator('.ledger-entry.voided').count(),1);

    // Handover must never settle the invoice. The debt stays visible in invoices and reminders.
    await close();await expand('invoice');await p.locator('[data-operations-delivery="invoice"]').click();
    const beforeHandover=await data();await p.locator('#delivery-form button[type="submit"]').click();assert.deepEqual(await data(),beforeHandover);
    await p.locator('#delivery-form [name="acknowledge"]').check();await p.locator('#delivery-form button[type="submit"]').click();await p.waitForFunction(()=>!document.querySelector('#operations-dialog').open);
    saved=await data();assert.equal(saved.orders[0].delivery.balanceAtDelivery,136.25);assert.deepEqual(saved.orders[0].payments,beforeHandover.orders[0].payments);assert.equal(saved.parts[0].stock,5);
    assert((await card('invoice').textContent()).includes('سُلّمت للعميل'));await nav('dashboard');assert.equal(await card('invoice').count(),0);await p.locator('[data-filter="ready"]').click();assert.equal(await card('invoice').count(),0);await p.locator('[data-filter="all"]').click();assert.equal(await card('invoice').count(),1);
    await openPayments();await p.locator('#debt-interval').selectOption('14');await p.locator('[data-postpone-debt="invoice"]').click();assert.equal((await data()).orders[0].collectionReminder.nextDate,'2026-11-18');
    await close();await expand('invoice');p.once('dialog',d=>d.accept());await p.locator('[data-undo-delivery="invoice"]').click();assert.equal((await data()).orders[0].delivery,undefined);assert.deepEqual((await data()).orders[0].payments,saved.orders[0].payments);

    // Per-month payroll, documented deductions, salary snapshots and actual expenses.
    await staff();await p.locator('[data-employee-new]').click();
    await fill('#employee-form',{name:'عامل تجريبي',role:'Mechanic',salary:'3000',residencyExpiry:'2026-11-10',laborCardExpiry:'2026-11-03'});await p.locator('#employee-form button[type="submit"]').click();
    const employeeId=(await data()).employees[0].id;assert.equal(await p.locator('#payroll-month').inputValue(),'2026-11');
    await p.locator(`[data-payroll-open="${employeeId}"]`).click();await fill('#salary-entry-form',{type:'payment',amount:'1000',note:'First payment'});await p.locator('#salary-entry-form button[type="submit"]').click();
    await fill('#salary-entry-form',{type:'deduction',amount:'200',note:''});await p.locator('#salary-entry-form button[type="submit"]').click();assert((await p.locator('#operations-error').textContent()).includes('سبب الخصم'));assert.equal((await data()).payrolls[0].deductions.length,0);
    await fill('#salary-entry-form',{note:'غياب تجريبي'});await p.locator('#salary-entry-form button[type="submit"]').click();saved=await data();assert.equal(saved.payrolls[0].grossSalary,3000);assert.equal(saved.payrolls[0].deductions[0].amount,200);assert((await p.locator('.money-summary').textContent()).includes('1,800.00'));
    await nav('finance');assert((await p.locator('#content .stats').textContent()).includes('1,040.00'));assert((await p.locator('#content table').textContent()).includes('عامل تجريبي'));
    await staff();await p.locator(`[data-employee-edit="${employeeId}"]`).click();await fill('#employee-form',{salary:'4000'});await p.locator('#employee-form button[type="submit"]').click();
    assert((await p.locator('.employee-card .money-summary').textContent()).includes('3,000.00'),'Existing month keeps its snapshot');await p.locator('#payroll-month').fill('2026-12');assert((await p.locator('.employee-card .money-summary').textContent()).includes('4,000.00'));await p.locator('#payroll-month').fill('2026-11');
    await p.locator(`[data-payroll-open="${employeeId}"]`).click();const deduction=(await data()).payrolls[0].deductions[0].id;
    p.once('dialog',d=>d.accept());await p.locator(`[data-salary-void="${deduction}"]`).click();assert((await p.locator('.money-summary').textContent()).includes('2,000.00'));assert((await data()).payrolls[0].deductions[0].voidedAt);
    await fill('#salary-entry-form',{type:'deduction',amount:'200',note:'Corrected deduction'});await p.locator('#salary-entry-form button[type="submit"]').click();

    // Expired/near-expiry documents and repeated due-balance follow-up.
    await close();await p.locator('#operations-alert [data-operations-reminders]').click();assert.equal(await p.locator('.reminder-card').count(),2);assert.equal(await p.locator('.reminder-card .expired').count(),1);
    await p.locator('#document-reminder-days').selectOption('7');assert.equal(await p.locator('.reminder-card').count(),2);
    // Make the explicit two-week follow-up due by moving the browser clock forward.
    await p.clock.setFixedTime(new Date('2026-11-18T09:00:00Z'));await p.reload();await p.locator('h1').waitFor();await p.locator('#operations-alert [data-operations-reminders]').click();assert.equal(await p.locator('.reminder-card').count(),3);
    const debt=p.locator('.reminder-card').filter({has:p.locator('[data-snooze-reminder="invoice"]')});assert((await debt.textContent()).includes('136.25'));
    await p.locator('[data-snooze-reminder="invoice"]').click();assert.equal((await data()).orders[0].collectionReminder.nextDate,'2026-11-25');assert.equal(await p.locator('.reminder-card').count(),2);

    // Mobile Arabic and English screens/dialogs, with all values retained across reloads.
    for(const width of [390,320]){
      await p.setViewportSize({width,height:844});await overflow('Arabic reminders '+width);await staff();await overflow('Arabic staff '+width);
      await p.locator(`[data-payroll-open="${employeeId}"]`).click();await overflow('Arabic payroll '+width);await openPayments();await overflow('Arabic payment '+width);
      await close();await p.locator('#ui-language').selectOption('en');assert.equal(await p.locator('html').getAttribute('dir'),'ltr');await staff();assert((await p.locator('#operations-title').textContent()).includes('Staff and payroll'));await overflow('English staff '+width);
      await p.locator(`[data-payroll-open="${employeeId}"]`).click();await overflow('English payroll '+width);await openPayments();assert((await p.locator('#operations-title').textContent()).includes('Payments'));await overflow('English payment '+width);
      await close();await p.locator('#ui-language').selectOption('ar');
    }
    await p.setViewportSize({width:390,height:844});await staff();await p.screenshot({path:'/tmp/zakher-staff-mobile.png'});await close();await nav('orders');await expand('invoice');await p.screenshot({path:'/tmp/zakher-payments-mobile.png'});
    const beforeReload=await data();await p.reload();await p.locator('h1').waitFor();assert.deepEqual(await data(),beforeReload);
    // Export/import must retain guest snapshots, payment history, staff and payroll; clear must remove them.
    await nav('backup');const downloaded=p.waitForEvent('download');await p.locator('#export').click();const download=await downloaded,path=join(temp,'backup.json');await download.saveAs(path);assert.deepEqual(JSON.parse(await readFile(path,'utf8')),beforeReload);
    await p.locator('details.form-advanced > summary').click();p.once('dialog',d=>d.accept());await p.locator('#clear').click();assert.deepEqual(await data(),empty);
    p.once('dialog',d=>d.accept());await p.locator('#import').setInputFiles(path);await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)).employees?.length===1,key);assert.deepEqual(await data(),beforeReload);
    await openPayments();await p.locator('[data-pay-remaining]').click();assert.equal((await data()).orders[0].paid,true);await close();await p.locator('#operations-alert [data-operations-reminders]').click();assert.equal(await p.locator('[data-snooze-reminder="invoice"]').count(),0);
    assert.equal(external,0);assert.equal(send,0);assert.deepEqual(errors,[]);
    console.log('PASS: guest quote without registry/Arabic-English print/edit; registered quote; partial/full payments and cancellation audit; invoice balances; retained debt after handover/undo; due balance reminders/snooze/settlement; staff/payroll/deductions/month snapshots/expenses; residency/labor-card expiry; 390/320px Arabic-English screens; backup/clear/import/reload; no external sends or JS errors');
  }catch(error){console.error(error);process.exitCode=1}
  finally{if(context)await context.close();if(browser)await browser.close();if(temp)await rm(temp,{recursive:true,force:true})}
})();
