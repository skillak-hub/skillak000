/* ══════════════════════════════════════════════════════════════════════
   skillak_hotfix.js — v5.0  (نظيف — بدون تكرار)
   ══════════════════════════════════════════════════════════════════════
   - الإعلانات ثابتة أعلى لوحة التحكم (sklAnnBar فوق dashlay في HTML)
   - تُحمَّل من adminBroadcasts مباشرةً عبر onSnapshot حي
   - تظهر فقط بعد تسجيل الدخول
   - doFgt / doChangePwd / p4ChangeEmail مُصلَّحة
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── UTIL ────────────────────────────────────────────────────── */
  function byId(id) { return document.getElementById(id); }
  function esc(v) {
    return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function showToast(msg, type) {
    if (typeof window.showT === 'function') window.showT(msg, type);
  }
  function waitFor(fn, cb, ms, n) {
    ms = ms||120; n = n===undefined?120:n;
    if (fn()) return cb();
    if (!n) return;
    setTimeout(function(){ waitFor(fn,cb,ms,n-1); }, ms);
  }
  function currentUser() {
    return window.firebase && window.firebase.auth && window.firebase.auth().currentUser;
  }

  /* ─── ANNOUNCEMENT BAR ────────────────────────────────────────── */
  /* sklAnnBar مبنيّ في HTML فوق dashlay تماماً — لا ينهار أبداً */

  var _annUnsub = null;   /* Firestore listener */
  var _annItems = [];     /* آخر قائمة إعلانات */

  /* يُستدعى مرة واحدة بعد تسجيل الدخول */
  function initAnnouncements(uid) {
    /* إيقاف المستمع القديم إن وُجد */
    if (_annUnsub) { try { _annUnsub(); } catch(_){} _annUnsub = null; }

    /* استمع لـ adminBroadcasts مباشرةً — لا نحتاج فلتر toUid */
    _annUnsub = db.collection('adminBroadcasts')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(function(snap) {
        _annItems = snap.docs.map(function(d){ return Object.assign({id:d.id}, d.data()); });
        renderAnnBar();
      }, function(err) {
        console.warn('[Skillak] announcements error:', err.message || err);
      });
  }

  function renderAnnBar() {
    var bar = byId('sklAnnBar');
    if (!bar) return;

    if (!_annItems.length) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      return;
    }

    bar.className = 'skl-ann-bar';
    bar.style.cssText = [
      'display:block',
      'width:100%',
      'padding:0',
      'box-sizing:border-box',
      'background:transparent',
    ].join(';');

    var readSet = _getReadSet();
    var unread  = _annItems.filter(function(x){ return !readSet[x.id]; }).length;

    bar.innerHTML =
      '<section class="skl-ann-shell">'
      + '<div class="skl-ann-head">'
      + '<div class="skl-ann-title-wrap">'
      + '<span class="skl-ann-ic">📢</span>'
      + '<div>'
      + '<div class="skl-ann-title">الإعلانات</div>'
      + '<div class="skl-ann-sub">آخر التحديثات والتنبيهات المهمة</div>'
      + '</div>'
      + (unread ? '<span class="skl-ann-badge">' + unread + ' جديد</span>' : '')
      + '</div>'
      + '<button type="button" class="skl-ann-mark" onclick="_sklMarkAllRead()">تحديد كمقروء</button>'
      + '</div>'
      + '<div class="skl-ann-track">'
      + _annItems.map(function(item, idx) {
          var isRead = !!readSet[item.id];
          var bg     = item.imageUrl
            ? 'background:url(' + esc(item.imageUrl) + ') center/cover no-repeat,#0d47a1'
            : 'background:linear-gradient(135deg,#0d2355 0%,#1565c0 55%,#1976d2 100%)';
          var cls    = 'skl-ann-card' + (isRead ? ' is-read' : ' is-unread');
          var title   = esc(item.title || 'إعلان');
          var message = esc((item.message || '').slice(0, 70));
          var link    = item.link ? '<a class="skl-ann-link" href="' + esc(item.link) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">معرفة المزيد</a>' : '';

          return '<article class="' + cls + '" onclick="_sklOpenStory(' + idx + ')" style="' + bg + '">'
            + (!isRead
               ? '<div class="skl-ann-dot" aria-hidden="true"></div>'
               : '')
            + '<div class="skl-ann-overlay">'
            + '<div class="skl-ann-card-title">' + title + '</div>'
            + '<div class="skl-ann-card-text">' + message + '</div>'
            + link
            + '</div>'
            + '</article>';
        }).join('')
      + '</div>'
      + '</section>';

    window._sklAnnItems = _annItems;
  }

  /* ── تخزين الإعلانات المقروءة في localStorage ── */
  function _getReadSet() {
    try {
      return JSON.parse(localStorage.getItem('_sklAnnRead') || '{}');
    } catch(_){ return {}; }
  }
  function _saveReadSet(obj) {
    try { localStorage.setItem('_sklAnnRead', JSON.stringify(obj)); } catch(_){}
  }

  window._sklMarkAllRead = function () {
    var s = _getReadSet();
    _annItems.forEach(function(x){ s[x.id] = true; });
    _saveReadSet(s);
    renderAnnBar();
    showToast('تم تحديد الكل كمقروء', 'suc');
  };

  /* ─── STORY VIEWER ────────────────────────────────────────────── */
  var _storyIdx = 0;

  window._sklOpenStory = window.sklOpenStory = function(idx) {
    _storyIdx = idx || 0;
    var v = byId('sklStoryViewer');
    if (!v) return;
    v.style.display = 'block';
    document.body.style.overflow = 'hidden';
    _renderStory();

    /* سجّل كمقروء */
    var items = window._sklAnnItems || _annItems;
    if (items[_storyIdx]) {
      var s = _getReadSet(); s[items[_storyIdx].id] = true; _saveReadSet(s);
      setTimeout(renderAnnBar, 200);
    }
  };

  window.sklCloseStory = function() {
    var v = byId('sklStoryViewer');
    if (v) v.style.display = 'none';
    document.body.style.overflow = '';
    document.onkeydown = null;
  };

  window.sklStoryNav = function(dir) {
    var items = window._sklAnnItems || _annItems;
    if (!items.length) return;
    _storyIdx = (_storyIdx + dir + items.length) % items.length;
    _renderStory();
  };

  function _renderStory() {
    var items = window._sklAnnItems || _annItems;
    if (!items.length) { window.sklCloseStory(); return; }
    var item = items[_storyIdx];
    var prog = byId('sklStoryProg');
    var con  = byId('sklStoryContent');
    if (!prog || !con) return;

    prog.innerHTML = items.map(function(_,i){
      return '<div style="flex:1;height:3px;border-radius:2px;background:'
        + (i < _storyIdx ? '#fff' : i === _storyIdx ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.22)') + '"></div>';
    }).join('');

    var dt = item.createdAt && item.createdAt.toDate
      ? item.createdAt.toDate().toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'}) : '';

    var bg = item.imageUrl
      ? 'background:url(' + esc(item.imageUrl) + ') center/cover no-repeat #111'
      : 'background:linear-gradient(160deg,#030c20 0%,#0d47a1 50%,#1565c0 100%)';

    con.innerHTML = '<div style="width:100%;height:100%;' + bg + ';position:relative;display:flex;flex-direction:column;justify-content:flex-end">'
      + '<div style="position:absolute;top:64px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px">'
      + '<div style="width:50px;height:50px;border-radius:50%;background:rgba(249,115,22,.25);border:2px solid rgba(249,115,22,.6);display:flex;align-items:center;justify-content:center;font-size:1.4rem">📢</div>'
      + '<div style="color:rgba(255,255,255,.7);font-size:.72rem;text-align:center">' + esc(dt) + '</div>'
      + '</div>'
      + '<div style="padding:24px 24px 52px;background:linear-gradient(to top,rgba(0,0,0,.9) 0%,rgba(0,0,0,.55) 60%,transparent 100%)">'
      + '<div style="color:#f97316;font-size:.72rem;font-weight:700;letter-spacing:.06em;margin-bottom:8px">SKILLAK · إعلان رسمي</div>'
      + '<div style="color:#fff;font-weight:900;font-size:clamp(1.1rem,4vw,1.45rem);line-height:1.35;margin-bottom:10px">' + esc(item.title||'') + '</div>'
      + '<div style="color:rgba(255,255,255,.85);font-size:.9rem;line-height:1.65;white-space:pre-wrap">' + esc(item.message||'') + '</div>'
      + (item.link
         ? '<a href="' + esc(item.link) + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-top:14px;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;border-radius:12px;padding:10px 20px;font-size:.85rem;font-weight:700;text-decoration:none">🔗 معرفة المزيد</a>'
         : '')
      + '<div style="margin-top:14px;display:flex;gap:5px">'
      + items.map(function(_,i){
          return '<div style="width:' + (i===_storyIdx?'24px':'8px') + ';height:4px;border-radius:2px;'
            + 'background:' + (i===_storyIdx?'#f97316':'rgba(255,255,255,.35)') + ';transition:all .3s"></div>';
        }).join('')
      + '</div></div></div>';

    /* تنقل بالكيبورد */
    document.onkeydown = function(e) {
      var v = byId('sklStoryViewer');
      if (!v || v.style.display==='none') return;
      if (e.key==='ArrowLeft')  window.sklStoryNav(1);
      if (e.key==='ArrowRight') window.sklStoryNav(-1);
      if (e.key==='Escape')     window.sklCloseStory();
    };

    /* swipe */
    var sx = null;
    con.ontouchstart = function(e){ sx = e.touches[0].clientX; };
    con.ontouchend   = function(e){
      if (sx===null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) window.sklStoryNav(dx > 0 ? 1 : -1);
      sx = null;
    };
  }

  /* ─── PASSWORD RESET (doFgt) ──────────────────────────────────── */
  window.doFgt = async function () {
    try {
      var emailEl = byId('liE');
      var email = emailEl ? emailEl.value.trim() : '';

      if (!email || !email.includes('@')) {
        var prompted = prompt('أدخل بريدك الإلكتروني لإرسال رابط إعادة تعيين كلمة المرور:');
        if (!prompted) return;
        email = prompted.trim();
        if (!email.includes('@')) { showToast('أدخل بريدًا صحيحًا', 'err'); return; }
        if (emailEl) emailEl.value = email;
      }

      var fgtBtn = byId('fgtBtn');
      if (fgtBtn) { fgtBtn.style.pointerEvents = 'none'; fgtBtn.textContent = '⏳ جاري الإرسال...'; }

      await firebase.auth().sendPasswordResetEmail(email);

      showToast('✅ تم إرسال رابط إعادة التعيين إلى ' + email, 'suc');

      /* أظهر رسالة نجاح في الـ modal */
      var msgEl = byId('liMsg');
      if (msgEl) {
        msgEl.textContent = '📧 تم إرسال رابط إعادة تعيين كلمة المرور إلى ' + email;
        msgEl.style.cssText = 'display:block;color:#059669;background:rgba(16,185,129,.1);padding:10px 14px;border-radius:10px;font-size:.83rem;margin-top:8px';
      }
    } catch (e) {
      var map = {
        'auth/user-not-found'       : 'لا يوجد حساب بهذا البريد الإلكتروني',
        'auth/invalid-email'        : 'البريد الإلكتروني غير صالح',
        'auth/too-many-requests'    : 'محاولات كثيرة — انتظر دقيقة',
        'auth/network-request-failed': 'تحقق من الاتصال بالإنترنت',
      };
      var msg = map[e.code] || e.message || 'حدث خطأ';
      showToast('❌ ' + msg, 'err');
    } finally {
      var fgtBtn2 = byId('fgtBtn');
      if (fgtBtn2) { fgtBtn2.style.pointerEvents = ''; fgtBtn2.textContent = 'نسيت كلمة المرور؟'; }
    }
  };

  /* ─── CHANGE PASSWORD (doChangePwd) ──────────────────────────── */
  window.doChangePwd = async function () {
    var cur  = _fv('epCurPwd');
    var nw   = _fv('epNewPwd');
    var cnf  = _fv('epConfPwd');
    var msg  = byId('epPwdMsg');
    var btn  = byId('epPwdBtn');

    if (!cur)          { _showMsg(msg,'أدخل كلمة مرورك الحالية','err'); return; }
    if (nw.length < 6) { _showMsg(msg,'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل','err'); return; }
    if (nw !== cnf)    { _showMsg(msg,'كلمتا المرور الجديدتان غير متطابقتين','err'); return; }

    _setBtnLoad(btn, true, 'تغيير كلمة المرور');
    try {
      await _reauth(cur);
      await firebase.auth().currentUser.updatePassword(nw);
      _showMsg(msg,'✅ تم تغيير كلمة المرور بنجاح','suc');
      showToast('✅ تم تغيير كلمة المرور','suc');
      _clearFields(['epCurPwd','epNewPwd','epConfPwd']);
    } catch(e) {
      _showMsg(msg,'❌ ' + _authErr(e),'err');
    } finally {
      _setBtnLoad(btn, false, 'تغيير كلمة المرور');
    }
  };

  /* ─── CHANGE EMAIL (doChangeEmail) ───────────────────────────── */
  window.doChangeEmail = async function () {
    var email = _fv('epNewEmail').trim();
    var pass  = _fv('epCurPwd4Em');
    var msg   = byId('epEmailMsg');
    var btn   = byId('epEmailBtn');

    if (!email.includes('@')) { _showMsg(msg,'أدخل بريدًا إلكترونياً صحيحًا','err'); return; }
    if (!pass) { _showMsg(msg,'أدخل كلمة مرورك الحالية للتحقق','err'); return; }

    _setBtnLoad(btn, true, 'تغيير البريد');
    try {
      await _reauth(pass);
      await firebase.auth().currentUser.updateEmail(email);
      await db.collection('users').doc(firebase.auth().currentUser.uid).update({email:email});
      _showMsg(msg,'✅ تم تغيير البريد الإلكتروني بنجاح','suc');
      showToast('✅ تم تغيير البريد الإلكتروني','suc');
      _clearFields(['epNewEmail','epCurPwd4Em']);
    } catch(e) {
      _showMsg(msg,'❌ ' + _authErr(e),'err');
    } finally {
      _setBtnLoad(btn, false, 'تغيير البريد');
    }
  };

  /* ─── AUTH HELPERS ────────────────────────────────────────────── */
  async function _reauth(pass) {
    var user = firebase.auth().currentUser;
    if (!user || !user.email) throw new Error('يجب تسجيل الدخول أولاً');
    var Cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
    await user.reauthenticateWithCredential(Cred);
  }

  function _fv(id)  { var el=byId(id); return el?el.value:''; }
  function _clearFields(ids) { ids.forEach(function(id){var el=byId(id);if(el)el.value='';}); }
  function _setBtnLoad(btn, on, label) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.textContent = on ? 'جاري...' : (label || btn.dataset.label || 'حفظ');
  }
  function _showMsg(el, txt, type) {
    if (!el) return;
    el.textContent = txt;
    el.style.cssText = 'display:block;font-size:.82rem;padding:8px 12px;border-radius:10px;margin-bottom:8px;'
      + (type==='suc' ? 'background:rgba(16,185,129,.1);color:#059669'
         : type==='err' ? 'background:rgba(239,68,68,.1);color:#dc2626'
         : 'background:rgba(21,101,192,.1);color:#1565c0');
    if (type !== 'inf') setTimeout(function(){if(el)el.style.display='none';}, 6000);
  }
  function _authErr(e) {
    return ({
      'auth/wrong-password'        : 'كلمة المرور الحالية غير صحيحة',
      'auth/email-already-in-use'  : 'هذا البريد مستخدم بالفعل',
      'auth/invalid-email'         : 'البريد الإلكتروني غير صالح',
      'auth/requires-recent-login' : 'سجّل الخروج وأعد الدخول ثم حاول',
      'auth/too-many-requests'     : 'محاولات كثيرة — انتظر قليلاً',
      'auth/network-request-failed': 'تحقق من اتصالك بالإنترنت',
      'auth/invalid-credential'    : 'بيانات الاعتماد غير صحيحة',
      'auth/user-not-found'        : 'لا يوجد حساب بهذا البريد',
    })[e.code] || e.message || 'حدث خطأ';
  }

  /* ─── BOOT ────────────────────────────────────────────────────── */
  waitFor(
    function(){ return typeof firebase !== 'undefined' && typeof db !== 'undefined'; },
    function() {
      firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
          initAnnouncements(user.uid);
        } else {
          if (_annUnsub) { try{_annUnsub();}catch(_){} _annUnsub=null; }
          var bar = byId('sklAnnBar');
          if (bar) bar.style.display = 'none';
        }
      });
    }
  );

  /* عرّف window.loadDashAnnouncements للتوافق مع patch_master */
  window.loadDashAnnouncements = function(uid) {
    /* لا شيء — initAnnouncements يعمل تلقائياً عبر onAuthStateChanged */
  };

})();
