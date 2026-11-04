import {test} from 'node:test';
import assert from 'node:assert/strict';
import {empty,demo,createOrder,updateOrder,summary,validateBackup,buildWhatsAppUrl} from '../domain.js';
import {paymentSummary,paymentEntries,recordPayment,voidPayment,voidAllPayments,markDelivery,undoDelivery,isDelivered,postponeDebtReminder,saveEmployee,payrollSummary,recordSalaryItem,voidSalaryItem,salaryExpenses,getReminders,todayDubai,addDays,validDate,orderVehicle,orderCustomer,debtReminderMessage} from '../ledger.js';

test('a manual quotation needs no registered customer/car and never consumes inventory',()=>{
  const s=empty();s.parts.push({id:'p',name:'Filter',cost:10,price:20,stock:0});const before=structuredClone(s);
  const order=createOrder(s,{kind:'quote',guest:{customerName:'عميل جديد',vehicleModel:'Nissan Altima',plate:'32198 أبوظبي 4'},description:'فحص',descriptionEn:'Inspection',documentLanguage:'both',labor:100,partId:'p',qty:2});
  assert.equal(order.vehicleId,'');assert.equal(order.total,147);assert.equal(s.customers.length,0);assert.equal(s.vehicles.length,0);assert.deepEqual(s.parts,before.parts);
  assert.equal(orderVehicle(s,order).model,'Nissan Altima');assert.equal(orderCustomer(s,order).name,'عميل جديد');assert.equal(summary(s).revenue,0);assert.equal(summary(s).unpaid,0);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
  updateOrder(s,order.id,{guest:{customerName:'Edited',vehicleModel:'Toyota Camry',plate:'NEW'},labor:120});assert.equal(order.guest.customerName,'Edited');assert.equal(order.total,168);
});
test('invalid guest quotation inputs reject atomically and invoices still require registration',()=>{
  for(const override of [{kind:'invoice'},{vehicleId:'v1'},{guest:{customerName:' ',vehicleModel:'Nissan',plate:'X'}},{guest:{customerName:'A',vehicleModel:'',plate:'X'}},{guest:{customerName:'A',vehicleModel:'Nissan',plate:'X',phone:null}},{labor:-1}]){
    const s=demo(),before=structuredClone(s);assert.throws(()=>createOrder(s,{kind:'quote',guest:{customerName:'A',vehicleModel:'Nissan',plate:'X'},description:'Service',labor:100,...override}));assert.deepEqual(s,before);
  }
  const s=demo(),order=s.orders[0];assert.throws(()=>updateOrder(s,order.id,{guest:{customerName:'A',vehicleModel:'Toyota',plate:'X'}}));
});
test('partial payments use the remaining balance and keep a cancellable history',()=>{
  const s=demo(),order=s.orders[0];assert.deepEqual(paymentSummary(order),{received:0,remaining:236.25,isPaid:false});
  const first=recordPayment(s,order.id,{amount:'100',date:'2026-11-04',note:'Cash'});recordPayment(s,order.id,{amount:50,date:'2026-11-05'});
  assert.deepEqual(paymentSummary(order),{received:150,remaining:86.25,isPaid:false});assert.equal(summary(s).unpaid,86.25);assert.equal(summary(s).profit,160);
  const last=recordPayment(s,order.id,{amount:86.25});assert.equal(order.paid,true);assert.equal(summary(s).unpaid,0);
  voidPayment(s,order.id,last.id);assert.equal(order.paid,false);assert.equal(paymentSummary(order).remaining,86.25);assert(order.payments.at(-1).voidedAt);assert.equal(first.note,'Cash');
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
});
test('legacy paid flags remain unchanged until an explicit correction materializes their audit entry',()=>{
  const s=demo(),order=s.orders[0];order.paid=true;const before=structuredClone(s);
  assert.equal(paymentSummary(order).received,236.25);assert.deepEqual(s,before);assert.equal(paymentEntries(order)[0].date,'');
  voidAllPayments(s,order.id);assert.equal(order.paid,false);assert.equal(paymentSummary(order).remaining,236.25);assert(order.payments[0].legacy);assert(order.payments[0].voidedAt);assert.equal(order.payments[0].date,'');
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
});
test('overpayments, invalid dates and fractional cents cannot partially change an invoice',()=>{
  for(const change of [{amount:0},{amount:-1},{amount:999},{amount:1.001},{amount:NaN},{amount:Infinity},{amount:' '},{amount:true},{amount:1,date:'2026-02-30'}]){
    const s=demo(),before=structuredClone(s);assert.throws(()=>recordPayment(s,s.orders[0].id,change));assert.deepEqual(s,before);
  }
  const s=demo(),order=createOrder(s,{vehicleId:'v1',kind:'invoice',description:'Small',labor:1});for(const amount of [0.1,0.2,0.75])recordPayment(s,order.id,{amount});assert.deepEqual(paymentSummary(order),{received:1.05,remaining:0,isPaid:true});
});
test('a partly paid invoice may be repriced only above the money already collected',()=>{
  const s=demo(),order=s.orders[0];recordPayment(s,order.id,{amount:100});const before=structuredClone(s);
  assert.throws(()=>updateOrder(s,order.id,{labor:0,partId:'',qty:0}),/أقل من الدفعات/);assert.deepEqual(s,before);
  updateOrder(s,order.id,{labor:200});assert.equal(paymentSummary(order).received,100);assert.equal(paymentSummary(order).remaining,157.25);
  recordPayment(s,order.id,{amount:157.25});assert.throws(()=>updateOrder(s,order.id,{labor:300}),/ألغِ تسجيل الدفع/);
});
test('vehicle handover keeps the debt, payment ledger and inventory intact',()=>{
  const s=demo(),order=s.orders[0];recordPayment(s,order.id,{amount:100});const stock=structuredClone(s.parts),payments=structuredClone(order.payments);
  markDelivery(s,order.id);assert(isDelivered(order));assert.equal(order.status,'مكتمل');assert.equal(order.paid,false);assert.equal(order.delivery.balanceAtDelivery,136.25);assert.deepEqual(order.payments,payments);assert.deepEqual(s.parts,stock);
  const due=addDays(todayDubai(new Date(order.delivery.at)),7);assert(getReminders(s,{asOf:due}).some(entry=>entry.orderId===order.id&&entry.delivered&&entry.remaining===136.25));
  undoDelivery(s,order.id);assert(!isDelivered(order));assert.deepEqual(order.payments,payments);assert.equal(paymentSummary(order).remaining,136.25);
});
test('repeating debt reminders can be snoozed and disappear when fully paid',()=>{
  const s=demo(),order=s.orders[0];order.date='2026-10-01T12:00:00.000Z';assert.equal(getReminders(s,{asOf:'2026-11-04'}).length,1);
  postponeDebtReminder(s,order.id,14,'2026-11-04');assert.equal(order.collectionReminder.nextDate,'2026-11-18');assert.equal(getReminders(s,{asOf:'2026-11-17'}).length,0);
  recordPayment(s,order.id,{amount:100});assert.equal(getReminders(s,{asOf:'2026-11-18'})[0].remaining,136.25);
  recordPayment(s,order.id,{amount:136.25});assert.equal(getReminders(s,{asOf:'2026-12-01'}).length,0);
});
test('staff salary snapshots, deductions and payments stay independent between months',()=>{
  const s=demo(),employee=saveEmployee(s,{name:'Worker',salary:3000,residencyExpiry:'2026-12-01',laborCardExpiry:'2027-01-01'});
  assert(!s.payrolls);assert.equal(payrollSummary(s,employee.id,'2026-11').remaining,3000);assert(!s.payrolls);
  recordSalaryItem(s,employee.id,'2026-11','payment',{amount:1000,date:'2026-11-04'});recordSalaryItem(s,employee.id,'2026-11','deduction',{amount:200,note:'Recorded deduction'});
  let row=payrollSummary(s,employee.id,'2026-11');assert.deepEqual([row.gross,row.deductions,row.net,row.received,row.remaining],[3000,200,2800,1000,1800]);
  saveEmployee(s,{...employee,salary:4000},employee.id);assert.equal(payrollSummary(s,employee.id,'2026-11').gross,3000);assert.equal(payrollSummary(s,employee.id,'2026-12').gross,4000);
  assert.equal(salaryExpenses(s),1000);assert.equal(summary(s).expenses,1040);assert.equal(summary(s).profit,-840);
  const second=recordSalaryItem(s,employee.id,'2026-11','payment',{amount:1800});row=payrollSummary(s,employee.id,'2026-11');assert.equal(row.remaining,0);
  voidSalaryItem(s,row.payroll.id,'deduction',row.payroll.deductions[0].id);assert.equal(payrollSummary(s,employee.id,'2026-11').remaining,200);
  voidSalaryItem(s,row.payroll.id,'payment',second.id);assert.equal(payrollSummary(s,employee.id,'2026-11').remaining,2000);assert.equal(salaryExpenses(s),1000);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
});
test('invalid salary transactions reject without creating a month or changing prior payments',()=>{
  const s=demo(),employee=saveEmployee(s,{name:'Worker',salary:1000});
  for(const [type,data] of [['payment',{amount:1001}],['deduction',{amount:20,note:''}],['deduction',{amount:-1,note:'Reason'}],['payment',{amount:10,date:'bad'}]]){const before=structuredClone(s);assert.throws(()=>recordSalaryItem(s,employee.id,'2026-11',type,data));assert.deepEqual(s,before)}
  recordSalaryItem(s,employee.id,'2026-11','payment',{amount:900});const before=structuredClone(s);assert.throws(()=>recordSalaryItem(s,employee.id,'2026-11','deduction',{amount:101,note:'Too much'}));assert.deepEqual(s,before);
  assert.throws(()=>payrollSummary(s,employee.id,'2026-13'));assert.throws(()=>saveEmployee(s,{name:'Bad',salary:NaN}));
});
test('residency and labor-card reminders use real Dubai calendar dates and exclude inactive staff',()=>{
  assert.equal(todayDubai(new Date('2026-11-03T21:30:00Z')),'2026-11-04');assert.equal(addDays('2028-02-28',1),'2028-02-29');assert(validDate('2028-02-29'));assert(!validDate('2026-02-29'));
  const s=empty();const employee=saveEmployee(s,{name:'Worker',salary:1000,residencyExpiry:'2026-11-14',laborCardExpiry:'2026-10-30'});
  let reminders=getReminders(s,{asOf:'2026-11-04',documentDays:30});assert.equal(reminders.length,2);assert.equal(reminders.find(entry=>entry.document==='residency').daysRemaining,10);assert.equal(reminders.find(entry=>entry.document==='laborCard').daysRemaining,-5);
  saveEmployee(s,{...employee,active:false},employee.id);assert.equal(getReminders(s,{asOf:'2026-11-04'}).length,0);
});
test('malformed financial and staff backups reject without normalizing legacy data',()=>{
  const legacy=demo(),copy=structuredClone(legacy);validateBackup(legacy);assert.deepEqual(legacy,copy);assert(!legacy.employees&&!legacy.payrolls&&!legacy.orders[0].payments);
  const s=demo();recordPayment(s,s.orders[0].id,{amount:100});const e=saveEmployee(s,{name:'Worker',salary:1000});recordSalaryItem(s,e.id,'2026-11','payment',{amount:50});
  for(const corrupt of [x=>x.orders[0].payments[0].amount='100',x=>x.orders[0].payments.push({...x.orders[0].payments[0]}),x=>x.orders[0].paid=true,x=>x.employees[0].salary=-1,x=>x.employees[0].residencyExpiry='2026-02-30',x=>x.payrolls[0].employeeId='missing',x=>x.payrolls.push({...x.payrolls[0],id:'duplicate-month'}),x=>x.payrolls[0].payments[0].amount=2000,x=>x.orders[0].collectionReminder={intervalDays:0,nextDate:'2026-11-04'}]){const broken=structuredClone(s);corrupt(broken);assert.throws(()=>validateBackup(broken))}
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify(s))),s);
});
test('balance reminder drafts state exact collected and remaining money without claiming a send',()=>{
  for(const language of ['ar','en']){const text=debtReminderMessage({language,name:'A & B',model:'Nissan',plate:'123',number:'INV-9',total:236.25,received:100,remaining:136.25});for(const value of ['236.25','100.00','136.25','INV-9'])assert(text.includes(value));const parsed=new URL(buildWhatsAppUrl('0501234567',text));assert.equal(parsed.searchParams.get('text'),text);assert.equal([...parsed.searchParams].length,1)}
  assert.throws(()=>debtReminderMessage({total:100,received:100,remaining:0}));assert.throws(()=>debtReminderMessage({total:100,received:10,remaining:50}));
});
