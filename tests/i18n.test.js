import {test} from 'node:test';
import assert from 'node:assert/strict';
import {translate,createTranslator} from '../i18n.js';
import {amount} from '../domain.js';

test('static interface labels translate to English while Arabic remains the default',()=>{
 assert.equal(translate('الورشة'),'الورشة');
 assert.equal(translate('الورشة',{},'en'),'Workshop');
 assert.equal(translate('الفواتير وعروض الأسعار',{},'en'),'Invoices and quotations');
 assert.equal(translate('لغة المستند',{},'en'),'Document language');
 assert.equal(translate('وصف الخدمة بالإنجليزية (اختياري)',{},'en'),'Service description in English (optional)');
 assert.equal(translate('رقم الهاتف',{},'en'),'Phone number');
 assert.equal(translate('الدفع',{},'en'),'Payment');
 assert.equal(translate('إلى',{},'en'),'To');
 assert.equal(translate('فتح واتساب للإرسال',{},'en'),'Open WhatsApp to send');
 assert.equal(translate('نسخة تجريبية',{},'en'),'Demo');
});

test('customer names and service descriptions are never translated as substrings',()=>{
 for(const text of ['أحمد المنصوري','خالد عبدالله — العميل','Toyota Camry 2022','أبوظبي 12345','الخدمة: تغيير زيت المحرك & الفلاتر']){
  assert.equal(translate(text,{},'en'),text);
 }
 assert.equal(translate('Unknown UI extension'), 'Unknown UI extension');
 assert.equal(translate('خطأ جديد من خدمة خارجية',{},'en'),'خطأ جديد من خدمة خارجية');
});

test('interpolation preserves customer values, zero and unfilled placeholders',()=>{
 assert.equal(translate('عرض {count} من {total} سيارة',{count:0,total:12},'en'),'Showing 0 of 12 vehicles');
 assert.equal(translate('عرض {count} من {total} سيارة',{count:0,total:12}),'عرض 0 من 12 سيارة');
 assert.equal(translate('تعذّر الاستيراد: {error}',{error:'بيانات عميل خاصة'},'en'),'Import failed: بيانات عميل خاصة');
 assert.equal(translate('{stock} متوفر',{stock:4},'en'),'4 in stock');
 assert.equal(translate('{customer}: {missing}',{customer:'أحمد <Smith> & خالد'},'en'),'أحمد <Smith> & خالد: {missing}');
 assert.equal(translate('{missing}',Object.create({missing:'inherited'}),'en'),'{missing}');
 assert.equal(translate('{missing}',{missing:undefined},'en'),'{missing}');
 assert.equal(translate('{missing}',null,'en'),'{missing}');
});

test('language providers are evaluated on each call and explicit overrides are independent',()=>{
 let language='ar';const t=createTranslator(()=>language);
 assert.equal(t('العميل'),'العميل');language='en';assert.equal(t('العميل'),'Customer');
 assert.equal(t('العميل',{},'ar'),'العميل');assert.equal(language,'en');
 assert.equal(t('العميل',{},'fr'),'العميل','Unsupported language falls back to the Arabic source');
 assert.equal(createTranslator()('العميل'),'العميل');
});

test('known domain errors are localized while unknown errors remain inspectable',()=>{
 let error;try{amount(-1)}catch(caught){error=caught}
 assert(error instanceof Error);
 assert.equal(translate(error.message,{},'en'),'Enter a valid non-negative amount');
 for(const message of ['الكمية المطلوبة غير متوفرة','ألغِ تسجيل الدفع أولًا لتعديل الفاتورة.','ملف النسخة غير صالح','لغة رسالة المستند غير صالحة','رقم الهيكل VIN يجب أن يكون 17 حرفًا إنجليزيًا كبيرًا أو رقمًا، دون I أو O أو Q.','وصف الخدمة بالإنجليزية غير صالح أو طويل جدًا.','بيانات رقم الهيكل أو سنة السيارة أو المحرك غير صالحة','قائمة الموردين غير صالحة','معرّفات الموردين غير صالحة','بيانات المورد أو رقم واتساب أو تخصصه غير صالحة','بيانات طلب قطع الغيار غير صالحة']){
  assert.notEqual(translate(message,{},'en'),message);
  assert.equal(translate(message,{},'ar'),message);
 }
 assert.equal(translate('Unexpected storage failure: disk full',{},'en'),'Unexpected storage failure: disk full');
});
