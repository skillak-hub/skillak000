/* ═══════════════════════════════════════════════════════════════════
   patch4.js — Skillak Platform v6.0
   mahmoud.hamed.ahmed25@gmail.com

   ═══════════════════════════════════════════════════════════════════
   ✅ 1.  تعديل البريد الإلكتروني وكلمة المرور من الملف الشخصي
   ✅ 2.  نظام الجلسات الكامل — إعادة الاتصال التلقائي
   ✅ 3.  العودة لـ "جلساتي" بعد الخروج من الجلسة
   ✅ 4.  تفاصيل الجلسة والأرباح الكاملة في لوحة الأدمن
   ✅ 5.  تحويل الأرباح للمعلم بعد اعتماد الأدمن
   ✅ 6.  إرسال بريد إلكتروني عند الحجز (EmailJS)
   ✅ 7.  غرفة انتظار محسّنة مع إعادة اتصال فورية
   ✅ 8.  زر إنهاء للطالب فقط — المعلم يخرج مؤقتاً
   ✅ 9.  تحسينات واجهة المستخدم الشاملة
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── helpers ─── */
const _p4 = {
  e: id => document.getElementById(id),
  esc: v => String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'),
  fmt: n => Number(n||0).toFixed(2),
  toast: (msg, type='') => { if (typeof showT==='function') showT(msg,type); },
  go: name => { if (typeof go==='function') go(name); },
};

/* ══════════════════════════════════════════════════════
   ⚙️ EmailJS CONFIG
   اذهب لـ https://www.emailjs.com وأنشئ حساب مجاني
   ثم أبدل القيم أدناه وغيّر enabled إلى true
   ══════════════════════════════════════════════════════ */
const _p4_EMAIL = {
  serviceId:  'service_zsr4t7b',   // من لوحة EmailJS
  templateId: 'template_wl51tit',  // قالب بريدك
  publicKey:  'a2SEaFDGp1ofly7HC',   // المفتاح العام
  enabled: true                   // ← اجعلها true بعد الإعداد
};

async function _p4_sendEmail(toEmail, toName, params) {
  if (!_p4_EMAIL.enabled) {
    console.log('[Skillak Email]', toEmail, params.subject);
    return;
  }
  try {
    if (!window.emailjs) {
      await new Promise((res, rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
      window.emailjs.init(_p4_EMAIL.publicKey);
    }
    await window.emailjs.send(_p4_EMAIL.serviceId, _p4_EMAIL.templateId, {
      to_email: toEmail,
      email: toEmail,
      recipient_email: toEmail,
      reply_to: toEmail,
      to_name: toName,
      name: toName,
      ...params
    });
  } catch(e) { console.warn('[Skillak Email]', e.message); }
}

/* ══════════════════════════════════════════════════════
   1. تعديل البريد الإلكتروني وكلمة المرور
   ══════════════════════════════════════════════════════ */

function _p4_injectSecuritySection() {
  // Only inject once
  if (_p4.e('p4SecurityCard')) return;

  // Find the save button row in editProfile
  const editWrap = document.querySelector('.editwrap');
  if (!editWrap) return;

  const secCard = document.createElement('div');
  secCard.id = 'p4SecurityCard';
  secCard.className = 'card';
  secCard.style.cssText = 'margin-top:16px';
  secCard.innerHTML = `
    <div class="ch">
      <div class="ct" style="display:flex;align-items:center;gap:8px">
        <span style="font-size:1.2rem">🔐</span>
        <span>إعدادات الأمان</span>
      </div>
    </div>
    <div class="cb">

      <!-- Change Email -->
      <div style="margin-bottom:24px">
        <div style="font-weight:800;font-size:.88rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <span style="width:28px;height:28px;background:rgba(13,110,117,.12);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.9rem">📧</span>
          تغيير البريد الإلكتروني
        </div>
        <div id="p4CurrentEmail" style="font-size:.8rem;color:var(--muted);margin-bottom:10px;padding:8px 12px;background:var(--cream2);border-radius:8px">
          البريد الحالي: جاري التحميل...
        </div>
        <div class="fg" style="margin-bottom:10px">
          <label>البريد الجديد <span class="req">*</span></label>
          <input type="email" id="p4NewEmail" placeholder="new@email.com" style="direction:ltr" />
        </div>
        <div class="fg" style="margin-bottom:12px">
          <label>كلمة المرور الحالية (للتحقق) <span class="req">*</span></label>
          <div style="position:relative">
            <input type="password" id="p4EmailPass" placeholder="أدخل كلمة مرورك الحالية" />
            <button type="button" onclick="document.getElementById('p4EmailPass').type=document.getElementById('p4EmailPass').type==='password'?'text':'password'"
              style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
          </div>
        </div>
        <button class="btn btn-p btn-sm" onclick="p4ChangeEmail()" style="width:100%">
          📧 تحديث البريد الإلكتروني
        </button>
      </div>

      <div style="border-top:1.5px solid var(--border);margin:0 0 20px"></div>

      <!-- Change Password -->
      <div>
        <div style="font-weight:800;font-size:.88rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <span style="width:28px;height:28px;background:rgba(245,158,11,.12);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:.9rem">🔑</span>
          تغيير كلمة المرور
        </div>
        <div class="fg" style="margin-bottom:10px">
          <label>كلمة المرور الحالية <span class="req">*</span></label>
          <div style="position:relative">
            <input type="password" id="p4OldPass" placeholder="كلمة المرور الحالية" />
            <button type="button" onclick="document.getElementById('p4OldPass').type=document.getElementById('p4OldPass').type==='password'?'text':'password'"
              style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
          </div>
        </div>
        <div class="fg" style="margin-bottom:10px">
          <label>كلمة المرور الجديدة <span class="req">*</span></label>
          <div style="position:relative">
            <input type="password" id="p4NewPass" placeholder="6 أحرف على الأقل" />
            <button type="button" onclick="document.getElementById('p4NewPass').type=document.getElementById('p4NewPass').type==='password'?'text':'password'"
              style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
          </div>
        </div>
        <div class="fg" style="margin-bottom:12px">
          <label>تأكيد كلمة المرور الجديدة <span class="req">*</span></label>
          <div style="position:relative">
            <input type="password" id="p4ConfPass" placeholder="أعد كتابة كلمة المرور الجديدة" />
            <button type="button" onclick="document.getElementById('p4ConfPass').type=document.getElementById('p4ConfPass').type==='password'?'text':'password'"
              style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem">👁</button>
          </div>
        </div>
        <!-- Password strength indicator -->
        <div id="p4PassStrength" style="margin-bottom:12px;display:none">
          <div style="height:4px;border-radius:4px;background:#e5e7eb;overflow:hidden">
            <div id="p4PassBar" style="height:100%;border-radius:4px;transition:width .3s,background .3s;width:0"></div>
          </div>
          <div id="p4PassLabel" style="font-size:.72rem;margin-top:4px;color:var(--muted)"></div>
        </div>
        <button class="btn btn-p btn-sm" onclick="p4ChangePassword()" style="width:100%;background:linear-gradient(135deg,#f59e0b,#d97706);border-color:transparent">
          🔑 تحديث كلمة المرور
        </button>
      </div>

    </div>
  `;

  // Append to editwrap
  editWrap.appendChild(secCard);

  // Password strength listener
  const newPassEl = _p4.e('p4NewPass');
  if (newPassEl) {
    newPassEl.addEventListener('input', () => {
      const v = newPassEl.value;
      const str = _p4.e('p4PassStrength');
      const bar = _p4.e('p4PassBar');
      const lbl = _p4.e('p4PassLabel');
      if (!str || !bar || !lbl) return;
      if (!v) { str.style.display = 'none'; return; }
      str.style.display = 'block';
      const score = [v.length >= 8, /[A-Z]/.test(v), /[0-9]/.test(v), /[^A-Za-z0-9]/.test(v)].filter(Boolean).length;
      const map = [
        ['25%', '#ef4444', 'ضعيفة جداً 😟'],
        ['50%', '#f59e0b', 'مقبولة 😐'],
        ['75%', '#10b981', 'جيدة 😊'],
        ['100%', '#059669', 'قوية جداً 💪'],
      ];
      const [width, color, text] = map[Math.max(0, score - 1)] || map[0];
      bar.style.width = width; bar.style.background = color;
      lbl.textContent = text; lbl.style.color = color;
    });
  }
}

/* Fill current email when profile loads */
function _p4_fillCurrentEmail() {
  const el = _p4.e('p4CurrentEmail');
  if (!el) return;
  const email = (typeof CU !== 'undefined' ? CU?.email : null) ||
                (typeof CP !== 'undefined' ? CP?.email : null) || '—';
  el.textContent = `البريد الحالي: ${email}`;
}

/* Change Email */
window.p4ChangeEmail = async function() {
  const newEmail = (_p4.e('p4NewEmail')?.value || '').trim();
  const pass     = _p4.e('p4EmailPass')?.value || '';
  if (!newEmail || !newEmail.includes('@')) { _p4.toast('❌ البريد الإلكتروني غير صحيح', 'err'); return; }
  if (!pass) { _p4.toast('❌ أدخل كلمة مرورك الحالية للتحقق', 'err'); return; }
  if (!CU) { _p4.toast('يرجى تسجيل الدخول', 'err'); return; }

  const btn = document.querySelector('[onclick="p4ChangeEmail()"]');
  if (btn) { btn.textContent = 'جاري التحديث...'; btn.disabled = true; }

  try {
    // Re-authenticate first
    const credential = firebase.auth.EmailAuthProvider.credential(CU.email, pass);
    await CU.reauthenticateWithCredential(credential);
    await CU.updateEmail(newEmail);
    // Update in Firestore too
    await db.collection('users').doc(CU.uid).update({ email: newEmail });
    if (typeof CP !== 'undefined' && CP) CP.email = newEmail;
    _p4_fillCurrentEmail();
    if (_p4.e('p4NewEmail')) _p4.e('p4NewEmail').value = '';
    if (_p4.e('p4EmailPass')) _p4.e('p4EmailPass').value = '';
    _p4.toast('✅ تم تحديث البريد الإلكتروني بنجاح', 'suc');
  } catch(e) {
    const errMap = {
      'auth/wrong-password':         '❌ كلمة المرور الحالية غير صحيحة',
      'auth/email-already-in-use':   '❌ هذا البريد مستخدم بالفعل من حساب آخر',
      'auth/invalid-email':          '❌ صيغة البريد الإلكتروني غير صحيحة',
      'auth/requires-recent-login':  '❌ يرجى تسجيل الخروج وإعادة الدخول ثم المحاولة',
    };
    _p4.toast(errMap[e.code] || '❌ ' + e.message, 'err');
  } finally {
    if (btn) { btn.textContent = '📧 تحديث البريد الإلكتروني'; btn.disabled = false; }
  }
};

/* Change Password */
window.p4ChangePassword = async function() {
  const oldPass  = _p4.e('p4OldPass')?.value || '';
  const newPass  = _p4.e('p4NewPass')?.value || '';
  const confPass = _p4.e('p4ConfPass')?.value || '';
  if (!oldPass)             { _p4.toast('❌ أدخل كلمة المرور الحالية', 'err'); return; }
  if (newPass.length < 6)   { _p4.toast('❌ كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 'err'); return; }
  if (newPass !== confPass)  { _p4.toast('❌ كلمتا المرور غير متطابقتين', 'err'); return; }
  if (!CU)                   { _p4.toast('يرجى تسجيل الدخول', 'err'); return; }

  const btn = document.querySelector('[onclick="p4ChangePassword()"]');
  if (btn) { btn.textContent = 'جاري التحديث...'; btn.disabled = true; }

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(CU.email, oldPass);
    await CU.reauthenticateWithCredential(credential);
    await CU.updatePassword(newPass);
    if (_p4.e('p4OldPass'))  _p4.e('p4OldPass').value  = '';
    if (_p4.e('p4NewPass'))  _p4.e('p4NewPass').value  = '';
    if (_p4.e('p4ConfPass')) _p4.e('p4ConfPass').value = '';
    const str = _p4.e('p4PassStrength');
    if (str) str.style.display = 'none';
    _p4.toast('✅ تم تغيير كلمة المرور بنجاح', 'suc');
  } catch(e) {
    const errMap = {
      'auth/wrong-password':        '❌ كلمة المرور الحالية غير صحيحة',
      'auth/requires-recent-login': '❌ يرجى تسجيل الخروج وإعادة الدخول ثم المحاولة',
      'auth/weak-password':         '❌ كلمة المرور الجديدة ضعيفة جداً',
    };
    _p4.toast(errMap[e.code] || '❌ ' + e.message, 'err');
  } finally {
    if (btn) { btn.textContent = '🔑 تحديث كلمة المرور'; btn.disabled = false; }
  }
};

/* Hook into loadEditProf */
const _p4_origLoadEdit = window.loadEditProf;
window.loadEditProf = async function() {
  if (typeof _p4_origLoadEdit === 'function') await _p4_origLoadEdit();
  _p4_injectSecuritySection();
  _p4_fillCurrentEmail();
};

/* ══════════════════════════════════════════════════════
   2. نظام الجلسات — إعادة الاتصال التلقائي
   ══════════════════════════════════════════════════════ */

/* Waiting room with live countdown + retry */
window._p4_sesConnected = false;

function _p4_injectWaitingRoomEnhancer(bk, isTutor) {
  const waitOv = _p4.e('waitOv');
  if (!waitOv) return;

  const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : 0;
  const other = isTutor ? (bk.studentName || 'الطالب') : (bk.tutorName || 'المعلم');

  // Create enhanced overlay content if not already enhanced
  if (waitOv.querySelector('.swr-inner')) return;
  const inner = waitOv.querySelector('.waitinner') || waitOv.firstElementChild;
  if (!inner) return;

  // Add retry button and countdown to overlay
  const extra = document.createElement('div');
  extra.id = 'p4WaitExtra';
  extra.style.cssText = 'margin-top:14px;text-align:center';
  extra.innerHTML = `
    <div id="p4WaitCountdown" style="font-size:.8rem;color:rgba(255,255,255,.5);margin-bottom:10px"></div>
    <div style="font-size:.82rem;color:rgba(255,255,255,.6);margin-bottom:10px">
      في انتظار <strong style="color:#fff">${_p4.esc(other)}</strong> للانضمام...
    </div>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
      <button onclick="_p4_retryConnection()" 
        style="background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);
               border-radius:10px;padding:8px 16px;font-size:.8rem;cursor:pointer;font-family:'Cairo',sans-serif">
        🔄 إعادة الاتصال
      </button>
      <button onclick="_p4_exitWaitingRoom()" 
        style="background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.15);
               border-radius:10px;padding:8px 16px;font-size:.8rem;cursor:pointer;font-family:'Cairo',sans-serif">
        ← الخروج
      </button>
    </div>`;

  if (inner) inner.appendChild(extra);

  // Update countdown
  if (endMs) {
    const countdownEl = _p4.e('p4WaitCountdown');
    const update = () => {
      if (!countdownEl) return;
      const rem = endMs - Date.now();
      if (rem <= 0) { countdownEl.textContent = '⏰ انتهى وقت الجلسة'; return; }
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      const str = h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
      countdownEl.textContent = `⏱️ الوقت المتبقي للجلسة: ${str}`;
    };
    update();
    const _countInt = setInterval(() => {
      if (!_p4.e('p4WaitCountdown')) { clearInterval(_countInt); return; }
      update();
    }, 1000);
  }
}

window._p4_retryConnection = async function() {
  const bid = typeof curSesBid !== 'undefined' ? curSesBid : null;
  if (!bid) return;
  _p4.toast('🔄 جاري إعادة محاولة الاتصال...', 'inf');
  // Restart WebRTC from scratch
  try {
    if (typeof pc !== 'undefined' && pc) { try { pc.close(); } catch(e) {} window.pc = null; }
    // Re-enter session
    if (typeof enterSession === 'function') await enterSession(bid);
  } catch(e) {
    _p4.toast('تعذرت إعادة الاتصال: ' + e.message, 'err');
  }
};

window._p4_exitWaitingRoom = function() {
  const bid = typeof curSesBid !== 'undefined' ? curSesBid : null;
  // Pause session and return to sessions page
  if (bid) {
    const bk = typeof curSesBk !== 'undefined' ? curSesBk : null;
    if (bk) {
      const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : 0;
      db.collection('bookings').doc(bid).set({
        status: 'paused',
        lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
        sessionEndsAtMs: endMs
      }, { merge: true }).catch(() => {});
    }
  }
  // Cleanup
  if (typeof pc !== 'undefined' && pc) { try { pc.close(); } catch(e) {} window.pc = null; }
  if (typeof locSt !== 'undefined' && locSt) { locSt.getTracks().forEach(t => t.stop()); window.locSt = null; }
  if (typeof sesTInt !== 'undefined' && sesTInt) { clearInterval(sesTInt); }
  if (typeof sesChatL !== 'undefined' && sesChatL) { try { sesChatL(); } catch(e) {} }
  const mainNav = _p4.e('mainNav');
  if (mainNav) mainNav.style.display = '';
  if (typeof curSesBid !== 'undefined') window.curSesBid = null;
  if (typeof curSesBk !== 'undefined') window.curSesBk = null;
  // Go to sessions tab
  _p4.go('dashboard');
  setTimeout(() => { if (typeof dNav === 'function') dNav('sessions'); }, 300);
};

/* Hook enterSession to enhance waiting room */
const _p4_origEnter = window.enterSession;
window.enterSession = async function(bookingId) {
  _p4.toast('🔗 جاري الاتصال بالجلسة...', 'inf');
  try {
    const bSnap = await db.collection('bookings').doc(bookingId).get();
    const bk = bSnap.exists ? { id: bookingId, ...bSnap.data() } : null;
    const uid = typeof CU !== 'undefined' ? CU?.uid : null;
    const isTutor = bk?.tutorId === uid;

    const result = typeof _p4_origEnter === 'function' ? await _p4_origEnter(bookingId) : undefined;

    // Enhance waiting room after render
    setTimeout(() => {
      if (bk) _p4_injectWaitingRoomEnhancer(bk, isTutor);
    }, 800);

    // ICE reconnection listener
    setTimeout(() => {
      const peerConn = typeof pc !== 'undefined' ? pc : null;
      if (!peerConn) return;
      let reconnAttempts = 0;
      const origStateChange = peerConn.oniceconnectionstatechange;
      peerConn.oniceconnectionstatechange = async () => {
        if (typeof origStateChange === 'function') origStateChange.call(peerConn);
        const state = peerConn.iceConnectionState;
        if (['disconnected', 'failed'].includes(state) && reconnAttempts < 3) {
          reconnAttempts++;
          _p4.toast(`📶 انقطع الاتصال — محاولة إعادة الاتصال (${reconnAttempts}/3)...`, 'inf');
          setTimeout(async () => {
            try {
              await peerConn.restartIce?.();
            } catch(e) {}
          }, 2000 * reconnAttempts);
        }
      };
    }, 1500);

    return result;
  } catch(e) {
    _p4.toast('تعذر الدخول للجلسة: ' + e.message, 'err');
    _p4.go('dashboard');
    setTimeout(() => { if (typeof dNav === 'function') dNav('sessions'); }, 300);
  }
};

/* ══════════════════════════════════════════════════════
   3. العودة لـ "جلساتي" بعد الخروج
   ══════════════════════════════════════════════════════ */

/* Patch original endSession — after any exit, go to sessions tab */
const _p4_origEnd = window.endSession;
window.endSession = async function() {
  if (typeof _p4_origEnd === 'function') await _p4_origEnd();
  // Small delay then navigate to sessions
  setTimeout(() => {
    const currentPage = document.querySelector('.page:not(.hidden)');
    if (!currentPage || currentPage.id !== 'page-session') {
      if (typeof dNav === 'function') dNav('sessions');
    }
  }, 500);
};

/* ══════════════════════════════════════════════════════
   4. لوحة الأدمن — تفاصيل الجلسة والأرباح الكاملة
   ══════════════════════════════════════════════════════ */

/* Enhanced admin bookings view */
const _p4_origAdTab = window.adTab;
window.adTab = async function(tab, el) {
  const res = typeof _p4_origAdTab === 'function' ? await _p4_origAdTab(tab, el) : undefined;

  if (tab === 'bookings') {
    setTimeout(_p4_enhanceAdminBookings, 300);
  }
  if (tab === 'stats') {
    setTimeout(_p4_enhanceAdminStats, 300);
  }
  return res;
};

async function _p4_enhanceAdminBookings() {
  const con = _p4.e('adCon');
  if (!con) return;

  // Add summary cards at top if not there
  if (con.querySelector('.p4-bk-summary')) return;

  try {
    const snap = await db.collection('bookings').get().catch(() => ({ docs: [] }));
    const bks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const comp = bks.filter(b => b.status === 'completed');
    const pending_payment = comp.filter(b => !b.adminConfirmed);
    const total_platform_profit = comp.reduce((s, b) =>
      s + Number(b.studentFee || 0) + Number(b.tutorFee ?? b.fee ?? 0), 0);
    const total_tutor_net = comp.reduce((s, b) =>
      s + Number((b.price || 0) - (b.tutorFee ?? b.fee ?? 0)), 0);

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'p4-bk-summary';
    summaryDiv.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px';
    summaryDiv.innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(13,110,117,.1),rgba(13,110,117,.05));border:1px solid rgba(13,110,117,.2);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:var(--teal)">${_p4.fmt(total_platform_profit)}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">💰 أرباح المنصة (ج.م)</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(5,150,105,.1),rgba(5,150,105,.05));border:1px solid rgba(5,150,105,.2);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:#059669">${_p4.fmt(total_tutor_net)}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">👨‍🏫 إجمالي أرباح المعلمين</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(245,158,11,.1),rgba(245,158,11,.05));border:1px solid rgba(245,158,11,.2);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:#d97706">${pending_payment.length}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">⏳ بانتظار التحويل للمعلم</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(99,102,241,.1),rgba(99,102,241,.05));border:1px solid rgba(99,102,241,.2);border-radius:14px;padding:14px;text-align:center">
        <div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:#6366f1">${comp.length}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-top:4px">🏁 جلسات مكتملة</div>
      </div>`;

    const firstTable = con.querySelector('.dsec');
    if (firstTable) firstTable.insertBefore(summaryDiv, firstTable.firstChild);

    // Enhance table rows with profit details
    _p4_addProfitDetailsToRows(bks);

  } catch(e) {}
}

function _p4_addProfitDetailsToRows(bks) {
  const rows = document.querySelectorAll('#adCon table tbody tr');
  rows.forEach(row => {
    if (row.querySelector('.p4-profit-details')) return;
    // Try to match booking by student/tutor name from row text
    const tds = row.querySelectorAll('td');
    if (tds.length < 4) return;

    // Add profit breakdown cell if completed bookings
    const statusCell = row.querySelector('.pill.pco, .pill.pc');
    if (!statusCell) return;

    // Find the booking from buttons onclick
    let bid = null;
    row.querySelectorAll('button[onclick]').forEach(btn => {
      const m = btn.getAttribute('onclick')?.match(/['"]([\w]{15,})['"]/);
      if (m) bid = m[1];
    });
    if (!bid) return;

    const bk = bks.find(b => b.id === bid);
    if (!bk) return;

    const lastTd = row.querySelector('td:last-child');
    if (!lastTd) return;

    const profitSpan = document.createElement('div');
    profitSpan.className = 'p4-profit-details';
    profitSpan.style.cssText = 'margin-top:6px;font-size:.7rem;background:rgba(13,110,117,.06);border-radius:6px;padding:5px 8px;border:1px solid rgba(13,110,117,.12)';
    const price = Number(bk.price || 0);
    const sFee = Number(bk.studentFee || 0);
    const tFee = Number(bk.tutorFee ?? bk.fee ?? 0);
    const net = price - tFee;
    profitSpan.innerHTML = `
      <div style="color:var(--muted)">سعر: ${_p4.fmt(price)} · عمولة الطالب: ${_p4.fmt(sFee)} · عمولة المعلم: ${_p4.fmt(tFee)}</div>
      <div style="color:#059669;font-weight:700;margin-top:3px">صافي المعلم: ${_p4.fmt(net)} ج.م · ربح المنصة: ${_p4.fmt(sFee + tFee)} ج.م</div>`;
    lastTd.appendChild(profitSpan);
  });
}

/* Enhanced admin stats with profit breakdown */
async function _p4_enhanceAdminStats() {
  const con = _p4.e('adCon');
  if (!con || con.querySelector('.p4-profit-card')) return;

  try {
    const [bSnap, uSnap] = await Promise.all([
      db.collection('bookings').where('status', '==', 'completed').get().catch(() => ({ docs: [] })),
      db.collection('users').get().catch(() => ({ docs: [] }))
    ]);
    const bks = bSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const total_s_fee = bks.reduce((s, b) => s + Number(b.studentFee || 0), 0);
    const total_t_fee = bks.reduce((s, b) => s + Number(b.tutorFee ?? b.fee ?? 0), 0);
    const total_profit = total_s_fee + total_t_fee;
    const total_gross = bks.reduce((s, b) => s + Number(b.price || 0), 0);
    const tutors = uSnap.docs.filter(d => ['tutor','both'].includes(d.data().role)).length;
    const students = uSnap.docs.filter(d => d.data().role === 'learner').length;
    const pending_admin = bks.filter(b => !b.adminConfirmed).length;

    const profitCard = document.createElement('div');
    profitCard.className = 'p4-profit-card';
    profitCard.style.cssText = 'margin-top:16px';
    profitCard.innerHTML = `
      <div style="font-weight:900;font-size:1rem;margin-bottom:14px;font-family:'Fraunces',serif">
        💰 تفاصيل الأرباح والإحصائيات الكاملة
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        ${[
          ['الإيرادات الإجمالية', _p4.fmt(total_gross) + ' ج.م', '#0ea5e9', '💵'],
          ['عمولة المنصة من الطلاب', _p4.fmt(total_s_fee) + ' ج.م', '#f59e0b', '👨‍🎓'],
          ['عمولة المنصة من المعلمين', _p4.fmt(total_t_fee) + ' ج.م', '#a855f7', '👨‍🏫'],
          ['إجمالي أرباح المنصة', _p4.fmt(total_profit) + ' ج.م', '#10b981', '🏦'],
          ['جلسات تنتظر التحويل', pending_admin + ' جلسة', '#ef4444', '⏳'],
          ['معلمون / طلاب', `${tutors} / ${students}`, '#6366f1', '👥'],
        ].map(([lbl, val, color, icon]) => `
          <div style="background:#fff;border:1.5px solid ${color}22;border-radius:14px;padding:16px;border-right:4px solid ${color}">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span>${icon}</span>
              <span style="font-size:.75rem;color:var(--muted)">${lbl}</span>
            </div>
            <div style="font-weight:900;font-size:1.2rem;color:${color};font-family:'Fraunces',serif">${val}</div>
          </div>`).join('')}
      </div>`;

    const srow = con.querySelector('.srow');
    if (srow) srow.after(profitCard);
  } catch(e) {}
}

/* ══════════════════════════════════════════════════════
   5. تحويل الأرباح بعد اعتماد الأدمن — تحسين الواجهة
   ══════════════════════════════════════════════════════ */

/* Add a "Transfer All Pending" button for admin */
function _p4_injectBulkPayButton() {
  const adCon = _p4.e('adCon');
  if (!adCon || adCon.querySelector('.p4-bulk-pay')) return;

  db.collection('bookings')
    .where('status', '==', 'completed')
    .where('adminConfirmed', '==', false)
    .get()
    .then(snap => {
      if (snap.empty) return;
      const pending = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const bulkBtn = document.createElement('div');
      bulkBtn.className = 'p4-bulk-pay';
      bulkBtn.style.cssText = 'background:linear-gradient(135deg,rgba(5,150,105,.08),rgba(5,150,105,.04));border:1.5px solid rgba(5,150,105,.25);border-radius:14px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px';
      const total_net = pending.reduce((s, b) =>
        s + Number((b.price || 0) - (b.tutorFee ?? b.fee ?? 0)), 0);
      bulkBtn.innerHTML = `
        <div>
          <div style="font-weight:800;font-size:.9rem;color:#059669">
            ${pending.length} جلسة مكتملة بانتظار التحويل
          </div>
          <div style="font-size:.75rem;color:var(--muted);margin-top:3px">
            إجمالي صافي المعلمين: ${_p4.fmt(total_net)} ج.م
          </div>
        </div>
        <button onclick="p4BulkPayTutors()" class="btn btn-s btn-sm">
        </button>`;

      const firstSection = adCon.querySelector('.dsec') || adCon.firstElementChild;
      if (firstSection) adCon.insertBefore(bulkBtn, firstSection);
    }).catch(() => {});
}

window.p4BulkPayTutors = async function() {
  if (!confirm('تحويل أرباح جميع الجلسات المكتملة لمحافظ المعلمين؟')) return;
  _p4.toast('⏳ جاري التحويل...', 'inf');

  try {
    const snap = await db.collection('bookings')
      .where('status', '==', 'completed')
      .where('adminConfirmed', '==', false)
      .get();

    let count = 0;
    for (const doc of snap.docs) {
      const bk = { id: doc.id, ...doc.data() };
      const tutorFee = Number(bk.tutorFee ?? bk.fee ?? 0);
      const net = Number(bk.price || 0) - tutorFee;
      if (net <= 0) continue;

      try {
        await db.runTransaction(async tx => {
          const wr = db.collection('wallets').doc(bk.tutorId);
          const ws = await tx.get(wr);
          const wb = ws.exists ? (ws.data().balance || 0) : 0;
          tx.set(wr, { balance: +(wb + net).toFixed(2), userId: bk.tutorId }, { merge: true });
          tx.update(db.collection('bookings').doc(bk.id), {
            adminConfirmed: true,
            tutorPaidAt: firebase.firestore.FieldValue.serverTimestamp(),
            tutorNetAmount: net,
            paymentStatus: 'paid'
          });
        });
        await db.collection('transactions').add({
          userId: bk.tutorId, type: 'credit', kind: 'session_earnings',
          amount: net, currency: 'EGP', status: 'approved',
          bookingId: bk.id,
          description: `أرباح جلسة مع ${bk.studentName||'—'} — ${bk.date||''}`,
          approvedBy: typeof CU !== 'undefined' ? CU?.uid : 'admin',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        count++;
      } catch(e) { console.warn('bulk pay error', bk.id, e); }
    }
    _p4.toast(`✅ تم تحويل أرباح ${count} جلسة بنجاح`, 'suc');
    if (typeof adTab === 'function') adTab('bookings', document.querySelector('.adminTab'));
  } catch(e) {
    _p4.toast('خطأ: ' + e.message, 'err');
  }
};

/* ══════════════════════════════════════════════════════
   6. البريد الإلكتروني بعد الحجز (EmailJS)
   ══════════════════════════════════════════════════════ */

const _p4_origConfirmBk = window.confirmBk;
window.confirmBk = async function() {
  if (typeof _p4_origConfirmBk === 'function') await _p4_origConfirmBk();

  // Send emails after successful booking
  setTimeout(async () => {
    try {
      if (!CU || !CP || typeof curT === 'undefined' || !curT) return;
      const t = curT;
      const timeLblStr = typeof timeLbl === 'function' ? timeLbl(typeof selTime !== 'undefined' ? selTime : '') : selTime;
      const dateStr = typeof selDate !== 'undefined' ? selDate : '—';

      // Email to student
      if (CU.email) {
        await _p4_sendEmail(CU.email, CP.name || 'طالب', {
          subject: `✅ تأكيد حجزك مع ${t.name} — Skillak`,
          message: `مرحباً ${CP.name || 'الطالب'}،\n\nتم حجز جلستك بنجاح!\n\n📅 التاريخ: ${dateStr}\n⏰ الوقت: ${timeLblStr}\n👨‍🏫 المعلم: ${t.name}\n💰 السعر: ${t.price} ج.م/ساعة\n\nستجد جلستك في قسم "جلساتي" في لوحة التحكم.\nسيتواصل معك المعلم لتأكيد الموعد.\n\nبالتوفيق! 🎓\nفريق Skillak`,
          teacher_name: t.name,
          student_name: CP.name || '—',
          session_date: dateStr,
          session_time: timeLblStr,
          platform: 'Skillak',
          platform_email: 'mahmoud.hamed.ahmed25@gmail.com'
        });
      }

      // Email to tutor
      try {
        const tutorDoc = await db.collection('users').doc(t.id).get();
        const tutorEmail = tutorDoc.data()?.email || '';
        if (tutorEmail) {
          await _p4_sendEmail(tutorEmail, t.name, {
            subject: `🔔 طلب حجز جلسة جديد — Skillak`,
            message: `مرحباً ${t.name}،\n\nلديك طلب حجز جلسة جديد!\n\n👨‍🎓 الطالب: ${CP.name || '—'}\n📅 التاريخ: ${dateStr}\n⏰ الوقت: ${timeLblStr}\n\nيرجى الموافقة أو الرفض من لوحة التحكم في أقرب وقت.\n\nشكراً! 🙏\nفريق Skillak`,
            student_name: CP.name || '—',
            teacher_name: t.name,
            session_date: dateStr,
            session_time: timeLblStr,
            platform: 'Skillak',
            platform_email: 'mahmoud.hamed.ahmed25@gmail.com'
          });
        }
      } catch(e) {}

    } catch(e) { console.warn('[p4 email]', e); }
  }, 3000);
};

/* Email when tutor approves */
const _p4_origTutorApprove = window.tutorApproveBk;
window.tutorApproveBk = async function(bid, studentId, tot) {
  if (typeof _p4_origTutorApprove === 'function') await _p4_origTutorApprove(bid, studentId, tot);

  setTimeout(async () => {
    try {
      const [bSnap, sSnap] = await Promise.all([
        db.collection('bookings').doc(bid).get(),
        db.collection('users').doc(studentId).get()
      ]);
      const bk = bSnap.data() || {};
      const studentEmail = sSnap.data()?.email || '';
      const studentName = sSnap.data()?.name || 'الطالب';

      if (studentEmail) {
        await _p4_sendEmail(studentEmail, studentName, {
          subject: `✅ تمت الموافقة على حجزك — Skillak`,
          message: `مرحباً ${studentName}،\n\nتمت الموافقة على حجزك! 🎉\n\n👨‍🏫 المعلم: ${bk.tutorName || '—'}\n📅 التاريخ: ${bk.date || '—'}\n⏰ الوقت: ${bk.timeLbl || bk.time || '—'}\n\nيمكنك الدخول للجلسة في وقت الموعد من قسم "جلساتي".\n\nبالتوفيق! 🎓\nفريق Skillak`,
          teacher_name: bk.tutorName || '—',
          student_name: studentName,
          session_date: bk.date || '—',
          session_time: bk.timeLbl || '—',
          platform: 'Skillak'
        });
      }
    } catch(e) {}
  }, 1500);
};

/* ══════════════════════════════════════════════════════
   7. تحسينات واجهة لوحة الأدمن — تبويبات إضافية
   ══════════════════════════════════════════════════════ */

/* Inject extra admin tabs if not present */
function _p4_injectAdminTabs() {
  const tabsRow = document.querySelector('.adminTabs, #adTabs, .admin-tabs');
  if (!tabsRow) return; // Handled in HTML already, skip

  // Add commission and reports tabs if missing
  if (!document.querySelector('.adminTab[onclick*="commission"]')) {
    const commBtn = document.createElement('button');
    commBtn.className = 'btn btn-gh btn-sm adminTab';
    commBtn.textContent = '💹 العمولة';
    commBtn.onclick = () => { if (typeof adTab === 'function') adTab('commission', commBtn); };
    tabsRow.appendChild(commBtn);
  }
}

/* ══════════════════════════════════════════════════════
   8. تحسينات جلسة — session bar محسّن
   ══════════════════════════════════════════════════════ */

/* Live session countdown in sesbar */
let _p4_sesBarTimer = null;

function _p4_startSesBarCountdown(bk) {
  const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : 0;
  if (!endMs) return;

  if (_p4_sesBarTimer) clearInterval(_p4_sesBarTimer);
  _p4_sesBarTimer = setInterval(() => {
    const countdown = _p4.e('sesCountdown');
    if (!countdown) { clearInterval(_p4_sesBarTimer); return; }

    const rem = endMs - Date.now();
    if (rem <= 0) {
      countdown.textContent = '⏰ انتهى الوقت';
      countdown.classList.add('expired');
      clearInterval(_p4_sesBarTimer);
      return;
    }
    const m = Math.floor(rem / 60000);
    const s = Math.floor((rem % 60000) / 1000);
    countdown.textContent = `⏱️ ${m}:${String(s).padStart(2,'0')} متبقي`;
    countdown.classList.toggle('warning', rem < 5 * 60000);
  }, 1000);
}

/* Inject countdown element into sesbar */
function _p4_injectSesbarCountdown(bk) {
  const sesbar = document.querySelector('.sesbar');
  if (!sesbar || sesbar.querySelector('#sesCountdown')) return;

  const cd = document.createElement('div');
  cd.id = 'sesCountdown';
  cd.className = 'ses-countdown';
  cd.textContent = '⏱️ ...';
  sesbar.appendChild(cd);
  _p4_startSesBarCountdown(bk);
}

const _p4_origEnter2 = window.enterSession;
window.enterSession = async function(bookingId) {
  const result = typeof _p4_origEnter2 === 'function' ? await _p4_origEnter2(bookingId) : undefined;
  setTimeout(async () => {
    const bk = typeof curSesBk !== 'undefined' ? curSesBk : null;
    if (bk) _p4_injectSesbarCountdown(bk);
  }, 2000);
  return result;
};

/* ══════════════════════════════════════════════════════
   9. Session "Sessions" tab — refresh after actions
   ══════════════════════════════════════════════════════ */

/* Auto-refresh sessions list when a booking changes status */
function _p4_watchBookingStatus() {
  if (!CU) return;
  const uid = CU.uid;
  // Listen to student bookings
  db.collection('bookings').where('studentId', '==', uid)
    .onSnapshot(() => {
      // If sessions tab is open, quietly refresh
      const dash = _p4.e('dashCon');
      if (dash && typeof dashTab !== 'undefined' && dashTab === 'sessions') {
        if (typeof dNav === 'function') setTimeout(() => dNav('sessions'), 500);
      }
    }, () => {});
}

/* ══════════════════════════════════════════════════════
   10. تحسين الملف الشخصي للأدمن — إضافة قسم البريد
   ══════════════════════════════════════════════════════ */

/* Add EmailJS setup guide in admin commission tab */
const _p4_origAdTab2 = window.adTab;
window.adTab = async function(tab, el) {
  const res = typeof _p4_origAdTab2 === 'function' ? await _p4_origAdTab2(tab, el) : undefined;

  if (tab === 'commission') {
    setTimeout(() => {
      const con = _p4.e('adCon');
      if (!con || con.querySelector('.p4-email-setup')) return;

      const emailGuide = document.createElement('div');
      emailGuide.className = 'p4-email-setup card';
      emailGuide.style.cssText = 'margin-top:18px';
      emailGuide.innerHTML = `
        <div class="ch">
          <div class="ct">📧 إعداد البريد الإلكتروني التلقائي</div>
          <span class="pill ${_p4_EMAIL.enabled ? 'pc' : 'pp'}">${_p4_EMAIL.enabled ? '✅ مفعّل' : '⏳ غير مفعّل'}</span>
        </div>
        <div class="cb">
          <p style="font-size:.83rem;color:var(--muted);line-height:1.8">
            لتفعيل إرسال بريد إلكتروني تلقائي للطلاب والمعلمين عند الحجز والموافقة:
          </p>
          <ol style="font-size:.82rem;line-height:2;padding-right:18px;color:#374151">
            <li>اذهب إلى <a href="https://www.emailjs.com" target="_blank" style="color:var(--teal)">emailjs.com</a> وأنشئ حساب مجاني</li>
            <li>أنشئ Service (Gmail/Outlook) وTemplate يحتوي متغيرات: <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">to_email, to_name, subject, message</code></li>
            <li>افتح ملف <code style="background:#f3f4f6;padding:2px 6px;border-radius:4px">patch4.js</code> وعدّل الثوابت في أعلى الملف:</li>
          </ol>
          <div style="background:#1e293b;border-radius:10px;padding:14px;font-family:monospace;font-size:.78rem;color:#e2e8f0;margin:10px 0;direction:ltr;text-align:left">
            <div style="color:#94a3b8">// في patch4.js — ابحث عن _p4_EMAIL</div>
            serviceId:  '<span style="color:#4ade80">service_xxxxxxx</span>',<br>
            templateId: '<span style="color:#4ade80">template_xxxxxxx</span>',<br>
            publicKey:  '<span style="color:#4ade80">xxxxxxxxxxxxxxxxxxx</span>',<br>
            enabled: <span style="color:#fb923c">true</span>
          </div>
          <p style="font-size:.75rem;color:var(--muted)">✉️ بريد المنصة:mahmoud.hamed.ahmed25@gmail.com</p>
        </div>`;
      con.appendChild(emailGuide);
    }, 200);
  }



  if (tab === 'bookings') {
    setTimeout(_p4_injectBulkPayButton, 400);
  }
  return res;
};

/* ══════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Start booking watcher after login
  setTimeout(() => {
    if (typeof CU !== 'undefined' && CU) {
      _p4_watchBookingStatus();
    }
  }, 4000);
});

/* After login */
const _p4_origUpdNavU = window.updNavU;
window.updNavU = function() {
  if (typeof _p4_origUpdNavU === 'function') _p4_origUpdNavU();
  setTimeout(() => {
    _p4_watchBookingStatus();
  }, 1000);
};

console.log('✅ Skillak patch4.js v6.0 loaded | mahmoud.hamed.ahmed25@gmail.com');
