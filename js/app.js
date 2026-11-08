const $app = document.getElementById('app');
const S = { user: null, settings: null, tab: 'dash', from: today(), to: today() };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function today() { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
const $ = id => document.getElementById(id);
const money = n => Math.round(n).toLocaleString('ar-EG') + ' ج';

async function init() { S.settings = await DB.getSettings(); loginView(); }

async function loginView() {
  const workers = await DB.list('workers');
  $app.innerHTML = `<div class="wrap login"><div class="card">
    <h1>🚗 تسجيل الغسلات</h1><div class="mut">الوضع: ${DB.mode}</div>
    <label>الاسم</label>
    <select id="who">${workers.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('')}</select>
    <label>الرقم السري</label><input id="pin" type="password" inputmode="numeric">
    <button class="full" id="go">دخول</button><div id="err" class="alert"></div></div></div>`;
  $('go').onclick = () => {
    const w = workers.find(x => x.id === $('who').value);
    if (!w || $('pin').value !== w.pin) return $('err').textContent = 'رقم سري غلط';
    S.user = { role: 'worker', ...w }; workerView();
  };
}

const header = t => `<header><h1>${t}</h1><button class="sec" onclick="S.user=null;loginView()">خروج</button></header>`;

async function workerView() {
  const u = S.user, d = today();
  const washes = (await DB.list('washes')).filter(x => x.workerId === u.id && x.date === d).sort((a, b) => b.ts - a.ts);
  const refills = (await DB.list('refills')).filter(x => x.workerId === u.id && x.date === d);
  const total = washes.reduce((s, x) => s + x.price, 0);
  const cash = washes.filter(x => x.pay === 'cash').reduce((s, x) => s + x.price, 0);
  const sv = S.settings.services;
  $app.innerHTML = `<div class="wrap">${header('أهلاً ' + esc(u.name))}
  <div class="card"><div class="grid">
    <div class="stat">غسلات اليوم<b>${washes.length}</b></div>
    <div class="stat">إجمالي<b>${money(total)}</b></div>
    <div class="stat">كاش تسلّمه<b>${money(cash)}</b></div>
    <div class="stat">نصيبك<b>${money(total * u.pct / 100)}</b></div></div></div>
  <div class="card"><h2>تسجيل غسلة جديدة</h2>
    <label>رقم/لون العربية</label><input id="plate">
    <label>الخدمة</label><select id="svc">${sv.map((s, i) => `<option value="${i}">${esc(s.name)} - ${s.price} ج</option>`).join('')}</select>
    <label>طريقة الدفع</label><select id="pay"><option value="cash">كاش</option><option value="digital">إنستاباي / فودافون كاش (لرقم المالك)</option></select>
    <label>موبايل العميل (اختياري - لإرسال إيصال واتساب)</label><input id="ph" inputmode="tel" placeholder="01xxxxxxxxx">
    <button class="full" id="save">تسجيل الغسلة</button></div>
  <div class="card"><div class="row"><h2>مياه اليوم</h2><button class="sec" id="rf">+ تعبئة خزان</button></div>
    <div class="mut">اللترات المعبّاة اليوم: ${refills.reduce((s, x) => s + x.liters, 0)}</div></div>
  <div class="card"><h2>غسلات اليوم</h2><div class="tw"><table><tr><th>#</th><th>العربية</th><th>السعر</th><th>دفع</th><th></th></tr>
  ${washes.map(x => `<tr><td>${x.no}</td><td>${esc(x.plate)}</td><td>${x.price}</td><td>${x.pay === 'cash' ? 'كاش' : 'رقمي'}</td>
  <td>${x.phone ? `<a class="wa" target="_blank" href="${wa(x)}">واتساب</a>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="mut">لا يوجد</td></tr>'}</table></div></div></div>`;
  $('save').onclick = async () => {
    const plate = $('plate').value.trim(); if (!plate) return alert('اكتب رقم العربية');
    const s = sv[$('svc').value], all = await DB.list('washes');
    const rec = { ts: Date.now(), date: d, workerId: u.id, workerName: u.name, cart: u.cart, plate, service: s.name, price: s.price,
      pay: $('pay').value, phone: $('ph').value.trim(), no: all.length + 1 };
    await DB.add('washes', rec); workerView();
  };
  $('rf').onclick = async () => {
    const l = +prompt('كام لتر عبّيت؟ (مثلاً 100)'); if (!l) return;
    await DB.add('refills', { ts: Date.now(), date: d, workerId: u.id, liters: l }); workerView();
  };
}

function wa(x) {
  let p = x.phone.replace(/\D/g, ''); if (p.startsWith('0')) p = '2' + p;
  const msg = `تم غسل عربيتك (${x.plate}) - ${x.service} بمبلغ ${x.price} جنيه. إيصال رقم ${x.no}. شكراً لك!`;
  return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
}

init();
