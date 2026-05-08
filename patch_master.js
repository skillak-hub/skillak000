/* ════════════════════════════════════════════════════════════════════
   SKILLAK — patch_master.js  v6.0
   ════════════════════════════════════════════════════════════════════
   ملاحظة هامة:
   - الإعلانات (loadDashAnnouncements، Story Viewer) ← skillak_hotfix.js
   - هذا الملف يتولى: Admin Panel + Financial + Auth + Guest Mode
   ════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  function waitFor(fn, cb, ms, n) {
    ms = ms || 150; n = n === undefined ? 100 : n;
    if (fn()) return cb();
    if (!n) return;
    setTimeout(function () { waitFor(fn, cb, ms, n - 1); }, ms);
  }
  function $id(id) { return document.getElementById(id); }
  function showT(m, t) { if (typeof window.showT === 'function') window.showT(m, t); }
  function r2(n) { return Math.round(Number(n || 0) * 100) / 100; }
  function egp(n) { return r2(n).toFixed(2) + ' ج.م'; }
  function esc(v) {
    return String(v || '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function fts() { return firebase.firestore.FieldValue.serverTimestamp(); }

  waitFor(
    function () { return typeof firebase !== 'undefined' && typeof db !== 'undefined'; },
    boot
  );

  function boot() {
    patch_calcFees();
    patch_txList();
    patch_tutorEarnings();
    patch_adminPanel();
    patch_go();
    initGuestMode();

    firebase.auth().onAuthStateChanged(function (user) {
      if (user) {
        setTimeout(function () {
          patch_emailPwd();
          patch_chatAvatars();
          startNotifListener(user.uid);
          toggleGuestMode(true, user.uid);
        }, 600);
      } else {
        if (_notifOff) { try { _notifOff(); } catch(e){} _notifOff = null; }
        toggleGuestMode(false, null);
      }
    });

    console.log('[SKL patch_master v6] ✅');
  }

  /* ══════════════════════════════════════════════════════════
     01. إخفاء / إظهار الاستكشاف قبل / بعد تسجيل الدخول
  ══════════════════════════════════════════════════════════ */
  function initGuestMode() { toggleGuestMode(false, null); }

  function toggleGuestMode(loggedIn, uid) {
    var nlEx  = $id('nlExplore');  if (nlEx)  nlEx.style.display  = loggedIn ? '' : 'none';
    var mobEx = $id('mobExplore'); if (mobEx) mobEx.style.display = loggedIn ? '' : 'none';
    var bnEx  = $id('bnExplore');  if (bnEx)  bnEx.style.display  = loggedIn ? '' : 'none';
    var fs    = $id('featSection'); if (fs)   fs.style.display    = loggedIn ? 'block' : 'none';
    var hfc   = $id('heroFloatCards'); if (hfc) hfc.style.display = loggedIn ? 'flex' : 'none';

    if (loggedIn && uid) {
      realtimeBal(uid);
      realtimePhoto(uid);
      /* الإعلانات تُحمَّل من skillak_hotfix.js عبر onAuthStateChanged */
    }
  }

  /* ══════════════════════════════════════════════════════════
     02. patch go() — hooks بدون كسر الأصلي
  ══════════════════════════════════════════════════════════ */
  function patch_go() {
    waitFor(function () { return typeof window.go === 'function'; }, function () {
      var _orig = window.go;
      window.go = function (name) {
        var res = _orig.apply(this, arguments);

        /* لوحة التحكم: اطلب الإعلانات من skillak_hotfix */
        if (name === 'dashboard') {
          /* الإعلانات يُعيد تحميلها skillak_hotfix.js من خلال onSnapshot الحي */
        }

        /* صفحة تعديل الملف: أضف قسم الأمان */
        if (name === 'editProfile') {
          setTimeout(_drawSec, 500);
        }

        return res;
      };
    });
  }

  /* ══════════════════════════════════════════════════════════
     03. تحديث فوري للرصيد وصورة المستخدم
  ══════════════════════════════════════════════════════════ */
  function realtimeBal(uid) {
    db.collection('wallets').doc(uid).onSnapshot(function(sn){
      if(!sn.exists) return;
      var bal = Number(sn.data().balance || 0);
      window.walBal = bal;
      ['nwAmt','wBal','wdBal'].forEach(function(id){
        var el = $id(id); if (!el) return;
        el.textContent = id === 'nwAmt' ? (bal.toFixed(2) + ' ج.م') : bal.toFixed(2);
      });
    }, function(){});
  }

  function realtimePhoto(uid) {
    db.collection('users').doc(uid).onSnapshot(function(sn){
      if(!sn.exists) return;
      var d = sn.data();
      if (window.CP) window.CP = Object.assign({}, window.CP, d);
      var nav = $id('navAv'); if (!nav) return;
      nav.innerHTML = d.photo
        ? '<img src="' + esc(d.photo) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
        : (d.name ? d.name[0] : '');
    }, function(){});
  }

  /* ══════════════════════════════════════════════════════════
     04. صور المستخدمين في الشات
  ══════════════════════════════════════════════════════════ */
  function patch_chatAvatars() {
    window._sklBubble = function(m, uid) {
      var mine = m.senderId === uid;
      var dt   = (m.createdAt && m.createdAt.toDate) ? m.createdAt.toDate() : new Date();
      var time = dt.toLocaleTimeString('ar', {hour:'2-digit', minute:'2-digit'});
      var tick = mine ? (m.read ? '<span class="rtick" style="color:#53d391">✓✓</span>'
                                : '<span style="color:rgba(0,0,0,.35);font-size:.7rem">✓</span>') : '';
      var photo = '', name = '';
      if (mine) { photo = (window.CP && window.CP.photo) || ''; name = (window.CP && window.CP.name) || ''; }
      else {
        photo = m.senderPhoto || ''; name = m.senderName || '';
        var ku = window.allKnownUsers && window.allKnownUsers[m.senderId];
        if (ku) { if (ku.photo) photo = ku.photo; if (ku.name) name = ku.name; }
      }
      var av = photo
        ? '<img src="' + esc(photo) + '" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(255,255,255,.6)" onerror="this.style.display=\'none\'">'
        : '<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#1565c0,#42a5f5);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:800;flex-shrink:0">' + esc((name||'?')[0]) + '</div>';
      var sndLbl = (!mine && name)
        ? '<div class="msender" style="font-size:.72rem;font-weight:700;color:var(--teal);margin-bottom:2px">' + esc(name) + '</div>' : '';
      var imgTag = m.imageUrl
        ? '<img src="' + esc(m.imageUrl) + '" style="max-width:200px;border-radius:10px;margin-bottom:4px;display:block" loading="lazy" onerror="this.style.display=\'none\'">' : '';
      return '<div class="mrow ' + (mine?'mine':'theirs') + '" style="display:flex;align-items:flex-end;gap:7px;' + (mine?'flex-direction:row-reverse':'') + ';margin-bottom:6px">'
        + av + '<div class="mbub ' + (mine?'mine':'theirs') + '">' + sndLbl + imgTag
        + '<div class="mtext">' + esc(m.text||'') + '</div>'
        + '<div class="mtime" style="display:flex;align-items:center;gap:4px;justify-content:flex-end"><span>' + time + '</span>' + tick + '</div>'
        + '</div></div>';
    };
  }

  /* ══════════════════════════════════════════════════════════
     05. الإشعارات الفورية (رسائل + حجوزات)
  ══════════════════════════════════════════════════════════ */
  var _notifOff = null, _notifReady = false;

  function startNotifListener(uid) {
    if (_notifOff) { try { _notifOff(); } catch(e){} _notifOff = null; }
    _notifReady = false;

    /* رسائل شات جديدة */
    var msgReady = false;
    db.collection('messages').where('receiverId','==',uid).where('read','==',false)
      .orderBy('createdAt','desc').limit(50)
      .onSnapshot(function(snap) {
        snap.docChanges().forEach(function(ch){
          if (ch.type !== 'added' || !msgReady) return;
          var m = ch.doc.data();
          if (window.curChatUid === m.senderId) return;
          var nm = m.senderName || 'مستخدم';
          showT('💬 ' + nm + ': ' + (m.text||'').slice(0,55), 'inf');
          _push('💬 ' + nm, (m.text||'').slice(0,80)); _bump();
        });
        msgReady = true;
      }, function(){});

    /* حجوزات جديدة للمعلم */
    var bkReady = false;
    db.collection('bookings').where('tutorId','==',uid).where('status','==','pending')
      .onSnapshot(function(snap){
        snap.docChanges().forEach(function(ch){
          if (ch.type !== 'added' || !bkReady) return;
          var b = ch.doc.data();
          showT('📚 حجز جديد من ' + (b.studentName||'طالب'), 'inf');
          _push('📚 حجز جديد', (b.studentName||'طالب') + ' · ' + (b.date||''));
        });
        bkReady = true;
      }, function(){});
  }

  function _push(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification(title, {body:body, icon:'./icon-192.png'}); } catch(e){}
  }
  function _bump() {
    var el = $id('msgBadge'); if (!el) return;
    var c = parseInt(el.textContent) || 0;
    el.textContent = (c+1) > 99 ? '99+' : String(c+1);
    el.classList.remove('hidden');
  }

  /* ══════════════════════════════════════════════════════════
     06. تغيير البريد + كلمة المرور
  ══════════════════════════════════════════════════════════ */
  function patch_emailPwd() {
    /* reauth آمن */
    async function reauth(pass) {
      var user = firebase.auth().currentUser;
      if (!user || !user.email) throw new Error('يجب تسجيل الدخول أولاً');
      var Cred = firebase.auth.EmailAuthProvider.credential(user.email, pass);
      await user.reauthenticateWithCredential(Cred);
    }

    window.doChangeEmail = async function () {
      var email = _fv('epNewEmail').trim();
      var pass  = _fv('epCurPwd4Em');
      var msg   = $id('epEmailMsg'), btn = $id('epEmailBtn');
      if (!email.includes('@')) { _fMsg(msg,'أدخل بريدًا إلكترونياً صحيحًا','err'); return; }
      if (!pass) { _fMsg(msg,'أدخل كلمة مرورك الحالية للتحقق','err'); return; }
      _ld(btn,1);
      try {
        await reauth(pass);
        await firebase.auth().currentUser.updateEmail(email);
        await db.collection('users').doc(firebase.auth().currentUser.uid).update({email:email});
        _fMsg(msg,'✅ تم تغيير البريد الإلكتروني','suc');
        showT('✅ تم تغيير البريد الإلكتروني','suc');
        _clr(['epNewEmail','epCurPwd4Em']);
      } catch(e) { _fMsg(msg,'❌ '+_authErr(e),'err'); }
      finally { _ld(btn,0); }
    };

    /* doChangePwd: هذه الدالة تُكتب هنا لكن skillak_hotfix.js قد تكتبها بعدنا */
    /* نتأكد أنها لا تُكسَر بأن skillak_hotfix.js هو المرجع النهائي */
    if (!window._pwdPatched) {
      window._pwdPatched = true;
      window.doChangePwd = async function () {
        var cur = _fv('epCurPwd'), nw = _fv('epNewPwd'), cnf = _fv('epConfPwd');
        var msg = $id('epPwdMsg'), btn = $id('epPwdBtn');
        if (!cur)          { _fMsg(msg,'أدخل كلمة مرورك الحالية','err'); return; }
        if (nw.length < 6) { _fMsg(msg,'كلمة المرور الجديدة 6 أحرف على الأقل','err'); return; }
        if (nw !== cnf)    { _fMsg(msg,'كلمتا المرور غير متطابقتين','err'); return; }
        _ld(btn,1);
        try {
          await reauth(cur);
          await firebase.auth().currentUser.updatePassword(nw);
          _fMsg(msg,'✅ تم تغيير كلمة المرور','suc');
          showT('✅ تم تغيير كلمة المرور','suc');
          _clr(['epCurPwd','epNewPwd','epConfPwd']);
        } catch(e) { _fMsg(msg,'❌ '+_authErr(e),'err'); }
        finally { _ld(btn,0); }
      };
    }

    function _fv(id) { var el=$id(id); return el?el.value:''; }
    function _clr(ids) { ids.forEach(function(id){var el=$id(id);if(el)el.value='';}); }
    function _ld(btn,on) { if(btn){btn.disabled=!!on;btn.textContent=on?'جاري...':(btn.dataset.label||'حفظ');} }
    function _fMsg(el,txt,type) {
      if(!el)return;el.textContent=txt;
      el.style.cssText='display:block;font-size:.82rem;padding:8px 12px;border-radius:10px;margin-bottom:8px;'
        +(type==='suc'?'background:rgba(16,185,129,.1);color:#059669'
          :type==='err'?'background:rgba(239,68,68,.1);color:#dc2626'
          :'background:rgba(21,101,192,.1);color:#1565c0');
      if(type!=='inf')setTimeout(function(){if(el)el.style.display='none';},6000);
    }
    function _authErr(e) {
      return ({
        'auth/wrong-password':'كلمة المرور الحالية غير صحيحة',
        'auth/email-already-in-use':'هذا البريد مستخدم بالفعل',
        'auth/invalid-email':'البريد غير صالح',
        'auth/requires-recent-login':'سجّل الخروج وأعد الدخول ثم حاول مجدداً',
        'auth/too-many-requests':'محاولات كثيرة — انتظر قليلاً',
        'auth/network-request-failed':'تحقق من اتصالك بالإنترنت',
        'auth/invalid-credential':'بيانات الاعتماد غير صحيحة',
      })[e.code] || e.message || 'حدث خطأ';
    }
  }

  /* ── حقن قسم الأمان في صفحة تعديل الملف ── */
  function _drawSec() {
    if ($id('_sklSec')) return;
    var pg = $id('page-editProfile'); if (!pg) return;
    var wrap = pg.querySelector('.editwrap') || pg;
    var sec = document.createElement('div');
    sec.id = '_sklSec'; sec.style.marginTop = '22px';
    sec.innerHTML = `<div class="card">
  <div class="ch"><span class="ct">🔐 الأمان وبيانات الدخول</span></div>
  <div class="cb" style="display:grid;gap:20px">
    <div>
      <div style="font-weight:800;font-size:.92rem;margin-bottom:10px">📧 تغيير البريد الإلكتروني</div>
      <div class="fg"><label>كلمة المرور الحالية (للتحقق) *</label>
        <input type="password" id="epCurPwd4Em" placeholder="أدخل كلمة مرورك الحالية" autocomplete="current-password"/></div>
      <div class="fg"><label>البريد الإلكتروني الجديد *</label>
        <input type="email" id="epNewEmail" placeholder="example@email.com" dir="ltr" autocomplete="email"/></div>
      <div id="epEmailMsg" style="display:none"></div>
      <button id="epEmailBtn" data-label="تغيير البريد" class="btn btn-p btn-sm" onclick="doChangeEmail()">📧 تغيير البريد</button>
    </div>
    <hr style="border:none;border-top:1px solid var(--border)"/>
    <div>
      <div style="font-weight:800;font-size:.92rem;margin-bottom:10px">🔑 تغيير كلمة المرور</div>
      <div class="fg"><label>كلمة المرور الحالية *</label>
        <input type="password" id="epCurPwd" placeholder="كلمة مرورك الحالية" autocomplete="current-password"/></div>
      <div class="fr" style="gap:12px">
        <div class="fg"><label>كلمة المرور الجديدة *</label>
          <input type="password" id="epNewPwd" placeholder="6 أحرف على الأقل" autocomplete="new-password"/></div>
        <div class="fg"><label>تأكيد كلمة المرور *</label>
          <input type="password" id="epConfPwd" placeholder="أعد كلمة المرور" autocomplete="new-password"/></div>
      </div>
      <div id="epPwdMsg" style="display:none"></div>
      <button id="epPwdBtn" data-label="تغيير كلمة المرور" class="btn btn-p btn-sm" onclick="doChangePwd()">🔑 تغيير كلمة المرور</button>
    </div>
  </div>
</div>`;
    wrap.appendChild(sec);
  }

  /* ══════════════════════════════════════════════════════════
     07. calcBookingFees دقيق
  ══════════════════════════════════════════════════════════ */
  function patch_calcFees() {
    window.calcBookingFees = function(price) {
      var base  = Math.max(0, Number(price||0));
      var sRate = Math.max(0, Number(window.studentCommissionRate !== undefined ? window.studentCommissionRate : 5));
      var tRate = Math.max(0, Number(window.tutorCommissionRate   !== undefined ? window.tutorCommissionRate   : 5));
      var sFee  = r2(base * sRate / 100), tFee = r2(base * tRate / 100);
      return { price:base, studentFee:sFee, tutorFee:tFee,
               platformFee:r2(sFee+tFee), totalDue:r2(base+sFee), tutorNet:r2(base-tFee) };
    };
  }

  /* ══════════════════════════════════════════════════════════
     08. سجل المعاملات الكامل
  ══════════════════════════════════════════════════════════ */
  function patch_txList() {
    waitFor(function(){return typeof window.loadTxList==='function';}, function(){
      window.loadTxList = async function() {
        var el = $id('txList'), uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
        if (!el || !uid) return;
        el.innerHTML = '<div style="padding:28px;text-align:center"><div class="spin" style="margin:0 auto"></div></div>';
        var [ws,txSnap,bk1,bk2] = await Promise.all([
          db.collection('wallets').doc(uid).get().catch(function(){return null;}),
          db.collection('transactions').where('userId','==',uid).orderBy('createdAt','desc').get().catch(function(){return{docs:[]};}),
          db.collection('bookings').where('studentId','==',uid).get().catch(function(){return{docs:[]};}),
          db.collection('bookings').where('tutorId','==',uid).get().catch(function(){return{docs:[]};}),
        ]);
        if (ws&&ws.exists) {
          window.walBal = Number(ws.data().balance||0);
          var wb=$id('wBal');if(wb)wb.textContent=window.walBal.toFixed(2);
          var nw=$id('nwAmt');if(nw)nw.textContent=window.walBal.toFixed(2)+' ج.م';
          var wd=$id('wdBal');if(wd)wd.textContent=window.walBal.toFixed(2)+' ج.م';
        }
        var isTutor = window.CP && ['tutor','both','admin'].includes(window.CP.role);
        var wCard = $id('withdrawCard'); if(wCard) wCard.style.display = isTutor?'block':'none';
        if (isTutor && typeof window.loadWdHistory==='function') window.loadWdHistory();

        var allTxs = txSnap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var bks = [...bk1.docs,...bk2.docs].map(function(d){return Object.assign({id:d.id},d.data());});
        var sBks = bks.filter(function(b){return b.studentId===uid&&b.status==='completed';});
        var totalIn  = allTxs.filter(function(t){return t.type==='credit'&&String(t.kind||'').toLowerCase()==='topup'&&t.status==='approved';}).reduce(function(s,t){return s+Number(t.amount||0);},0);
        var totalOut = allTxs.filter(function(t){return t.type==='debit'&&String(t.kind||'').toLowerCase()==='withdrawal'&&t.status==='approved';}).reduce(function(s,t){return s+Number(t.amount||0);},0);
        var totalSpend = sBks.reduce(function(s,b){return s+r2(Number(b.totalDue||b.total||(Number(b.price||0)+Number(b.studentFee||b.fee||0))));},0);

        var sumEl = $id('_txSum');
        if (!sumEl) {
          sumEl = document.createElement('div'); sumEl.id = '_txSum';
          sumEl.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px;background:rgba(21,101,192,.05);border:1px solid var(--border);border-radius:16px;padding:14px';
          if (el.parentElement) el.parentElement.insertBefore(sumEl, el);
        }
        sumEl.innerHTML = [{ic:'💳',l:'إجمالي الشحن',v:egp(totalIn)},{ic:'📚',l:'إجمالي الإنفاق',v:egp(totalSpend)},{ic:'🏦',l:'إجمالي السحب',v:egp(totalOut)},{ic:'💰',l:'الرصيد الحالي',v:egp(window.walBal||0)}]
          .map(function(x){return'<div style="text-align:center"><div style="font-size:1.2rem">'+x.ic+'</div><div style="font-family:\'Fraunces\',serif;font-size:1.1rem;font-weight:900">'+x.v+'</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">'+x.l+'</div></div>';}).join('');

        var rows = [];
        allTxs.filter(function(t){var k=String(t.kind||'').toLowerCase();return k==='topup'||k==='withdrawal';}).forEach(function(t){rows.push(Object.assign({_rt:'tx'},t));});
        sBks.forEach(function(b){var due=r2(Number(b.totalDue||b.total||(Number(b.price||0)+Number(b.studentFee||b.fee||0)))),sFee=r2(Number(b.studentFee||b.fee||0));rows.push({_rt:'bk',type:'debit',kind:'booking',amount:due,price:Number(b.price||0),studentFee:sFee,tutorFee:r2(Number(b.tutorFee||0)),description:'جلسة مع '+esc(b.tutorName||'معلم')+' · '+(b.date||'')+' '+(b.timeLbl||b.time||''),status:'completed',bookingId:b.id,createdAt:b.createdAt});});
        bks.filter(function(b){return b.tutorId===uid&&b.status==='completed'&&(b.adminConfirmed||b.paidToTutorAt);}).forEach(function(b){var tFee=r2(Number(b.tutorFee||b.fee||0));rows.push({_rt:'earn',type:'credit',kind:'earnings',amount:r2(Number(b.price||0)-tFee),price:Number(b.price||0),tutorFee:tFee,description:'أرباح جلسة مع '+esc(b.studentName||'طالب')+' · '+(b.date||''),status:'approved',bookingId:b.id,createdAt:b.createdAt});});
        bks.filter(function(b){return b.tutorId===uid&&b.status==='completed'&&!(b.adminConfirmed||b.paidToTutorAt);}).forEach(function(b){var tFee=r2(Number(b.tutorFee||b.fee||0));rows.push({_rt:'earn_p',type:'credit',kind:'earnings',amount:r2(Number(b.price||0)-tFee),price:Number(b.price||0),tutorFee:tFee,description:'أرباح معلقة · '+esc(b.studentName||'طالب')+' · '+(b.date||''),status:'pending',bookingId:b.id,createdAt:b.createdAt});});
        rows.sort(function(a,b){return((b.createdAt&&b.createdAt.seconds)||0)-((a.createdAt&&a.createdAt.seconds)||0);});
        if (!rows.length) { el.innerHTML='<div class="empty" style="padding:40px"><div class="emptyic">📭</div><p>لا توجد معاملات بعد</p></div>'; return; }
        el.innerHTML = rows.map(function(row){
          var k=String(row.kind||'').toLowerCase(),isIn=row.type==='credit',isPend=row._rt==='earn_p';
          var dt=(row.createdAt&&row.createdAt.toDate)?row.createdAt.toDate().toLocaleDateString('ar-SA',{year:'numeric',month:'short',day:'numeric'}):'—';
          var ic=row._rt==='earn'||row._rt==='earn_p'?'💰':row._rt==='bk'?'📚':(isIn?'💳':'💸');
          var badge=row._rt==='bk'?'<span class="pill pca">✅ مخصوم</span>':row._rt==='earn'?'<span class="pill pc">✅ محوَّل</span>':isPend?'<span class="pill pp">⏳ الإدارة</span>':{pending:'<span class="pill pp">⏳</span>',approved:'<span class="pill pc">✅</span>',rejected:'<span class="pill pca">❌</span>'}[row.status]||'';
          var extra=row._rt==='bk'?'<div style="font-size:.72rem;color:var(--muted);margin-top:2px">سعر: '+egp(row.price)+' + عمولتك: '+egp(row.studentFee)+' = الإجمالي: '+egp(row.amount)+'</div>':row._rt==='earn'||isPend?'<div style="font-size:.72rem;color:var(--muted);margin-top:2px">السعر: '+egp(row.price)+' − عمولتك: '+egp(row.tutorFee)+' = صافيك: '+egp(row.amount)+(isPend?' <span style="color:#f59e0b;font-weight:700">(بانتظار التحويل)</span>':'')+'</div>':'';
          return '<div class="txitem"><div style="display:flex;align-items:center;gap:12px"><div class="txic '+(isIn&&!isPend?'cr':'db')+'" style="font-size:1.1rem">'+ic+'</div><div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><div style="font-weight:700;font-size:.84rem">'+esc(row.description||'—')+'</div>'+badge+'</div>'+extra+'<div style="font-size:.71rem;color:var(--muted);margin-top:2px">'+dt+'</div></div></div><div style="font-weight:900;font-size:.95rem;'+(isPend?'color:#f59e0b':isIn?'color:var(--green)':'color:var(--red)')+'">'+( isIn&&!isPend?'+':'−')+row.amount.toFixed(2)+' ج.م</div></div>';
        }).join('');
      };
    });
  }

  /* ══════════════════════════════════════════════════════════
     09. أرباح المعلم بعد تأكيد الإدارة
  ══════════════════════════════════════════════════════════ */
  function patch_tutorEarnings() {
    waitFor(function(){return typeof window.rdEarnings==='function';}, function(){
      window.rdEarnings = async function(el) {
        if (!el) return;
        var uid = firebase.auth().currentUser && firebase.auth().currentUser.uid;
        if (!uid) return;
        el.innerHTML = '<div style="padding:28px;text-align:center"><div class="spin" style="margin:0 auto"></div></div>';
        var [bkSnap,ws] = await Promise.all([
          db.collection('bookings').where('tutorId','==',uid).get().catch(function(){return{docs:[]};}) ,
          db.collection('wallets').doc(uid).get().catch(function(){return null;})
        ]);
        var all  = bkSnap.docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var comp = all.filter(function(b){return b.status==='completed';});
        var paid = comp.filter(function(b){return b.adminConfirmed||b.paidToTutorAt;});
        var pend = comp.filter(function(b){return!(b.adminConfirmed||b.paidToTutorAt);});
        var paidNet  = paid.reduce(function(s,b){return s+r2(Number(b.price||0)-Number(b.tutorFee||b.fee||0));},0);
        var pendNet  = pend.reduce(function(s,b){return s+r2(Number(b.price||0)-Number(b.tutorFee||b.fee||0));},0);
        var tFeeSum  = comp.reduce(function(s,b){return s+Number(b.tutorFee||b.fee||0);},0);
        var grossRev = comp.reduce(function(s,b){return s+r2(Number(b.price||0)+Number(b.studentFee||b.fee||0));},0);
        var bal = ws&&ws.exists ? Number(ws.data().balance||0) : 0;
        var sc = function(ic,lbl,v,c){return '<div class="sc"><div class="scic">'+ic+'</div><div class="scval" style="font-size:1.3rem;color:'+(c||'var(--ink)')+'">'+v+'</div><div class="sclbl">'+lbl+'</div></div>';};
        el.innerHTML = '<div class="dashph" style="margin-bottom:20px">💰 الأرباح والإيرادات</div>'
          + (pend.length ? '<div style="background:#fff8e1;border:1px solid #f4d06f;border-radius:14px;padding:12px 16px;margin-bottom:14px;font-size:.83rem;color:#78350f">⚠️ '+pend.length+' جلسة بانتظار تحويل المدير. تُضاف بعد التأكيد.</div>' : '')
          + '<div class="srow" style="margin-bottom:20px">'
          + sc('💵','الإيرادات الإجمالية (ما دفعه الطلاب)',egp(grossRev),'#1565c0')
          + sc('✅','أرباح مُحوَّلة (بعد تأكيد الإدارة)',egp(paidNet),'#059669')
          + sc('⏳','أرباح بانتظار الإدارة',egp(pendNet),'#f59e0b')
          + sc('📉','عمولة المنصة (خُصمت)',egp(tFeeSum),'#ef4444')
          + sc('💳','رصيد المحفظة',egp(bal),'#7c3aed')
          + sc('📊','جلسات مكتملة',comp.length,'')
          + '</div>'
          + '<div style="margin-bottom:18px;display:flex;gap:10px;flex-wrap:wrap">'
          + '<button class="btn btn-p" onclick="dNav(\'withdraw\')" style="background:linear-gradient(135deg,#065f46,#10b981)">🏦 طلب سحب الأرباح</button>'
          + '<button class="btn btn-gh" onclick="go(\'wallet\')">💳 شحن المحفظة</button></div>'
          + '<div class="dsec" style="overflow-x:auto">'
          + (comp.length
              ? '<table class="dtbl"><thead><tr><th>الطالب</th><th>التاريخ</th><th>سعر الجلسة</th><th>عمولة الطالب</th><th>إجمالي الطالب</th><th>عمولة المعلم</th><th>صافي المعلم</th><th>الحالة</th></tr></thead><tbody>'
                + comp.map(function(b){
                    var price=Number(b.price||0),sFee=Number(b.studentFee||b.fee||0),tFee=Number(b.tutorFee||0),net=r2(price-tFee),tot=r2(price+sFee),isPaid=b.adminConfirmed||b.paidToTutorAt;
                    return '<tr><td><strong>'+esc(b.studentName||'—')+'</strong></td>'
                      +'<td style="font-size:.78rem;white-space:nowrap">'+esc(b.date||'—')+'<br><span style="color:var(--muted);font-size:.7rem">'+esc(b.timeLbl||b.time||'')+'</span></td>'
                      +'<td style="font-weight:700">'+egp(price)+'</td><td style="color:#f59e0b">'+egp(sFee)+'</td>'
                      +'<td style="color:var(--red);font-weight:700">'+egp(tot)+'</td><td style="color:#f59e0b">'+egp(tFee)+'</td>'
                      +'<td style="color:var(--green);font-weight:800">'+egp(net)+'</td>'
                      +'<td>'+(isPaid?'<span class="pill pc">✓ مُحوَّل</span>':'<span class="pill pp">⏳ الإدارة</span>')+'</td></tr>';
                  }).join('')
                + '</tbody></table>'
              : '<div style="text-align:center;padding:32px;color:var(--muted)">لا توجد جلسات مكتملة بعد</div>')
          + '</div>';
      };
    });
  }

  /* ══════════════════════════════════════════════════════════
     10. Admin Panel — إعلانات + عمليات مالية
  ══════════════════════════════════════════════════════════ */
  function patch_adminPanel() {

    window.adminConfirmBk = async function(bid) {
      var sn = await db.collection('bookings').doc(bid).get().catch(function(){return null;});
      if (!sn||!sn.exists) { showT('الحجز غير موجود','err'); return; }
      var bk = sn.data();
      if (bk.adminConfirmed||bk.paidToTutorAt) { showT('تم التحويل مسبقاً','err'); return; }
      if (bk.status!=='completed') { showT('الجلسة لم تكتمل','err'); return; }
      var price=Number(bk.price||bk.total||0),tFee=Number(bk.tutorFee||bk.fee||0),net=r2(price-tFee);
      if (!bk.tutorId) { showT('معرّف المعلم مفقود','err'); return; }
      if (net<=0) { showT('المبلغ الصافي يجب أن يكون أكبر من صفر','err'); return; }
      if (!confirm('تحويل '+egp(net)+' لمحفظة المعلم؟\n('+egp(price)+' − عمولة '+egp(tFee)+')')) return;
      try {
        await db.runTransaction(async function(tx) {
          var wRef=db.collection('wallets').doc(bk.tutorId),wSn=await tx.get(wRef);
          var bal=wSn.exists?Number(wSn.data().balance||0):0;
          tx.set(wRef,{balance:r2(bal+net),userId:bk.tutorId},{merge:true});
          tx.update(db.collection('bookings').doc(bid),{adminConfirmed:true,paidToTutorAt:fts()});
        });
        var ts=fts();
        await Promise.all([
          db.collection('transactions').add({userId:bk.tutorId,type:'credit',kind:'earnings',amount:net,description:'أرباح مُعتمدة · '+egp(price)+' − عمولة '+egp(tFee),bookingId:bid,createdAt:ts}),
          db.collection('notifications').add({toUid:bk.tutorId,title:'💰 تم تحويل أرباحك',message:'تم إضافة '+egp(net)+' لمحفظتك',read:false,isAdmin:true,link:'wallet',createdAt:ts}),
        ]);
        showT('✅ تم تحويل '+egp(net)+' لمحفظة المعلم','suc'); _reloadBk();
      } catch(e) { showT('❌ '+e.message,'err'); }
    };

    window.adminRefundBk = async function(bid, studentId, amount) {
      var amt = r2(Number(amount||0));
      if (!confirm('إرجاع '+egp(amt)+' لمحفظة الطالب؟\n(سيُخصم من محفظة المعلم إذا حُوّلت أرباحه)')) return;
      try {
        var bkSnap = await db.collection('bookings').doc(bid).get();
        if (!bkSnap.exists) { showT('الحجز غير موجود','err'); return; }
        var bk = bkSnap.data(), tutorId = bk.tutorId;
        await db.runTransaction(async function(tx) {
          var sRef = db.collection('wallets').doc(studentId);
          var reads = [tx.get(sRef), tx.get(db.collection('bookings').doc(bid))];
          var tRef = tutorId ? db.collection('wallets').doc(tutorId) : null;
          if (tRef) reads.push(tx.get(tRef));
          var results = await Promise.all(reads);
          var sBal = results[0].exists ? Number(results[0].data().balance||0) : 0;
          var tBal = tRef && results[2] && results[2].exists ? Number(results[2].data().balance||0) : 0;
          tx.set(sRef, {balance:r2(sBal+amt),userId:studentId}, {merge:true});
          if (tRef && (bk.adminConfirmed||bk.paidToTutorAt)) {
            var deduct = Math.min(amt, tBal);
            if (deduct>0) tx.set(tRef, {balance:r2(tBal-deduct),userId:tutorId}, {merge:true});
          }
          tx.update(db.collection('bookings').doc(bid), {status:'refunded',adminRefundedAt:fts(),refundAmount:amt});
        });
        var ts = fts();
        var ops = [
          db.collection('transactions').add({userId:studentId,type:'credit',kind:'refund',amount:amt,description:'استرداد بقرار الإدارة · '+egp(amt),bookingId:bid,createdAt:ts}),
          db.collection('notifications').add({toUid:studentId,title:'↩️ استرداد مبلغ',message:'تم إضافة '+egp(amt)+' لمحفظتك',read:false,isAdmin:true,link:'wallet',createdAt:ts}),
        ];
        if (tutorId && (bk.adminConfirmed||bk.paidToTutorAt)) {
          ops.push(db.collection('transactions').add({userId:tutorId,type:'debit',kind:'refund',amount:amt,description:'خصم استرداد للطالب · '+egp(amt),bookingId:bid,createdAt:ts}));
          ops.push(db.collection('notifications').add({toUid:tutorId,title:'📤 خصم استرداد',message:'تم خصم '+egp(amt)+' من محفظتك استرداداً للطالب',read:false,isAdmin:true,createdAt:ts}));
        }
        await Promise.all(ops);
        showT('✅ تم إرجاع '+egp(amt)+' للطالب' + (tutorId&&(bk.adminConfirmed||bk.paidToTutorAt)?' وخصمه من المعلم':''), 'suc');
        _reloadBk();
      } catch(e) { showT('❌ '+e.message,'err'); }
    };

    window.skl_transferToStudent = async function(bid, tutorId, studentId, amount) {
      var amt = r2(Number(amount||0));
      if (!confirm('تحويل '+egp(amt)+' من محفظة المعلم إلى محفظة الطالب؟')) return;
      try {
        await db.runTransaction(async function(tx) {
          var tRef=db.collection('wallets').doc(tutorId), sRef=db.collection('wallets').doc(studentId);
          var [tSn,sSn] = await Promise.all([tx.get(tRef),tx.get(sRef)]);
          var tBal=tSn.exists?Number(tSn.data().balance||0):0, sBal=sSn.exists?Number(sSn.data().balance||0):0;
          if (tBal < amt) throw new Error('رصيد المعلم غير كافٍ ('+egp(tBal)+')');
          tx.set(tRef, {balance:r2(tBal-amt),userId:tutorId}, {merge:true});
          tx.set(sRef, {balance:r2(sBal+amt),userId:studentId}, {merge:true});
          tx.update(db.collection('bookings').doc(bid), {transferredToStudent:true,transferredAt:fts()});
        });
        var ts = fts();
        await Promise.all([
          db.collection('transactions').add({userId:tutorId,type:'debit',kind:'transfer',amount:amt,description:'تحويل إداري للطالب · '+egp(amt),bookingId:bid,createdAt:ts}),
          db.collection('transactions').add({userId:studentId,type:'credit',kind:'transfer',amount:amt,description:'تحويل إداري من المعلم · '+egp(amt),bookingId:bid,createdAt:ts}),
          db.collection('notifications').add({toUid:tutorId,title:'💸 تحويل من رصيدك',message:'تم تحويل '+egp(amt)+' للطالب',read:false,isAdmin:true,createdAt:ts}),
          db.collection('notifications').add({toUid:studentId,title:'💰 تم إضافة رصيد',message:'تم إضافة '+egp(amt)+' من المعلم',read:false,isAdmin:true,createdAt:ts}),
        ]);
        showT('✅ تم تحويل '+egp(amt)+' من المعلم للطالب','suc'); _reloadBk();
      } catch(e) { showT('❌ '+e.message,'err'); }
    };

    /* لوحة إدارة الإعلانات */
    window.renderAdminAnnouncements = function() {
      var con = $id('adCon');
      if (!con) return;
      con.innerHTML = '<div style="padding:40px;text-align:center"><div class="spin" style="margin:0 auto"></div></div>';

      Promise.all([
        db.collection('users').get().catch(function(){return{docs:[]};}) ,
        db.collection('adminBroadcasts').orderBy('createdAt','desc').limit(30).get().catch(function(){return{docs:[]};})
      ]).then(function(res){
        var users    = res[0].docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var prevList = res[1].docs.map(function(d){return Object.assign({id:d.id},d.data());});
        var tutors   = users.filter(function(u){return u.role==='tutor'||u.role==='both';});
        var students = users.filter(function(u){return u.role==='learner'||u.role==='both';});

        con.innerHTML = '<div style="max-width:960px;margin:0 auto">'

          /* Header */
          + '<div style="background:linear-gradient(135deg,#0a1a3a,#0d47a1,#1565c0);border-radius:20px;padding:22px 26px;margin-bottom:22px;display:flex;align-items:center;gap:16px;color:#fff">'
          + '<div style="width:56px;height:56px;border-radius:50%;background:rgba(249,115,22,.28);border:2px solid rgba(249,115,22,.6);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">📢</div>'
          + '<div><div style="font-weight:900;font-size:1.1rem">مركز الإعلانات الرسمية</div>'
          + '<div style="opacity:.75;font-size:.82rem;margin-top:2px">'+users.length+' مستخدم · '+tutors.length+' معلم · '+students.length+' طالب</div></div>'
          + '</div>'

          /* نموذج إنشاء */
          + '<div style="background:var(--white,#fff);border:1px solid var(--border,#ddd);border-radius:20px;padding:24px;margin-bottom:20px">'
          + '<div style="font-weight:800;font-size:.95rem;margin-bottom:18px;display:flex;align-items:center;gap:8px"><span>✍️</span> إنشاء إعلان جديد</div>'
          + '<div style="display:grid;gap:14px">'
          + _fld('text','_annTitle','عنوان الإعلان *','مثال: تحديث مهم في المنصة')
          + _fld('textarea','_annBody','محتوى الإعلان *','تفاصيل الإعلان...',4)
          + _fld('url','_annImg','🖼️ رابط صورة (اختياري)','https://example.com/image.jpg')
          + _fld('url','_annLink','🔗 رابط خارجي (اختياري)','https://...')
          + '<div><label style="font-weight:700;font-size:.82rem;display:block;margin-bottom:10px">📌 إرسال إلى</label>'
          + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
          + [{v:'all',l:'الجميع',cnt:users.length,ic:'👥',c:'#1565c0'},{v:'tutor',l:'المعلمون',cnt:tutors.length,ic:'👨‍🏫',c:'#059669'},{v:'learner',l:'الطلاب',cnt:students.length,ic:'👩‍🎓',c:'#f97316'}]
            .map(function(t){
              return '<label onclick="_annTarget=\''+t.v+'\';document.querySelectorAll(\'._aTL\').forEach(function(x){x.style.outline=\'none\'});this.style.outline=\'2.5px solid '+t.c+'\'" class="_aTL" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:10px 16px;border:1.5px solid var(--border,#ddd);border-radius:12px;font-size:.85rem;background:var(--cream,#f4f7fc);flex:1;min-width:110px">'
                +'<span>'+t.ic+'</span><div><div style="font-weight:700">'+t.l+'</div>'
                +'<div style="font-size:.72rem;color:'+t.c+';font-weight:700">'+t.cnt+' مستخدم</div></div></label>';
            }).join('')
          + '</div></div></div>'
          + '<div style="margin-top:16px;display:flex;gap:10px;align-items:center">'
          + '<button onclick="sklSendAnn()" class="btn btn-p" id="_annSendBtn" style="min-width:160px;font-weight:800">📤 إرسال الإعلان</button>'
          + '<button onclick="[\'_annTitle\',\'_annBody\',\'_annImg\',\'_annLink\'].forEach(function(id){var el=document.getElementById(id);if(el)el.value=\'\'})" class="btn btn-gh">🗑 مسح</button>'
          + '</div>'
          + '<div id="_annMsg" style="display:none;margin-top:12px;padding:10px 14px;border-radius:10px;font-size:.83rem"></div>'
          + '</div>'

          /* جدول سجل الإعلانات */
          + '<div style="background:var(--white,#fff);border:1px solid var(--border,#ddd);border-radius:20px;overflow:hidden">'
          + '<div style="padding:16px 22px;border-bottom:1px solid var(--border,#ddd);display:flex;align-items:center;justify-content:space-between">'
          + '<div style="font-weight:800;font-size:.95rem">📋 سجل الإعلانات</div>'
          + '<span style="background:rgba(21,101,192,.1);color:#1565c0;border-radius:20px;padding:2px 12px;font-size:.75rem;font-weight:700">'+prevList.length+'</span></div>'
          + (prevList.length
            ? '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse"><thead><tr style="background:var(--cream,#f4f7fc)">'
              + ['العنوان','المحتوى','الفئة','المُرسَل إليهم','الصورة','التاريخ','حذف'].map(function(h){return '<th style="padding:10px 14px;text-align:right;font-weight:700;font-size:.78rem;white-space:nowrap">'+h+'</th>';}).join('')
              + '</tr></thead><tbody>'
              + prevList.map(function(n,i){
                  var dt=n.createdAt&&n.createdAt.toDate?n.createdAt.toDate().toLocaleDateString('ar-EG',{year:'numeric',month:'short',day:'numeric'}):'—';
                  var tc={'all':'#1565c0','tutor':'#059669','learner':'#f97316'}[n.target]||'#666';
                  var tl={'all':'الجميع','tutor':'المعلمون','learner':'الطلاب'}[n.target]||n.target||'—';
                  return '<tr style="border-top:1px solid var(--border,#ddd);'+(i%2?'background:var(--cream,#f4f7fc)':'')+'"><td style="padding:12px 14px;font-weight:700;font-size:.84rem;max-width:160px">'+esc(n.title||'—')+'</td><td style="padding:12px 14px;font-size:.79rem;color:var(--muted,#888);max-width:220px">'+esc((n.message||'').slice(0,90))+'</td><td style="padding:12px 14px;text-align:center"><span style="background:'+tc+'22;color:'+tc+';border-radius:20px;padding:3px 10px;font-size:.74rem;font-weight:700">'+esc(tl)+'</span></td><td style="padding:12px 14px;text-align:center;font-weight:800;color:#1565c0">'+(n.sentCount||0)+'</td><td style="padding:12px 14px;text-align:center">'+(n.imageUrl?'<img src="'+esc(n.imageUrl)+'" style="width:40px;height:40px;object-fit:cover;border-radius:8px" onerror="this.style.display=\'none\'">':'<span style="color:#aaa;font-size:.75rem">—</span>')+'</td><td style="padding:12px 14px;font-size:.77rem;color:#888;white-space:nowrap">'+esc(dt)+'</td><td style="padding:12px 14px;text-align:center"><button onclick="sklDelAnn(\''+n.id+'\',this)" style="background:rgba(239,68,68,.1);color:#ef4444;border:none;border-radius:8px;padding:5px 10px;cursor:pointer;font-size:.75rem;font-family:inherit">🗑</button></td></tr>';
                }).join('')
              + '</tbody></table></div>'
            : '<div style="text-align:center;padding:48px;color:#aaa"><div style="font-size:2.5rem;margin-bottom:10px">📭</div><p>لا توجد إعلانات سابقة</p></div>')
          + '</div></div>';

        window._annTarget = 'all';
      }).catch(function(e){
        if(con) con.innerHTML='<div style="padding:24px;color:red">خطأ: '+esc(e.message)+'</div>';
      });
    };

    /* إرسال إعلان جديد — يُكتب في adminBroadcasts مباشرةً */
    window.sklSendAnn = async function() {
      var titleEl=$id('_annTitle'), bodyEl=$id('_annBody'), imgEl=$id('_annImg'), linkEl=$id('_annLink');
      var msgEl=$id('_annMsg'), sendBtn=$id('_annSendBtn');
      var title  = titleEl ? titleEl.value.trim() : '';
      var body   = bodyEl  ? bodyEl.value.trim()  : '';
      var imgUrl = imgEl   ? imgEl.value.trim()   : '';
      var lnk    = linkEl  ? linkEl.value.trim()  : '';
      var target = window._annTarget || 'all';
      if (!title) { _annMsg(msgEl,'أدخل عنوان الإعلان','err'); return; }
      if (!body)  { _annMsg(msgEl,'أدخل محتوى الإعلان','err'); return; }

      /* عدد المستخدمين المستهدفين للإحصاء */
      var uSnap = await db.collection('users').get().catch(function(){return{docs:[]};});
      var cnt = uSnap.docs.filter(function(d){
        var u=d.data();
        if(target==='all')return true;
        if(target==='tutor')return u.role==='tutor'||u.role==='both';
        if(target==='learner')return u.role==='learner'||u.role==='both';
        return false;
      }).length;

      if (sendBtn) { sendBtn.disabled=true; sendBtn.textContent='⏳ جاري الإرسال...'; }
      _annMsg(msgEl,'⏳ يتم الإرسال...','inf');
      try {
        await db.collection('adminBroadcasts').add({
          title:title, message:body, imageUrl:imgUrl||'', link:lnk||'',
          target:target, sentCount:cnt,
          sentBy: firebase.auth().currentUser && firebase.auth().currentUser.uid,
          active: true,
          createdAt: fts()
        });
        _annMsg(msgEl,'✅ تم نشر الإعلان لـ '+cnt+' مستخدم','suc');
        showT('✅ الإعلان أُرسل','suc');
        if(titleEl)titleEl.value=''; if(bodyEl)bodyEl.value='';
        if(imgEl)imgEl.value=''; if(linkEl)linkEl.value='';
        setTimeout(window.renderAdminAnnouncements, 1400);
      } catch(e) { _annMsg(msgEl,'❌ '+e.message,'err'); }
      finally { if(sendBtn){sendBtn.disabled=false;sendBtn.textContent='📤 إرسال الإعلان';} }
    };

    /* حذف إعلان */
    window.sklDelAnn = async function(id, btn) {
      if (!confirm('حذف هذا الإعلان من الإدارة وجميع المستخدمين؟')) return;
      if (btn) btn.disabled = true;
      try {
        await db.collection('adminBroadcasts').doc(id).delete();
        showT('تم الحذف','suc'); setTimeout(window.renderAdminAnnouncements, 600);
      } catch(e) { showT('خطأ: '+e.message,'err'); if(btn) btn.disabled=false; }
    };

    /* تاب الإعلانات في Admin */
    waitFor(function(){return typeof window.adTab==='function';}, function(){
      var _orig = window.adTab;
      window.adTab = async function(tab, el) {
        if (tab === 'announcements') {
          document.querySelectorAll('.adminTab').forEach(function(t){t.className='btn btn-gh btn-sm adminTab';});
          if (el) el.className = 'btn btn-p btn-sm adminTab';
          window.renderAdminAnnouncements(); return;
        }
        var res = await _orig.apply(this, arguments);
        if (tab === 'bookings') setTimeout(_injectTransferBtns, 150);
        return res;
      };
    });

    function _fld(type,id,lbl,ph,rows) {
      var inp = type==='textarea'
        ? '<textarea id="'+id+'" rows="'+(rows||3)+'" placeholder="'+esc(ph)+'" style="width:100%;padding:11px 14px;border-radius:12px;border:1.5px solid var(--border,#ddd);font-size:.88rem;font-family:inherit;background:var(--cream,#f4f7fc);resize:vertical;line-height:1.6;box-sizing:border-box"></textarea>'
        : '<input type="'+type+'" id="'+id+'" placeholder="'+esc(ph)+'" '+(type==='url'?'dir="ltr"':'')+' style="width:100%;padding:11px 14px;border-radius:12px;border:1.5px solid var(--border,#ddd);font-size:.9rem;font-family:inherit;background:var(--cream,#f4f7fc);box-sizing:border-box"/>';
      return '<div><label style="font-weight:700;font-size:.82rem;display:block;margin-bottom:6px">'+esc(lbl)+'</label>'+inp+'</div>';
    }
    function _annMsg(el,txt,type) {
      if(!el) return; el.textContent=txt;
      var s={suc:'background:rgba(16,185,129,.1);color:#059669',err:'background:rgba(239,68,68,.1);color:#dc2626',inf:'background:rgba(21,101,192,.1);color:#1565c0'};
      el.style.cssText='display:block;padding:10px 14px;border-radius:10px;font-size:.83rem;margin-top:12px;'+(s[type]||s.inf);
      if(type!=='inf') setTimeout(function(){if(el)el.style.display='none';},5000);
    }
  }

  function _injectTransferBtns() {
    document.querySelectorAll('[onclick*="adminConfirmBk"]').forEach(function(btn){
      if (btn.dataset.tInj) return; btn.dataset.tInj='1';
      var m=btn.getAttribute('onclick').match(/adminConfirmBk\('([^']+)'\)/); if(!m) return;
      var bid=m[1], tb=document.createElement('button');
      tb.className='btn btn-o btn-xs'; tb.style.marginRight='4px'; tb.textContent='↔ للطالب';
      tb.title='تحويل مبلغ من محفظة المعلم للطالب';
      tb.onclick = async function() {
        var bkSn = await db.collection('bookings').doc(bid).get().catch(function(){return null;});
        if (!bkSn||!bkSn.exists) { showT('الحجز غير موجود','err'); return; }
        var bk = bkSn.data();
        var inp = prompt('المبلغ (ج.م):', r2(Number(bk.totalDue||bk.total||bk.price||0)).toString());
        if (inp===null) return;
        var amt = parseFloat(inp);
        if (isNaN(amt)||amt<=0) { showT('مبلغ غير صحيح','err'); return; }
        window.skl_transferToStudent(bid, bk.tutorId, bk.studentId, amt);
      };
      btn.parentNode.insertBefore(tb, btn.nextSibling);
    });
  }

  function _reloadBk() {
    if (typeof window.adTab === 'function')
      window.adTab('bookings', document.querySelector('.adminTab[onclick*="bookings"]') || document.querySelector('.adminTab'));
  }

})();
