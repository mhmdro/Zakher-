// Local financial and reminder rules. No background notifications or messages are sent.
const uuid=()=>crypto.randomUUID();
const fail=(code,message)=>{const error=new Error(message);error.code=code;throw error};
const nowIso=()=>new Date().toISOString();
export function cents(value){
  if(value===null||typeof value==='boolean'||typeof value==='object'||String(value).trim()==='')fail('amount','أدخل مبلغًا صحيحًا بخانتين عشريتين.');
  const number=Number(value),result=Math.round(number*100);
  if(!Number.isFinite(number)||number<0||!Number.isSafeInteger(result)||Math.abs(number*100-result)>1e-5)fail('amount','أدخل مبلغًا صحيحًا بخانتين عشريتين.');
  return result;
}
const money=value=>value/100;
const positive=value=>{const result=cents(value);if(result<=0)fail('positive','أدخل مبلغًا أكبر من صفر.');return result};
export function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(value+'T00:00:00Z');return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value}
const validTime=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value)&&validDate(value.slice(0,10))&&Number.isFinite(Date.parse(value));
export function todayDubai(now=new Date()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  return ['year','month','day'].map(type=>parts.find(part=>part.type===type).value).join('-');
}
export function addDays(date,days){if(!validDate(date)||!Number.isInteger(days)||Math.abs(days)>36500)fail('date','التاريخ غير صحيح.');const value=new Date(date+'T00:00:00Z');value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10)}
const dayDifference=(date,from)=>Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);
const recordDate=value=>{const date=value||todayDubai();if(!validDate(date))fail('date','التاريخ غير صحيح.');return date};
export function orderVehicle(state,order){
  if(order?.guest)return {model:order.guest.vehicleModel,plate:order.guest.plate,guestCustomer:{name:order.guest.customerName,phone:order.guest.phone||''}};
  return state.vehicles.find(vehicle=>vehicle.id===order?.vehicleId);
}
export function orderCustomer(state,order){if(order?.guest)return {name:order.guest.customerName,phone:order.guest.phone||''};const vehicle=state.vehicles.find(entry=>entry.id===order?.vehicleId);return state.customers.find(customer=>customer.id===vehicle?.customerId)}
export function validGuest(guest){return !!guest&&typeof guest==='object'&&!Array.isArray(guest)&&['customerName','vehicleModel','plate'].every(key=>typeof guest[key]==='string'&&guest[key].trim()&&guest[key].length<=250)&&(!Object.hasOwn(guest,'phone')||typeof guest.phone==='string'&&guest.phone.length<=50)}
export function cleanGuest(guest){if(!validGuest(guest))fail('guest','أدخل اسم العميل والسيارة ورقم اللوحة لعرض السعر.');return {customerName:guest.customerName.trim(),vehicleModel:guest.vehicleModel.trim(),plate:guest.plate.trim(),phone:(guest.phone||'').trim()}}
export function paymentSummary(order){
  if(order.kind!=='invoice')return {received:0,remaining:0,isPaid:false};
  const total=cents(order.total),received=Array.isArray(order.payments)?order.payments.filter(entry=>!entry.voidedAt).reduce((sum,entry)=>sum+cents(entry.amount),0):order.paid?total:0;
  return {received:money(received),remaining:money(Math.max(0,total-received)),isPaid:total>0?received===total:!!order.paid};
}
export function paymentEntries(order){return Array.isArray(order.payments)?order.payments:order.paid&&order.total>0?[{id:'legacy-payment',amount:order.total,date:'',legacy:true,note:'دفعة قديمة بلا تاريخ'}]:[]}
const invoice=(state,orderId)=>{const order=state.orders.find(entry=>entry.id===orderId);if(!order||order.kind!=='invoice')fail('invoice','اختر فاتورة صيانة صحيحة.');return order};
const syncPaid=order=>{order.paid=cents(order.total)>0&&paymentSummary(order).remaining===0};
export function recordPayment(state,orderId,{amount,date,note=''}={}){
  const order=invoice(state,orderId),value=positive(amount),summary=paymentSummary(order),paidOn=recordDate(date);
  if(value>cents(summary.remaining))fail('overpayment','الدفعة أكبر من المبلغ المتبقي.');
  const entry={id:uuid(),amount:money(value),date:paidOn,note:String(note).trim().slice(0,1000)};
  order.payments=[...paymentEntries(order),entry];syncPaid(order);return entry;
}
export function voidPayment(state,orderId,paymentId,reason='تصحيح تسجيل الدفعة'){
  const order=invoice(state,orderId),entries=paymentEntries(order).map(entry=>({...entry})),entry=entries.find(entry=>entry.id===paymentId);
  if(!entry||entry.voidedAt)fail('entry','الدفعة غير موجودة أو ملغاة بالفعل.');
  entry.voidedAt=nowIso();entry.voidReason=String(reason).trim().slice(0,1000);order.payments=entries;syncPaid(order);return entry;
}
export function voidAllPayments(state,orderId){const order=invoice(state,orderId);const entries=paymentEntries(order).map(entry=>entry.voidedAt?entry:{...entry,voidedAt:nowIso(),voidReason:'إلغاء تسجيل الدفع'});order.payments=entries;syncPaid(order)}
export const isDelivered=order=>!!order.delivery;
export function markDelivery(state,orderId){const order=invoice(state,orderId);if(order.delivery)fail('delivery','السيارة مسلّمة بالفعل.');order.delivery={at:nowIso(),balanceAtDelivery:paymentSummary(order).remaining};order.status='مكتمل';return order.delivery}
export function undoDelivery(state,orderId){const order=invoice(state,orderId);delete order.delivery}
export function postponeDebtReminder(state,orderId,days=7,asOf=todayDubai()){
  const order=invoice(state,orderId);if(!Number.isInteger(days)||days<1||days>365)fail('interval','اختر فترة تذكير من يوم إلى 365 يومًا.');
  order.collectionReminder={intervalDays:days,nextDate:addDays(asOf,days),lastAcknowledgedAt:nowIso()};return order.collectionReminder;
}
const validMonth=value=>typeof value==='string'&&/^\d{4}-(?:0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1900&&Number(value.slice(0,4))<=2200;
export function saveEmployee(state,details,employeeId=''){
  if(typeof details.name!=='string'||!details.name.trim())fail('employeeName','اكتب اسم العامل.');
  const salary=money(cents(details.salary));
  for(const key of ['residencyExpiry','laborCardExpiry','joinedDate'])if(details[key]&&!validDate(details[key]))fail('date','التاريخ غير صحيح.');
  const employee={id:employeeId||uuid(),name:details.name.trim().slice(0,250),salary,role:String(details.role||'').trim().slice(0,200),phone:String(details.phone||'').trim().slice(0,50),residencyExpiry:details.residencyExpiry||'',laborCardExpiry:details.laborCardExpiry||'',joinedDate:details.joinedDate||'',active:details.active!==false};
  const existing=(state.employees||[]).findIndex(entry=>entry.id===employeeId);if(employeeId&&existing<0)fail('employee','العامل غير موجود.');
  state.employees??=[];if(existing>=0)state.employees[existing]=employee;else state.employees.push(employee);return employee;
}
export function payrollSummary(state,employeeId,month){
  const employee=(state.employees||[]).find(entry=>entry.id===employeeId);if(!employee)fail('employee','العامل غير موجود.');if(!validMonth(month))fail('month','اختر شهر راتب صحيحًا.');
  const payroll=(state.payrolls||[]).find(entry=>entry.employeeId===employeeId&&entry.month===month);
  const gross=cents(payroll?payroll.grossSalary:employee.salary),deductions=(payroll?.deductions||[]).filter(entry=>!entry.voidedAt).reduce((sum,entry)=>sum+cents(entry.amount),0),received=(payroll?.payments||[]).filter(entry=>!entry.voidedAt).reduce((sum,entry)=>sum+cents(entry.amount),0);
  return {gross:money(gross),deductions:money(deductions),net:money(gross-deductions),received:money(received),remaining:money(gross-deductions-received),payroll};
}
export function recordSalaryItem(state,employeeId,month,type,{amount,date,note=''}={}){
  if(!['payment','deduction'].includes(type))fail('type','نوع حركة الراتب غير صحيح.');
  const value=positive(amount),paidOn=recordDate(date),summary=payrollSummary(state,employeeId,month);
  if(type==='deduction'&&!String(note).trim())fail('reason','اكتب سبب الخصم.');
  if(value>cents(summary.remaining))fail('salaryLimit',type==='deduction'?'الخصم يتجاوز الراتب المتبقي بعد الدفعات.':'الدفعة تتجاوز صافي الراتب المتبقي.');
  const entry={id:uuid(),amount:money(value),date:paidOn,note:String(note).trim().slice(0,1000)};
  let payroll=summary.payroll;
  if(!payroll){payroll={id:uuid(),employeeId,month,grossSalary:summary.gross,payments:[],deductions:[]};state.payrolls??=[];state.payrolls.push(payroll)}
  payroll[type==='payment'?'payments':'deductions'].push(entry);return entry;
}
export function voidSalaryItem(state,payrollId,type,entryId){
  const payroll=(state.payrolls||[]).find(entry=>entry.id===payrollId);if(!payroll||!['payment','deduction'].includes(type))fail('entry','حركة الراتب غير موجودة.');
  const entry=payroll[type==='payment'?'payments':'deductions'].find(entry=>entry.id===entryId);if(!entry||entry.voidedAt)fail('entry','الحركة غير موجودة أو ملغاة بالفعل.');entry.voidedAt=nowIso();
}
export function salaryExpenseRows(state){return (state.payrolls||[]).flatMap(payroll=>payroll.payments.filter(entry=>!entry.voidedAt).map(entry=>({...entry,employeeName:(state.employees||[]).find(employee=>employee.id===payroll.employeeId)?.name||'',month:payroll.month})))}
export function salaryExpenses(state){return money(salaryExpenseRows(state).reduce((sum,entry)=>sum+cents(entry.amount),0))}
export function getReminders(state,{asOf=todayDubai(),documentDays=30}={}){
  if(!validDate(asOf)||!Number.isInteger(documentDays)||documentDays<0||documentDays>365)fail('date','إعدادات التذكير غير صحيحة.');
  const output=[];
  for(const employee of state.employees||[]){if(employee.active===false)continue;for(const [key,type] of [['residencyExpiry','residency'],['laborCardExpiry','laborCard']]){const date=employee[key];if(date&&validDate(date)){const days=dayDifference(date,asOf);if(days<=documentDays)output.push({type:'employee-document',employeeId:employee.id,name:employee.name,document:type,date,daysRemaining:days})}}}
  for(const order of state.orders){if(order.kind!=='invoice'||paymentSummary(order).remaining<=0)continue;
    const base=order.delivery?.at||order.date;if(!validTime(base))continue;
    const due=order.collectionReminder?.nextDate||addDays(todayDubai(new Date(base)),order.collectionReminder?.intervalDays||7);
    if(due<=asOf)output.push({type:'customer-balance',orderId:order.id,name:orderCustomer(state,order)?.name||'',date:due,remaining:paymentSummary(order).remaining,delivered:isDelivered(order)});
  }
  return output.sort((a,b)=>a.date.localeCompare(b.date));
}
export function debtReminderMessage({language='ar',name='',model='',plate='',number='',total=0,received=0,remaining=0}={}){
  if(!['ar','en'].includes(language))fail('language','اختر العربية أو الإنجليزية.');for(const value of [total,received,remaining])cents(value);
  if(cents(received)+cents(remaining)!==cents(total))fail('amount','بيانات المبلغ المتبقي غير متطابقة.');
  if(cents(remaining)<=0)fail('settled','لا يوجد مبلغ متبقٍ للتذكير.');
  return language==='ar'?`مرحبًا ${name||'عميلنا العزيز'} 👋\n\n*كراج زاخر لصيانة السيارات*\nتذكير لطيف بالمبلغ المتبقي على فاتورة الصيانة.\n\n🚘 السيارة: ${model}\n📍 اللوحة: ${plate}\n🧾 الفاتورة: ${number}\nالإجمالي: ${Number(total).toFixed(2)} د.إ\nالمدفوع: ${Number(received).toFixed(2)} د.إ\nالمتبقي: ${Number(remaining).toFixed(2)} د.إ\n\nشكرًا لتعاونك وثقتك بنا 💙`:`Hello ${name||'valued customer'} 👋\n\n*Zakher Garage · Auto Maintenance*\nA friendly reminder of the outstanding service invoice balance.\n\n🚘 Vehicle: ${model}\n📍 Plate: ${plate}\n🧾 Invoice: ${number}\nTotal: AED ${Number(total).toFixed(2)}\nPaid: AED ${Number(received).toFixed(2)}\nOutstanding: AED ${Number(remaining).toFixed(2)}\n\nThank you for your cooperation 💙`;
}
function checkEntries(entries,{legacy=false}={}){
  if(!Array.isArray(entries)||new Set(entries.map(entry=>entry?.id)).size!==entries.length)throw Error();
  for(const entry of entries){if(!entry||typeof entry.id!=='string'||!entry.id||typeof entry.amount!=='number'||cents(entry.amount)<=0||!(validDate(entry.date)||(legacy&&entry.legacy===true&&entry.date===''))||typeof entry.note!=='string'||(Object.hasOwn(entry,'voidedAt')&&!validTime(entry.voidedAt))||(Object.hasOwn(entry,'voidReason')&&typeof entry.voidReason!=='string'))throw Error()}
}
export function validateOperationalData(state){
  try{
    for(const order of state.orders){
      if(Object.hasOwn(order,'guest')&&(order.kind!=='quote'||!validGuest(order.guest)||order.vehicleId!==''))throw Error();
      if(Object.hasOwn(order,'payments')){if(order.kind!=='invoice')throw Error();checkEntries(order.payments,{legacy:true});const received=order.payments.filter(entry=>!entry.voidedAt).reduce((sum,entry)=>sum+cents(entry.amount),0);if(received>cents(order.total)||(order.total>0&&order.paid!==(received===cents(order.total))))throw Error()}
      if(Object.hasOwn(order,'delivery')&&(order.kind!=='invoice'||!order.delivery||!validTime(order.delivery.at)||typeof order.delivery.balanceAtDelivery!=='number'||cents(order.delivery.balanceAtDelivery)<0))throw Error();
      if(Object.hasOwn(order,'collectionReminder')&&(order.kind!=='invoice'||!order.collectionReminder||!Number.isInteger(order.collectionReminder.intervalDays)||order.collectionReminder.intervalDays<1||order.collectionReminder.intervalDays>365||!validDate(order.collectionReminder.nextDate)||(order.collectionReminder.lastAcknowledgedAt&&!validTime(order.collectionReminder.lastAcknowledgedAt))))throw Error();
    }
    if(Object.hasOwn(state,'employees')){
      if(!Array.isArray(state.employees)||new Set(state.employees.map(entry=>entry?.id)).size!==state.employees.length)throw Error();
      for(const employee of state.employees){if(!employee||typeof employee.id!=='string'||!employee.id||typeof employee.name!=='string'||!employee.name.trim()||typeof employee.salary!=='number'||cents(employee.salary)<0||['role','phone'].some(key=>Object.hasOwn(employee,key)&&typeof employee[key]!=='string')||['residencyExpiry','laborCardExpiry','joinedDate'].some(key=>Object.hasOwn(employee,key)&&employee[key]!==''&&!validDate(employee[key]))||(Object.hasOwn(employee,'active')&&typeof employee.active!=='boolean'))throw Error()}
    }
    if(Object.hasOwn(state,'payrolls')){
      if(!Array.isArray(state.payrolls)||new Set(state.payrolls.map(entry=>entry?.id)).size!==state.payrolls.length||new Set(state.payrolls.map(entry=>entry?.employeeId+'|'+entry?.month)).size!==state.payrolls.length)throw Error();
      for(const payroll of state.payrolls){if(!payroll||typeof payroll.id!=='string'||!payroll.id||!(state.employees||[]).some(entry=>entry.id===payroll.employeeId)||!validMonth(payroll.month)||typeof payroll.grossSalary!=='number'||cents(payroll.grossSalary)<0)throw Error();checkEntries(payroll.payments);checkEntries(payroll.deductions);const paid=payroll.payments.filter(entry=>!entry.voidedAt).reduce((sum,entry)=>sum+cents(entry.amount),0),deductions=payroll.deductions.filter(entry=>!entry.voidedAt).reduce((sum,entry)=>sum+cents(entry.amount),0);if(paid+deductions>cents(payroll.grossSalary))throw Error()}
    }
  }catch{fail('backup','بيانات الدفعات أو العمال أو الرواتب أو التذكيرات غير صالحة.');}
  return state;
}
