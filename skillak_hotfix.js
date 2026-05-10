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



function normalizeTarget(v) {
  v = String(v || 'all').trim().toLowerCase();
  if (['all', 'everyone', 'any', 'public', 'الجميع', 'الكل', 'عام', 'عامة'].includes(v)) return 'all';
  if (['tutor', 'teacher', 'teachers', 'معلم', 'المعلم', 'المعلمين', 'معلمون', 'مدرس', 'المدرسين'].includes(v)) return 'tutor';
  if (['learner', 'student', 'students', 'طلاب', 'الطلاب', 'متعلم', 'المتعلمين', 'متعلمين', 'دارس', 'الدارسين'].includes(v)) return 'learner';
  return v;
}

function normalizeRole(v) {
  v = String(v || '').trim().toLowerCase();
  if (['teacher', 'teachers', 'tutor', 'معلم', 'مدرس', 'المعلم'].includes(v)) return 'tutor';
  if (['student', 'students', 'learner', 'طلاب', 'الطلاب', 'متعلم', 'المتعلم'].includes(v)) return 'learner';
  if (['both', 'dual', 'combined', 'learner/tutor', 'tutor/learner', 'معلم/طالب', 'طالب/معلم', 'الاثنان'].includes(v)) return 'both';
  if (['admin', 'manager', 'administrator', 'مدير', 'الإدارة'].includes(v)) return 'admin';
  return v;
}

function currentRole() {
  var u = currentUser();
  var raw = (window.CP && (window.CP.role || window.CP.userType || window.CP.type)) || (u && u.role) || '';
  return normalizeRole(raw);
}

function getBroadcastTarget(item) {
  return normalizeTarget(
    item && (
      item.target ||
      item.audience ||
      item.to ||
      item.group ||
      item.recipient ||
      item.toRole ||
      item.targetRole ||
      item.role ||
      item.for ||
      item.visibility ||
      'all'
    )
  );
}

function roleMatchesTarget(role, target) {
  role = normalizeRole(role);
  target = normalizeTarget(target);
  if (!role) return false;
  if (role === 'admin') return true;
  if (target === 'all') return true;
  if (target === 'tutor') return role === 'tutor' || role === 'both';
  if (target === 'learner') return role === 'learner' || role === 'both';
  return true;
}

function shouldShowBroadcast(item) {
  return roleMatchesTarget(currentRole(), getBroadcastTarget(item));
}

function normalizeImageUrl(url) {
  url = String(url || '').trim();
  if (!url) return '';
  if (url.startsWith('data:image/')) return url;
  if (url.startsWith('blob:')) return url;
  if (/drive\.google\.com|docs\.google\.com/.test(url)) {
    var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/)
      || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
      || url.match(/\/uc\?id=([a-zA-Z0-9_-]+)/)
      || url.match(/\/thumbnail\?id=([a-zA-Z0-9_-]+)/)
      || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m && m[1]) return 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w1600';
  }
  if (/lh3\.googleusercontent\.com|googleusercontent\.com/.test(url)) return url;
  if (/dropbox\.com/.test(url)) return url.replace('?dl=0', '?raw=1');
  if (url.startsWith('gs://')) return '';
  return url.replace(/\s/g, '%20');
}

function getBroadcastImage(item) {
  var raw = item && (
    item.imageUrl || item.image || item.photo || item.img || item.mediaUrl ||
    item.banner || item.cover || item.picture || item.poster || item.thumb || ''
  );
  return normalizeImageUrl(raw);
}


  /* ─── ANNOUNCEMENT BAR ────────────────────────────────────────── */
  var _annUnsub = null;
  var _annItems = [];
  var _annRole = '';
  var _storyIdx = 0;

  function _norm(v) {
    return String(v || '').trim().toLowerCase();
  }

  function _currentRole() {
    if (window.CP && window.CP.role) return _norm(window.CP.role);
    if (_annRole) return _annRole;
    return '';
  }

  function _isTutorLike(role) {
    role = _norm(role);
    return ['tutor', 'both', 'admin', 'teacher', 'معلم', 'معلم/طالب'].includes(role);
  }

  function _isLearnerLike(role) {
    role = _norm(role);
    return ['learner', 'both', 'admin', 'student', 'متعلم', 'طالب'].includes(role);
  }

  function _matchesTarget(target, role) {
    target = _norm(target) || 'all';
    role = _norm(role);
    if (target === 'all') return true;
    if (target === 'tutor') return _isTutorLike(role);
    if (target === 'learner') return _isLearnerLike(role);
    return true;
  }

  function _resolveAnnImage(url) {
    var u = String(url || '').trim();
    if (!u) return '';
    if (/^data:image\//i.test(u)) return u;

    // Google Drive share links
    var m = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i)
      || u.match(/[?&]id=([a-zA-Z0-9_-]+)/i)
      || u.match(/\/d\/([a-zA-Z0-9_-]+)/i);
    if (m && m[1] && /drive\.google\.com/i.test(u)) {
      return 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(m[1]);
    }
    if (/drive\.google\.com/i.test(u) && /thumbnail\?id=/i.test(u)) {
      return u.replace(/export=(download|view)/i, 'export=view');
    }

    // Dropbox
    if (/dropbox\.com/i.test(u)) {
      return u.replace(/\?dl=0/i, '?raw=1').replace(/\?dl=1/i, '?raw=1');
    }

    // Google Photos / standard direct URLs are kept as-is
    return u;
  }

  function _safeImgHtml(url, cls) {
    if (!url) return '<div class="' + cls + ' is-fallback"></div>';
    return '<img class="' + cls + '-img" src="' + esc(url) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.classList.add(\'is-fallback\')">';
  }

  function initAnnouncements(uid) {
    if (_annUnsub) { try { _annUnsub(); } catch(_){} _annUnsub = null; }

    function startListener() {
      _annUnsub = db.collection('adminBroadcasts')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .onSnapshot(function(snap) {
          _annItems = snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); });
          renderAnnBar();
        }, function(err) {
          console.warn('[Skillak] announcements error:', err.message || err);
        });
    }

    if (_currentRole()) {
      startListener();
      return;
    }

    if (uid) {
      db.collection('users').doc(uid).get().then(function(s) {
        if (s.exists && s.data() && s.data().role) _annRole = _norm(s.data().role);
        startListener();
        renderAnnBar();
      }).catch(function() {
        startListener();
      });
      return;
    }

    startListener();
  }

  function renderAnnBar() {
    var bar = byId('sklAnnBar');
    if (!bar) return;

    var role = _currentRole();
    if (!role) {
      bar.style.display = 'none';
      window._sklAnnItems = [];
      return;
    }

    var items = _annItems.filter(function(item) {
      return _matchesTarget(item.target, role);
    });

    if (!items.length) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      window._sklAnnItems = [];
      return;
    }

    window._sklAnnItems = items;
    bar.className = 'skl-ann-bar';
    bar.style.cssText = [
      'display:block',
      'width:100%',
      'padding:0',
      'box-sizing:border-box',
      'background:transparent'
    ].join(';');

    var unread = items.length;

    bar.innerHTML =
      '<section class="skl-ann-shell">'
      + '<div class="skl-ann-head">'
      +   '<div class="skl-ann-title-wrap">'
      +     '<div class="skl-ann-ic">📢</div>'
      +     '<div style="min-width:0">'
      +       '<div class="skl-ann-title">الإعلانات</div>'
      +       '<div class="skl-ann-sub">آخر التحديثات والتنبيهات المهمة</div>'
      +     '</div>'
      +   '</div>'
      +   (unread ? '<span class="skl-ann-badge">' + unread + ' إعلان</span>' : '')
      + '</div>'
      + '<div class="skl-ann-track">'
      +   items.map(function(item, idx) {
          var img = _resolveAnnImage(item.imageUrl || item.image || item.img || item.photo || item.cover || '');
          var targetLabel = ({all:'الجميع', tutor:'المعلمون', learner:'الطلاب'})[_norm(item.target)] || 'الجميع';
          var dt = item.createdAt && item.createdAt.toDate ? item.createdAt.toDate().toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' }) : '';
          var mediaClass = img ? 'skl-ann-media' : 'skl-ann-media is-fallback';
          return '<article class="skl-ann-card" onclick="_sklOpenStory(' + idx + ')">'
            + (img ? '<div class="' + mediaClass + '">' + _safeImgHtml(img, 'skl-ann-media') + '</div>' : '<div class="' + mediaClass + '"></div>')
            + '<div class="skl-ann-overlay">'
            +   '<div class="skl-ann-topline">'
            +     '<span class="skl-ann-chip">' + esc(targetLabel) + '</span>'
            +     (dt ? '<span class="skl-ann-date">' + esc(dt) + '</span>' : '')
            +   '</div>'
            +   '<div class="skl-ann-card-title">' + esc(item.title || 'إعلان رسمي') + '</div>'
            +   '<div class="skl-ann-card-text">' + esc(String(item.message || '').slice(0, 140)) + '</div>'
            +   (item.link ? '<a class="skl-ann-link" href="' + esc(item.link) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">🔗 معرفة المزيد</a>' : '')
            + '</div>'
            + '</article>';
        }).join('')
      + '</div>'
      + '</section>';
  }

  window.refreshAnnouncements = renderAnnBar;

  /* ── تخزين الإعلانات المقروءة في localStorage ── */
  function _getReadSet() {
    try { return JSON.parse(localStorage.getItem('_sklAnnRead') || '{}'); } catch(_) { return {}; }
  }
  function _saveReadSet(obj) {
    try { localStorage.setItem('_sklAnnRead', JSON.stringify(obj)); } catch(_){}
  }

  window._sklOpenStory = window.sklOpenStory = function(idx) {
    _storyIdx = idx || 0;
    var v = byId('sklStoryViewer');
    if (!v) return;
    v.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    _renderStory();

    var items = window._sklAnnItems || _annItems;
    if (items[_storyIdx]) {
      var s = _getReadSet(); s[items[_storyIdx].id] = true; _saveReadSet(s);
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

    var img = _resolveAnnImage(item.imageUrl || item.image || item.img || item.photo || item.cover || '');
    var dt  = item.createdAt && item.createdAt.toDate
      ? item.createdAt.toDate().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' }) : '';
    var targetLabel = ({all:'الجميع', tutor:'المعلمون', learner:'الطلاب'})[_norm(item.target)] || 'الجميع';

    prog.innerHTML = items.map(function(_, i) {
      return '<div class="skl-story-seg ' + (i === _storyIdx ? 'is-active' : (i < _storyIdx ? 'is-done' : '')) + '"></div>';
    }).join('');

    con.innerHTML =
      '<div class="skl-story-shell">'
      +   '<div class="skl-story-media ' + (img ? '' : 'is-fallback') + '">' 
      +     (img ? '<img class="skl-story-img" src="' + esc(img) + '" alt="" loading="eager" referrerpolicy="no-referrer" onerror="this.remove();this.parentElement.classList.add(\'is-fallback\')">' : '')
      +   '</div>'
      +   '<div class="skl-story-body">'
      +     '<div class="skl-story-meta">'
      +       '<span class="skl-story-chip">' + esc(targetLabel) + '</span>'
      +       (dt ? '<span class="skl-story-date">' + esc(dt) + '</span>' : '')
      +     '</div>'
      +     '<h3 class="skl-story-title">' + esc(item.title || '') + '</h3>'
      +     '<div class="skl-story-text">' + esc(item.message || '') + '</div>'
      +     (item.link ? '<a href="' + esc(item.link) + '" target="_blank" rel="noopener" class="skl-story-link">🔗 معرفة المزيد</a>' : '')
      +   '</div>'
      + '</div>';

    document.onkeydown = function(e) {
      var v = byId('sklStoryViewer');
      if (!v || v.style.display === 'none') return;
      if (e.key === 'ArrowLeft')  window.sklStoryNav(1);
      if (e.key === 'ArrowRight') window.sklStoryNav(-1);
      if (e.key === 'Escape')     window.sklCloseStory();
    };

    var sx = null;
    con.ontouchstart = function(e){ sx = e.touches[0].clientX; };
    con.ontouchend = function(e){
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx;
      if (Math.abs(dx) > 50) window.sklStoryNav(dx > 0 ? 1 : -1);
      sx = null;
    };
  }

  /* ─── PASSWORD RESET (doFgt) ──────────────────────────────────── */
  /* ─── PASSWORD RESET (doFgt) ──────────────────────────────────── */  /* ─── PASSWORD RESET (doFgt) ──────────────────────────────────── */
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
          setTimeout(renderAnnBar, 450);
          setTimeout(renderAnnBar, 1200);
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
    setTimeout(renderAnnBar, 250);
  };

  window.refreshAnnouncements = function() {
    renderAnnBar();
  };

  setInterval(function () {
    if (_annItems.length) renderAnnBar();
  }, 2500);

})();
