/* ═══════════════════════════════════════════════════════════════════
   patch_v9.js — Skillak Platform v9.0
   ═══════════════════════════════════════════════════════════════════
   ✅ 1. إخفاء زر إنهاء الجلسة الأحمر نهائياً عن الطالب
   ✅ 2. زر "مغادرة مؤقتة" للطالب (لا يُنهي الجلسة)
   ✅ 3. المعلم فقط يملك صلاحية الإنهاء الرسمي
   ✅ 4. شاشة بداية احترافية بلوجو Skillak
   ✅ 5. بانر تثبيت PWA بلوجو الموقع
   ✅ 6. غرفة انتظار احترافية مع عداد تنازلي
   ✅ 7. إشعار فوري للمعلم عند طلب جلسة جديدة
   ✅ 8. مؤشر جودة الاتصال في شريط الجلسة
   ✅ 9. حماية من إغلاق التبويب عرضياً أثناء الجلسة
   ✅ 10. تحسينات شاملة للواجهة
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── helpers ─── */
const _p9 = {
  e:     id  => document.getElementById(id),
  getCU: ()  => { try { return typeof CU !== 'undefined' ? CU  : null; } catch(_){ return null; } },
  getCP: ()  => { try { return typeof CP !== 'undefined' ? CP  : null; } catch(_){ return null; } },
  getDb: ()  => { try { return typeof db !== 'undefined' ? db  : null; } catch(_){ return null; } },
  toast: (msg, type='') => { if (typeof showT === 'function') showT(msg, type); },
  go:    name => { if (typeof go === 'function') go(name); },
};

/* ══════════════════════════════════════════════════════════════════
   1. شاشة البداية الاحترافية (Splash Screen)
   ══════════════════════════════════════════════════════════════════ */
(function _p9_initSplash() {
  const ld = _p9.e('loadScreen');
  if (!ld) return;

  /* رسائل متناوبة في شريط التحميل */
  const msgs   = ['جاري التحميل...', 'تجهيز المنصة...', 'اتصال بالخوادم...', 'مرحباً في Skillak 🎓'];
  let mi       = 0;
  const subEl  = ld.querySelector('.skl-splash-sub');
  const msgInt = setInterval(() => {
    if (!subEl || !subEl.isConnected) { clearInterval(msgInt); return; }
    subEl.style.opacity = '0';
    setTimeout(() => {
      if (subEl.isConnected) {
        subEl.textContent = msgs[mi++ % msgs.length];
        subEl.style.opacity = '1';
      }
    }, 250);
  }, 1400);

  /* إخفاء الشاشة بعد التحميل */
  const hideSplash = () => {
    clearInterval(msgInt);
    ld.classList.add('fading');
    setTimeout(() => {
      if (ld.isConnected) {
        ld.style.display = 'none';
        ld.remove();
      }
    }, 520);
  };

  window.addEventListener('load', () => setTimeout(hideSplash, 700), { once: true });
  setTimeout(hideSplash, 7000); /* خط أمان */
})();

/* ══════════════════════════════════════════════════════════════════
   2. بانر تثبيت PWA بلوجو Skillak
   ══════════════════════════════════════════════════════════════════ */
let _p9_deferredPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _p9_deferredPrompt = e;
  /* عرض البانر بعد 4 ثوانٍ */
  setTimeout(_p9_showInstallBanner, 4000);
});

function _p9_showInstallBanner() {
  if (!_p9_deferredPrompt || _p9.e('p9InstallBanner')) return;

  const banner = document.createElement('div');
  banner.id        = 'p9InstallBanner';
  banner.className = 'pwa-install-banner';
  banner.innerHTML = `
    <img src="icon-192.png" class="pwa-banner-icon" alt="Skillak"
      onerror="this.src='skillak.png'">
    <div class="pwa-banner-text">
      <div class="pwa-banner-title">ثبّت تطبيق Skillak</div>
      <div class="pwa-banner-sub">يعمل بدون إنترنت · أسرع · أفضل تجربة</div>
    </div>
    <button class="pwa-banner-btn" id="p9InstallBtn">تثبيت</button>
    <button class="pwa-banner-close" onclick="document.getElementById('p9InstallBanner')?.remove()">✕</button>
  `;

  document.body.appendChild(banner);

  _p9.e('p9InstallBtn')?.addEventListener('click', async () => {
    if (!_p9_deferredPrompt) return;
    _p9_deferredPrompt.prompt();
    const { outcome } = await _p9_deferredPrompt.userChoice;
    _p9_deferredPrompt = null;
    banner.remove();
    if (outcome === 'accepted') {
      _p9.toast('✅ تم تثبيت Skillak بنجاح! 🎉', 'suc');
    }
  });

  /* إخفاء تلقائي بعد 12 ثانية */
  setTimeout(() => banner.isConnected && banner.remove(), 12000);
}

/* iOS: عرض دليل يدوي */
(function _p9_iosInstallHint() {
  const isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStand   = window.navigator.standalone;
  const shown     = sessionStorage.getItem('p9_ios_hint');
  if (!isIOS || isStand || shown) return;

  setTimeout(() => {
    const hint = document.createElement('div');
    hint.style.cssText = `
      position:fixed;bottom:76px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#0a0a1a,#0d1a2e);
      border:1px solid rgba(255,255,255,.12);
      border-radius:18px;padding:14px 18px;
      display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 36px rgba(0,0,0,.55);
      z-index:9998;max-width:340px;width:92%;
      font-family:'Cairo',sans-serif;font-size:.82rem;color:#fff;
      animation:sklBannerSlide .4s ease;
    `;
    hint.innerHTML = `
      <img src="icon-192.png" style="width:40px;height:40px;border-radius:11px" alt="">
      <div style="flex:1;line-height:1.65">
        <strong style="font-size:.88rem">ثبّت Skillak على iPhone</strong><br>
        <span style="color:rgba(255,255,255,.55)">اضغط <strong>⬆️</strong> ثم اختر <strong>«إضافة للشاشة الرئيسية»</strong></span>
      </div>
      <button onclick="this.closest('div').remove()" style="background:none;border:none;color:rgba(255,255,255,.35);font-size:1.1rem;cursor:pointer">✕</button>
    `;
    document.body.appendChild(hint);
    sessionStorage.setItem('p9_ios_hint', '1');
    setTimeout(() => hint.isConnected && hint.remove(), 9000);
  }, 5000);
})();

/* ══════════════════════════════════════════════════════════════════
   3. إخفاء زر الإنهاء عن الطالب — ثلاث طبقات حماية
   ══════════════════════════════════════════════════════════════════ */

function _p9_applySessionRoleControls() {
  const endBtn  = _p9.e('endBtn');
  const endWrap = endBtn?.closest?.('.cwrap');
  const exitWrap = _p9.e('studentExitWrap');
  const sesPage = _p9.e('page-session');

  if (endBtn)  endBtn.style.setProperty('display', 'none', 'important');
  if (endWrap) endWrap.style.setProperty('display', 'none', 'important');
  if (exitWrap) {
    exitWrap.style.setProperty('display', 'flex', 'important');
    exitWrap.style.alignItems = 'center';
    exitWrap.style.flexDirection = 'column';
  }
  if (sesPage)  sesPage.setAttribute('data-session-live', '1');
  _p9.e('p9StudentNote')?.remove();
}

window._p9_cleanupSessionUi = function() {
  try { if (typeof pc !== 'undefined' && pc) { pc.close(); window.pc = null; } } catch(e) {}
  try { if (typeof locSt !== 'undefined' && locSt) { locSt.getTracks().forEach(t => t.stop()); window.locSt = null; } } catch(e) {}
  try { if (typeof scrSt !== 'undefined' && scrSt) { scrSt.getTracks().forEach(t => t.stop()); window.scrSt = null; } } catch(e) {}
  try { if (typeof sesTInt !== 'undefined' && sesTInt) { clearInterval(sesTInt); window.sesTInt = null; } } catch(e) {}
  try { if (typeof sesChatL !== 'undefined' && sesChatL) { sesChatL(); window.sesChatL = null; } } catch(e) {}
};

/* ══════════════════════════════════════════════════════════════════
   4. وظيفة مغادرة الطالب المؤقتة
   ══════════════════════════════════════════════════════════════════ */
window.studentExitSession = async function(bookingId) {
  if (!confirm('هل تريد مغادرة الجلسة مؤقتاً?\nيمكنك العودة إليها قبل انتهاء الوقت المحدد.')) return;

  const _db  = _p9.getDb();
  const bid  = bookingId || ((typeof curSesBid !== 'undefined') ? curSesBid : null);
  const bk   = (typeof curSesBk  !== 'undefined') ? curSesBk  : null;

  if (!bid || !_db) return;

  /* تنظيف WebRTC فقط إذا كانت الجلسة الحالية مفتوحة */
  if (typeof window._p9_cleanupSessionUi === 'function') window._p9_cleanupSessionUi();
  else {
    try { if (typeof pc !== 'undefined' && pc) { pc.close(); window.pc = null; } } catch(e) {}
    try { if (typeof locSt !== 'undefined' && locSt) { locSt.getTracks().forEach(t => t.stop()); window.locSt = null; } } catch(e) {}
    try { if (typeof scrSt !== 'undefined' && scrSt) { scrSt.getTracks().forEach(t => t.stop()); window.scrSt = null; } } catch(e) {}
    try { if (typeof sesTInt !== 'undefined' && sesTInt) clearInterval(sesTInt); } catch(e) {}
    try { if (typeof sesChatL !== 'undefined' && sesChatL) sesChatL(); } catch(e) {}
  }

  /* تحديث حالة الحجز إلى paused */
  try {
    const endMs = (typeof getBookingEndMs === 'function')
      ? getBookingEndMs(bk || {})
      : (bk?.sessionEndsAtMs || 0);

    await _db.collection('bookings').doc(bid).set({
      status: 'paused',
      lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
      pausedBy: (typeof CU !== 'undefined' && CU?.uid) ? CU.uid : null,
      ...(endMs ? { sessionEndsAtMs: endMs } : {})
    }, { merge: true });

    await _db.collection('sessions').doc(bid).set({
      status: 'paused',
      pausedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).catch(() => {});
  } catch(e) { console.warn('[p9] studentExit:', e); }

  if (typeof curSesBid !== 'undefined' && curSesBid === bid) {
    try { window.curSesBid = null; } catch(e) {}
    try { window.curSesBk  = null; } catch(e) {}
    window.removeEventListener('beforeunload', _p9_beforeUnloadHandler);
    const mainNav = _p9.e('mainNav');
    if (mainNav) mainNav.style.display = '';
    _p9.e('p9StudentNote')?.remove();
    _p9.go('dashboard');
    setTimeout(() => { if (typeof dNav === 'function') dNav('sessions'); }, 350);
  }

  _p9.toast('🚪 غادرت الجلسة مؤقتاً — يمكنك العودة من "جلساتي"', 'inf');
};

/* ══════════════════════════════════════════════════════════════════
   5. Hook على enterSession
   ══════════════════════════════════════════════════════════════════ */
const _p9_origEnter = window.enterSession;
window.enterSession = async function(bookingId) {
  /* إخفاء زر الإنهاء فقط قبل الدخول، وإظهار زر الخروج داخل الجلسة */
  const endWrap  = _p9.e('endBtn')?.closest?.('.cwrap');
  const exitWrap = _p9.e('studentExitWrap');
  if (endWrap)  endWrap.style.display = 'none';
  if (exitWrap) exitWrap.style.display = 'flex';

  let result;
  try {
    result = typeof _p9_origEnter === 'function' ? await _p9_origEnter(bookingId) : undefined;
  } catch(e) {
    _p9.toast('❌ تعذر الدخول للجلسة: ' + e.message, 'err');
    return;
  }

  /* بعد الدخول — تطبيق قواعد الأدوار */
  setTimeout(() => {
    _p9_applySessionRoleControls();
    _p9_enhanceWaitingRoom();
    _p9_setupBeforeUnloadGuard();
    _p9_enhanceSesBar();
  }, 700);

  return result;
};

/* ══════════════════════════════════════════════════════════════════
   6. غرفة الانتظار الاحترافية
   ══════════════════════════════════════════════════════════════════ */
function _p9_enhanceWaitingRoom() {
  const waitOv = _p9.e('waitOv');
  if (!waitOv || waitOv.dataset.p9) return;
  waitOv.dataset.p9 = '1';

  const _CU = _p9.getCU();
  const bk  = (typeof curSesBk !== 'undefined') ? curSesBk : null;
  if (!bk) return;

  const isTutor = bk.tutorId === _CU?.uid;
  const other   = isTutor ? (bk.studentName || 'الطالب') : (bk.tutorName || 'المعلم');
  const initial = (other[0] || '?').toUpperCase();
  const endMs   = (typeof getBookingEndMs === 'function') ? getBookingEndMs(bk) : 0;
  const bgGrad  = isTutor
    ? 'linear-gradient(135deg,#1e40af,#3b82f6)'
    : 'linear-gradient(135deg,#064e3b,#059669)';

  waitOv.style.cssText = `
    position:absolute;inset:0;z-index:20;overflow-y:auto;padding:20px;
    background:linear-gradient(160deg,#0a0a1a 0%,#0d1a2e 50%,#0a1a14 100%);
    display:flex;align-items:center;justify-content:center;
  `;

  waitOv.innerHTML = `
    <div class="swr-inner">

      <!-- Logo -->
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <img src="skillak.png" alt="Skillak"
          style="height:32px;width:32px;object-fit:contain;border-radius:9px;flex-shrink:0"
          onerror="this.style.display='none'">
        <div style="font-family:'Fraunces',serif;font-size:1.4rem;font-weight:900;color:#fff;letter-spacing:-.02em">
          Skill<span style="color:#f59e0b">ak</span>
        </div>
      </div>

      <!-- Avatar -->
      <div style="position:relative;margin-bottom:10px">
        <div style="
          width:78px;height:78px;border-radius:50%;
          background:${bgGrad};
          display:flex;align-items:center;justify-content:center;
          font-size:1.9rem;font-weight:900;color:#fff;
          font-family:'Fraunces',serif;
          border:3px solid rgba(255,255,255,.18);
          box-shadow:0 0 0 7px rgba(255,255,255,.05);
        ">${initial}</div>
        <div style="
          position:absolute;bottom:2px;right:2px;
          width:16px;height:16px;border-radius:50%;
          background:var(--amber,#f59e0b);
          border:2px solid #0a0a1a;
          animation:pulse-warn 1.5s ease-in-out infinite;
        "></div>
      </div>

      <p class="swr-name">${other}</p>
      <p class="swr-role">${isTutor ? '🎓 طالب' : '👨‍🏫 معلمك'}</p>

      <!-- Info Grid -->
      <div class="swr-grid">
        <div class="swr-cell">
          <div class="swr-ic">📅</div>
          <div class="swr-val">${bk.date || '—'}</div>
          <div class="swr-lbl">التاريخ</div>
        </div>
        <div class="swr-cell">
          <div class="swr-ic">⏰</div>
          <div class="swr-val" style="font-size:.8rem">${bk.timeLbl || bk.time || '—'}</div>
          <div class="swr-lbl">الوقت</div>
        </div>
        <div class="swr-cell">
          <div class="swr-ic">⏱️</div>
          <div class="swr-val">${bk.duration || 60}</div>
          <div class="swr-lbl">دقيقة</div>
        </div>
        <div class="swr-cell">
          <div class="swr-ic">💰</div>
          <div class="swr-val">${Number(bk.price || 0).toFixed(0)}<small style="font-size:.55rem;opacity:.6"> ج.م</small></div>
          <div class="swr-lbl">الأتعاب</div>
        </div>
      </div>

      <!-- Status -->
      <div class="swr-status">
        <div class="swr-spin"></div>
        <span id="p9WaitCd">
          ${endMs ? '⏱️ جاري الحساب...' : 'في انتظار ' + other + '...'}
        </span>
      </div>

      <!-- Note -->
      <div class="swr-note">
        💡 سيبدأ الاتصال تلقائياً عند انضمام <strong>${other}</strong>.
        تأكد من منح إذن الكاميرا والميكروفون.
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:9px;justify-content:center;flex-wrap:wrap;margin-top:4px">
        <button onclick="_p9_retryConn()"
          style="background:rgba(13,110,117,.22);color:#fff;border:1px solid rgba(13,110,117,.4);
                 border-radius:12px;padding:10px 20px;font-size:.82rem;cursor:pointer;
                 font-family:'Cairo',sans-serif;font-weight:700;transition:all .2s">
          🔄 إعادة الاتصال
        </button>
      </div>

      <p class="swr-tip">للحصول على أفضل جودة، استخدم واي فاي واغلق التطبيقات الأخرى</p>
    </div>
  `;

  /* عداد تنازلي */
  if (endMs) {
    const cdEl = _p9.e('p9WaitCd');
    const tick = () => {
      if (!cdEl?.isConnected) return;
      const rem = endMs - Date.now();
      if (rem <= 0) { cdEl.textContent = '⏰ انتهى وقت الجلسة'; return; }
      const h = Math.floor(rem / 3600000);
      const m = Math.floor((rem % 3600000) / 60000);
      const s = Math.floor((rem % 60000) / 1000);
      const str = h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${m}:${String(s).padStart(2,'0')}`;
      cdEl.textContent = `⏱️ متبقي من الجلسة: ${str}`;
    };
    tick();
    const _int = setInterval(() => {
      if (!_p9.e('p9WaitCd')) { clearInterval(_int); return; }
      tick();
    }, 1000);
  }
}

window._p9_retryConn = async function() {
  const bid = (typeof curSesBid !== 'undefined') ? curSesBid : null;
  if (!bid) return;
  _p9.toast('🔄 جاري إعادة الاتصال...', 'inf');
  try {
    if (typeof pc !== 'undefined' && pc) { pc.close(); window.pc = null; }
    /* إعادة الدخول للجلسة */
    const fn = _p9_origEnter || window.enterSession;
    if (typeof fn === 'function') await fn(bid);
  } catch(e) {
    _p9.toast('تعذرت إعادة الاتصال: ' + e.message, 'err');
  }
};

/* ══════════════════════════════════════════════════════════════════
   7. حماية من إغلاق التبويب عرضياً
   ══════════════════════════════════════════════════════════════════ */
let _p9_guardActive = false;

function _p9_beforeUnloadHandler(e) {
  const sp = _p9.e('page-session');
  if (!sp || sp.classList.contains('hidden')) return;
  e.preventDefault();
  return (e.returnValue = 'أنت في جلسة نشطة. هل أنت متأكد من الخروج؟');
}

function _p9_setupBeforeUnloadGuard() {
  if (_p9_guardActive) return;
  _p9_guardActive = true;
  window.addEventListener('beforeunload', _p9_beforeUnloadHandler);
}

/* إيقاف الحماية عند الإنهاء */
const _p9_origEnd = window.endSession;
window.endSession = async function() {
  _p9_guardActive = false;
  window.removeEventListener('beforeunload', _p9_beforeUnloadHandler);
  _p9.e('p9StudentNote')?.remove();
  return typeof _p9_origEnd === 'function' ? _p9_origEnd.apply(window, arguments) : undefined;
};

/* ══════════════════════════════════════════════════════════════════
   8. مؤشر جودة الاتصال في شريط الجلسة
   ══════════════════════════════════════════════════════════════════ */
function _p9_enhanceSesBar() {
  const sesbar = document.querySelector('.sesbar');
  if (!sesbar || sesbar.dataset.p9q) return;
  sesbar.dataset.p9q = '1';

  if (_p9.e('p9Quality')) return;

  const badge = document.createElement('div');
  badge.id = 'p9Quality';
  badge.style.cssText = `
    font-size:.71rem;font-weight:700;color:#10b981;
    background:rgba(16,185,129,.13);
    border:1px solid rgba(16,185,129,.28);
    border-radius:50px;padding:4px 10px;
    white-space:nowrap;display:flex;align-items:center;gap:5px;
    transition:all .4s;
  `;
  badge.innerHTML = `<span style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;animation:pulse-active 1.8s infinite"></span><span id="p9QualTxt">متصل</span>`;
  sesbar.appendChild(badge);

  let _qInt = setInterval(async () => {
    const peerConn = (typeof pc !== 'undefined') ? pc : null;
    if (!peerConn || !badge.isConnected) { clearInterval(_qInt); return; }
    try {
      const stats = await peerConn.getStats();
      let rtt = null;
      stats.forEach(r => {
        if (r.type === 'candidate-pair' && r.state === 'succeeded')
          rtt = r.currentRoundTripTime ?? r.roundTripTime ?? null;
      });
      if (rtt === null) return;
      const ms = Math.round(rtt * 1000);
      let color, label;
      if      (ms < 80)  { color = '#10b981'; label = `ممتاز ${ms}ms`; }
      else if (ms < 200) { color = '#f59e0b'; label = `جيد ${ms}ms`; }
      else               { color = '#ef4444'; label = `بطيء ${ms}ms`; }

      const t = _p9.e('p9QualTxt');
      if (t) t.textContent = label;
      badge.style.color = color;
      badge.style.background = `${color}22`;
      badge.style.borderColor = `${color}44`;
    } catch(e) {}
  }, 3000);
}

/* ══════════════════════════════════════════════════════════════════
   9. إشعار فوري للمعلم عند طلب جلسة جديدة
   ══════════════════════════════════════════════════════════════════ */
(function _p9_tutorAlert() {
  let _unsub = null;

  function _start() {
    const _CU = _p9.getCU(), _CP = _p9.getCP(), _db = _p9.getDb();
    if (!_CU || !_CP || !_db) return;
    if (!['tutor','both','admin'].includes(_CP.role)) return;
    if (_unsub) { try { _unsub(); } catch(e) {} }

    _unsub = _db.collection('bookings')
      .where('tutorId', '==', _CU.uid)
      .where('status', '==', 'pending')
      .onSnapshot(snap => {
        snap.docChanges().forEach(ch => {
          if (ch.type !== 'added') return;
          const bk  = ch.doc.data();
          const age = Date.now() - ((bk.createdAt?.seconds || 0) * 1000);
          if (age > 5000) return;
          _p9_showAlert(bk);
        });
      }, () => {});
  }

  function _p9_showAlert(bk) {
    _p9.e('p9TutorAlert')?.remove();
    const el = document.createElement('div');
    el.id = 'p9TutorAlert';
    el.style.cssText = `
      position:fixed;top:72px;left:50%;transform:translateX(-50%);
      background:linear-gradient(135deg,#064e3b,#059669);
      color:#fff;border-radius:18px;padding:14px 18px;
      display:flex;align-items:center;gap:12px;
      box-shadow:0 8px 32px rgba(5,150,105,.5);
      z-index:9999;max-width:360px;width:92%;
      font-family:'Cairo',sans-serif;font-size:.85rem;
      animation:sklBannerSlide .4s ease;
    `;
    el.innerHTML = `
      <img src="icon-192.png" style="width:40px;height:40px;border-radius:11px;flex-shrink:0"
        onerror="this.src='skillak.png'" alt="">
      <div style="flex:1">
        <div style="font-weight:800;font-size:.9rem;margin-bottom:2px">🔔 طلب جلسة جديد!</div>
        <div style="opacity:.85;font-size:.76rem">
          من: <strong>${bk.studentName || 'طالب'}</strong>
          · ${bk.date || ''} ${bk.timeLbl || bk.time || ''}
        </div>
      </div>
      <button onclick="this.closest('#p9TutorAlert').remove();_p9.go('dashboard');setTimeout(()=>typeof dNav==='function'&&dNav('sessions'),250)"
        style="background:rgba(255,255,255,.18);border:none;color:#fff;
               border-radius:10px;padding:7px 13px;cursor:pointer;
               font-family:'Cairo',sans-serif;font-size:.78rem;font-weight:700;white-space:nowrap">
        راجع ←
      </button>
      <button onclick="this.closest('#p9TutorAlert').remove()"
        style="background:none;border:none;color:rgba(255,255,255,.5);cursor:pointer;font-size:1.1rem;padding:3px">✕</button>
    `;
    document.body.appendChild(el);

    /* صوت إشعار */
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 660].forEach((freq, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.frequency.value = freq;
        g.gain.setValueAtTime(.25, ctx.currentTime + i*.15);
        g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + i*.15 + .25);
        osc.start(ctx.currentTime + i*.15);
        osc.stop(ctx.currentTime + i*.15 + .25);
      });
    } catch(e) {}

    setTimeout(() => el.isConnected && el.remove(), 9000);
  }

  /* ربط مع دورة حياة تسجيل الدخول */
  const _prev = window.updNavU;
  window.updNavU = function() {
    if (typeof _prev === 'function') _prev();
    setTimeout(_start, 1200);
  };
  setTimeout(_start, 2500);
})();

/* ══════════════════════════════════════════════════════════════════
   10. CSS الطبقة الأمنية لإخفاء زر الإنهاء عن الطالب
   ══════════════════════════════════════════════════════════════════ */
(function _p9_css() {
  const s = document.createElement('style');
  s.textContent = `
    /* إخفاء زر الإنهاء عن الطالب — CSS كطبقة ثانية */
    [data-student-view="1"] #endBtn,
    [data-student-view="1"] #endBtn ~ .clbl,
    [data-student-view="1"] .cwrap:has(#endBtn) {
      display: none !important;
    }
    [data-student-view="1"] #studentExitWrap {
      display: flex !important;
    }

    /* زر مغادرة الطالب */
    #studentExitBtn {
      background: linear-gradient(135deg,#d97706,#f59e0b) !important;
      box-shadow: 0 4px 16px rgba(245,158,11,.38) !important;
      width: 52px !important;
      height: 52px !important;
    }
    #studentExitBtn:active { transform: scale(.88) !important; }
    #studentExitWrap .clbl {
      color: #fbbf24 !important;
      font-weight: 700 !important;
    }

    /* تحسين sesbar */
    .sesbar {
      background: linear-gradient(90deg,#06080f,#0d1a2e) !important;
      border-bottom: 1px solid rgba(13,110,117,.18) !important;
    }

    /* تحسين sesctrls */
    .sesctrls {
      background: linear-gradient(180deg,#0b0c1c,#0f1120) !important;
      border-top: 1px solid rgba(255,255,255,.06) !important;
    }

    /* إظهار تسميات الأزرار */
    @media (min-width: 481px) {
      .clbl { display: block !important; }
    }

  `;
  document.head.appendChild(s);
})();

/* ══════════════════════════════════════════════════════════════════
   BOOT — إخفاء زر الإنهاء افتراضياً حتى نعرف الدور
   ══════════════════════════════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const endWrap = _p9.e('endBtn')?.closest?.('.cwrap');
    const exitWrap = _p9.e('studentExitWrap');
    if (endWrap) endWrap.style.display = 'none';
    if (exitWrap) exitWrap.style.display = 'flex';
  }, 400);
});





/* ══════════════════════════════════════════════════════════════════
   Support chat photo sync + single PWA banner
   ══════════════════════════════════════════════════════════════════ */
(function _skillakSupportChatPhotoSync() {
  let syncTimer = null;

  function safePhoto() {
    try {
      return (window.supportChatPhoto || window.skillakSupportChatPhoto || '').trim();
    } catch (_) {
      return '';
    }
  }

  function ensureSupportPreview() {
    const img = document.getElementById('supportChatPhotoPreview');
    if (img) {
      const p = safePhoto() || 'skillak.png';
      if (img.getAttribute('src') !== p) img.src = p;
      img.alt = safePhoto() ? 'صورة الشات' : 'لوجو المنصة';
    }
    const inp = document.getElementById('supportChatPhotoInput');
    if (inp && document.activeElement !== inp) inp.value = safePhoto();
  }

  const tryInject = () => {
    const adCon = document.getElementById('adCon');
    if (!adCon || document.getElementById('supportChatPhotoBox')) return;
    const card = document.createElement('div');
    card.id = 'supportChatPhotoBox';
    card.className = 'card';
    card.style.cssText = 'margin-top:14px;border-radius:18px;overflow:hidden';
    adCon.prepend(card);
    ensureSupportPreview();
  };

  const prevAdTab = window.adTab;
  window.adTab = async function(tab, el) {
    const res = typeof prevAdTab === 'function' ? await prevAdTab(tab, el) : undefined;
    if (tab === 'commission' || tab === 'users') {
      setTimeout(() => {
        tryInject();
        ensureSupportPreview();
      }, 250);
    }
    return res;
  };

  window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      tryInject();
      ensureSupportPreview();
    }, 600);
    syncTimer = setInterval(ensureSupportPreview, 2000);
  });

  if (typeof window.saveSupportChatPhoto !== 'function') {
    window.saveSupportChatPhoto = async function() {
      const inp = document.getElementById('supportChatPhotoInput');
      const val = String(inp?.value || '').trim();
      if (typeof CP !== 'undefined' && CP?.role !== 'admin') {
        if (typeof showT === 'function') showT('الصلاحية للمدير فقط', 'err');
        return;
      }
      try {
        await db.collection('settings').doc('platform').set({
          supportChatPhoto: val,
          supportChatPhotoUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: CU?.uid || null
        }, { merge: true });
        window.supportChatPhoto = val;
        if (typeof showT === 'function') showT('✅ تم تحديث صورة الشات', 'suc');
      } catch (e) {
        if (typeof showT === 'function') showT('تعذر حفظ صورة الشات: ' + e.message, 'err');
      }
    };
  }
})();

/* ── Single PWA banner coordination ── */
(function _skillakSingleInstallBanner() {
  try {
    sessionStorage.removeItem('p9_install_banner_seen');
  } catch (_) {}

  const seenKey = 'skillak_install_once';
  const bannerId = 'p9InstallBanner';
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return;

  let deferred = null;
  let bannerShown = false;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    // prevent the earlier banner from patch_final from showing twice
    try { window._p9_deferredPrompt = null; } catch (_) {}
    if (!bannerShown && !sessionStorage.getItem(seenKey)) {
      setTimeout(showBanner, 700);
    }
  });

  function closeBanner() {
    sessionStorage.setItem(seenKey, '1');
    document.getElementById(bannerId)?.remove();
  }

  function showBanner() {
    if (bannerShown || document.getElementById(bannerId) || sessionStorage.getItem(seenKey) === '1' || isStandalone) return;
    bannerShown = true;
    const bn = document.createElement('div');
    bn.id = bannerId;
    bn.className = 'pwa-early-banner';
    bn.innerHTML = `
      <img src="icon-192.png" class="pwa-banner-icon" alt="Skillak" onerror="this.src='skillak.png'">
      <div class="pwa-banner-text">
        <div class="pwa-banner-title">تثبيت Skillak كتطبيق</div>
        <div class="pwa-banner-sub">تثبيت الآن أو لاحقاً — تجربة أسرع على الهاتف والكمبيوتر</div>
      </div>
      <button class="pwa-banner-btn" id="p9EarlyInstallBtn">تثبيت الآن</button>
      <button class="pwa-banner-later" id="p9EarlyLaterBtn">لاحقاً</button>
    `;
    document.body.appendChild(bn);

    document.getElementById('p9EarlyLaterBtn')?.addEventListener('click', closeBanner);
    document.getElementById('p9EarlyInstallBtn')?.addEventListener('click', async () => {
      try {
        if (deferred) {
          deferred.prompt();
          const { outcome } = await deferred.userChoice;
          deferred = null;
          if (outcome === 'accepted' && typeof showT === 'function') showT('✅ تم تثبيت Skillak بنجاح! 🎉', 'suc');
          closeBanner();
          return;
        }
      } catch (e) {}

      const msg = 'التثبيت متاح عندما يدعم المتصفح PWA. افتح الموقع عبر Chrome أو Edge ثم اضغط تثبيت مرة أخرى.';
      if (typeof showT === 'function') showT(msg, 'inf');
      const hint = document.createElement('div');
      hint.id = 'p9InstallHint';
      hint.className = 'pwa-install-hint';
      hint.innerHTML = `<div style="display:flex;align-items:center;gap:10px;flex:1"><strong>⚠️</strong><span>${msg}</span></div><button id="p9InstallHintClose" style="background:rgba(255,255,255,.14);border:none;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;font-weight:700">حسناً</button>`;
      document.body.appendChild(hint);
      document.getElementById('p9InstallHintClose')?.addEventListener('click', () => hint.remove());
      setTimeout(() => hint.isConnected && hint.remove(), 7000);
    });

    setTimeout(() => { if (document.getElementById(bannerId)) closeBanner(); }, 15000);
  }

  const ready = () => setTimeout(showBanner, 700);
  if (document.readyState === 'complete' || document.readyState === 'interactive') ready();
  else window.addEventListener('DOMContentLoaded', ready, { once: true });

  // Suppress the older patch_final banner so only one appears
  try {
    const originalShow = window._p9_showInstallBanner;
    window._p9_showInstallBanner = function() {
      if (document.getElementById(bannerId) || sessionStorage.getItem(seenKey) === '1') return;
      if (typeof originalShow === 'function') return originalShow();
    };
  } catch (_) {}
})();
