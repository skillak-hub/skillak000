/* patch_final.js v7.1 - Skillak */
'use strict';

function _pf_getCU()  { return typeof CU  !== 'undefined' ? CU  : null; }
function _pf_getCP()  { return typeof CP  !== 'undefined' ? CP  : null; }
function _pf_getDb()  { return typeof db  !== 'undefined' ? db  : null; }

/* ── isBookingStillOpen ── */
window.isBookingStillOpen = function(bk) {
  if (!bk) return false;
  if (!['confirmed','active','paused'].includes(bk.status)) return false;
  const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : 0;
  if (!endMs) return true;
  return Date.now() <= endMs;
};
window.canJoinSession = b => window.isBookingStillOpen(b);


/* ── enterSession (نظيف - بدون window.CU) ── */
window.enterSession = async function(bookingId) {
  const _db = _pf_getDb(), _CU = _pf_getCU(), _CP = _pf_getCP();
  if (!bookingId) { if (typeof showT==='function') showT('معرّف الجلسة غير صحيح','err'); return; }
  if (!_CU) { if (typeof openM==='function') openM('loginMod'); return; }

  let bk;
  try {
    const s = await _db.collection('bookings').doc(bookingId).get();
    if (!s.exists) { if (typeof showT==='function') showT('لم يُعثر على الجلسة','err'); return; }
    bk = { id: bookingId, ...s.data() };
  } catch(e) { if (typeof showT==='function') showT('خطأ: '+e.message,'err'); return; }

  if (!['confirmed','active','paused'].includes(bk.status)) {
    const m = {pending:'⏳ الجلسة لم تُؤكد بعد',completed:'🏁 انتهت مسبقاً',cancelled:'❌ ملغاة',refunded:'↩️ مُستردّة'};
    if (typeof showT==='function') showT(m[bk.status]||'حالة: '+bk.status,'err'); return;
  }

  const uid=_CU.uid, isStudent=bk.studentId===uid, isTutor=bk.tutorId===uid, isAdmin=_CP?.role==='admin';
  if (!isStudent && !isTutor && !isAdmin) { if (typeof showT==='function') showT('⛔ لا صلاحية','err'); return; }

  const startMs = Number(bk.sessionStartsAtMs || 0) || (typeof getBookingStartMs === 'function' ? Number(getBookingStartMs(bk) || 0) : 0);
  const durationMs = Number(bk.duration || 60) * 60000;
  const baseEndMs = Number(bk.sessionEndsAtMs || 0) || (typeof getBookingEndMs === 'function' ? Number(getBookingEndMs(bk) || 0) : 0) || (startMs ? startMs + durationMs : 0);
  const remainingFromPause = bk.status === 'paused'
    ? Number(bk.sessionRemainingMs || Math.max(0, baseEndMs - Date.now()) || durationMs)
    : Math.max(0, baseEndMs - Date.now());
  const totalEndMs = Date.now() + (bk.status === 'paused' ? remainingFromPause : (baseEndMs ? Math.max(0, baseEndMs - Date.now()) : durationMs));

  try {
    await _db.collection('bookings').doc(bookingId).set({
      status:'active',
      resumedAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastEnteredAt: firebase.firestore.FieldValue.serverTimestamp(),
      sessionResumedAtMs: Date.now(),
      ...(startMs ? { sessionStartsAtMs: startMs } : {}),
      sessionRemainingMs: firebase.firestore.FieldValue.delete(),
      ...(totalEndMs ? { sessionEndsAtMs: totalEndMs } : {})
    },{merge:true});
    bk.status = 'active';
  } catch(_){}

  curSesBid=bookingId; curSesBk=bk; unreadSes=0;
  if (sesTInt){clearInterval(sesTInt);sesTInt=null;}
  if (sesChatL){try{sesChatL();}catch(_){} sesChatL=null;}

  const $=id=>document.getElementById(id);
  const waitOv=$('waitOv'), sesDot=$('sesDot'), sesTxt=$('sesTxt'), sesTimerEl=$('sesTimer');
  if ($('sesTitle')) $('sesTitle').textContent=`جلسة مع ${isTutor?bk.studentName:bk.tutorName}`;
  if ($('mainNav')) $('mainNav').style.display='none';
  if (waitOv){waitOv.classList.remove('hidden');waitOv.style.display='';}
  if (sesDot) sesDot.style.background='var(--amber)';
  if (sesTxt) sesTxt.textContent='جاري الاتصال...';
  if (sesTimerEl) sesTimerEl.textContent='00:00:00';

  _pf_buildWaitingRoom(waitOv,bk,isTutor);
  if (typeof go==='function') go('session');

  try {
    locSt=await navigator.mediaDevices.getUserMedia({video:true,audio:true});
    const lv=$('locVid'); if(lv) lv.srcObject=locSt;
    micOn=true; camOn=true; if(typeof updCtrl==='function') updCtrl();
  } catch(e) { if(typeof showT==='function') showT('⚠️ تعذّر الكاميرا: '+e.message,'err'); locSt=null; }

  if(pc){try{pc.close();}catch(_){}pc=null;}
  pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun1.l.google.com:19302'}]});
  const _pc=pc;
  if(locSt) locSt.getTracks().forEach(t=>_pc.addTrack(t,locSt));

  let autoEnded = false;
  const tick = () => {
    if (totalEndMs) {
      const rem = Math.max(0, totalEndMs - Date.now());
      sesSec = Math.max(0, Math.floor(rem / 1000));
      const h=String(Math.floor(sesSec/3600)).padStart(2,'0');
      const m=String(Math.floor((sesSec%3600)/60)).padStart(2,'0');
      const s=String(sesSec%60).padStart(2,'0');
      if (sesTimerEl) sesTimerEl.textContent=`${h}:${m}:${s}`;
      if (rem <= 0 && !autoEnded) {
        autoEnded = true;
        if (typeof showT==='function') showT('⏰ انتهت مدة الجلسة', 'inf');
        setTimeout(() => { if (typeof window.endSession === 'function') window.endSession(bookingId, { auto: true }); }, 50);
      }
    }
  };
  tick();
  sesTInt = setInterval(tick, 1000);

  _pc.ontrack=e=>{
    const rv=$('remVid'); if(rv) rv.srcObject=e.streams[0];
    if(waitOv) waitOv.classList.add('hidden');
    if(sesDot) sesDot.style.background='var(--green)';
    if(sesTxt) sesTxt.textContent='متصل ✓';
  };

  let iceR=0;
  _pc.oniceconnectionstatechange=()=>{
    const st=_pc.iceConnectionState;
    if(['disconnected','failed'].includes(st)){
      if(sesDot) sesDot.style.background='var(--red)';
      if(sesTxt) sesTxt.textContent='📶 انقطع...';
      if(waitOv) waitOv.classList.remove('hidden');
      if(iceR<3){iceR++;setTimeout(()=>{try{_pc.restartIce?.();}catch(_){}},2000*iceR);}
    } else if(st==='connected'){
      if(sesDot) sesDot.style.background='var(--green)';
      if(sesTxt) sesTxt.textContent='متصل ✓'; iceR=0;
      if(waitOv) waitOv.classList.add('hidden');
    }
  };

  const sesRef=_db.collection('sessions').doc(bookingId);
  if(isTutor||(isAdmin&&!isStudent)){
    _pc.onicecandidate=async e=>{if(e.candidate) await sesRef.collection('tCand').add(e.candidate.toJSON()).catch(()=>{});};
    const offer=await _pc.createOffer();
    await _pc.setLocalDescription(offer);
    await sesRef.set({
      offer:{type:offer.type,sdp:offer.sdp},
      tutorId:uid,
      status:'active',
      startedAt:firebase.firestore.FieldValue.serverTimestamp(),
      sessionStartsAtMs: startMs || firebase.firestore.FieldValue.serverTimestamp(),
      sessionEndsAtMs: totalEndMs || endMs || null
    },{merge:true});
    const u=sesRef.onSnapshot(async s=>{const d=s.data();if(d?.answer&&!_pc.currentRemoteDescription){try{await _pc.setRemoteDescription(new RTCSessionDescription(d.answer));u();}catch(_){}}});
    sesRef.collection('sCand').onSnapshot(s=>s.docChanges().forEach(async c=>{if(c.type==='added'){try{await _pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));}catch(_){}}}));
  } else {
    _pc.onicecandidate=async e=>{if(e.candidate) await sesRef.collection('sCand').add(e.candidate.toJSON()).catch(()=>{});};
    const doAns=async offer=>{
      if(_pc.currentRemoteDescription) return;
      try{
        await _pc.setRemoteDescription(new RTCSessionDescription(offer));
        const a=await _pc.createAnswer();
        await _pc.setLocalDescription(a);
        await sesRef.set({
          answer:{type:a.type,sdp:a.sdp},
          studentId:uid,
          status:'active',
          sessionStartsAtMs: startMs || firebase.firestore.FieldValue.serverTimestamp(),
          sessionEndsAtMs: totalEndMs || endMs || null
        },{merge:true});
      }catch(_){}
    };
    const init=await sesRef.get();
    if(init.exists&&init.data()?.offer) await doAns(init.data().offer);
    else{const u2=sesRef.onSnapshot(async s=>{const d=s.data();if(d?.offer&&!_pc.currentRemoteDescription){await doAns(d.offer);u2();}});}
    sesRef.collection('tCand').onSnapshot(s=>s.docChanges().forEach(async c=>{if(c.type==='added'){try{await _pc.addIceCandidate(new RTCIceCandidate(c.doc.data()));}catch(_){}}}));
  }

  if(typeof loadSesChat==='function') loadSesChat(bookingId);

  setTimeout(()=>{
    const endBtn=$('endBtn'); if(!endBtn) return;
    if(isStudent&&!isTutor){
      endBtn.innerHTML='📵'; endBtn.title='إنهاء الجلسة نهائياً';
      endBtn.style.cssText='background:linear-gradient(135deg,#dc2626,#b91c1c);box-shadow:0 4px 15px rgba(220,38,38,.4);width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:1.4rem;display:flex;align-items:center;justify-content:center';
      const lbl=endBtn.closest?.('.cwrap')?.querySelector?.('.clbl'); if(lbl) lbl.textContent='إنهاء';
    } else if(isTutor){
      endBtn.innerHTML='🚪'; endBtn.title='خروج مؤقت';
      endBtn.style.cssText='background:rgba(245,158,11,.25);box-shadow:0 2px 8px rgba(0,0,0,.2);width:56px;height:56px;border-radius:50%;border:none;cursor:pointer;font-size:1.4rem;display:flex;align-items:center;justify-content:center';
      const lbl=endBtn.closest?.('.cwrap')?.querySelector?.('.clbl'); if(lbl) lbl.textContent='خروج';
    }
    const exitWrap = $('studentExitWrap');
    if (exitWrap) {
      exitWrap.style.display='flex';
      exitWrap.style.alignItems='center';
      exitWrap.style.flexDirection='column';
    }
  },1000);

  if(typeof showT==='function') showT('📡 جاري الاتصال بالجلسة...','inf');
};

/* ── غرفة الانتظار ── */
function _pf_buildWaitingRoom(waitOv,bk,isTutor){
  if(!waitOv) return;
  const other=isTutor?(bk.studentName||'الطالب'):(bk.tutorName||'المعلم');
  const endMs=typeof getBookingEndMs==='function'?getBookingEndMs(bk):0;
  waitOv.innerHTML=`<div class="swr-inner"><div class="swr-logo">Skill<span>ak</span></div><div class="swr-av"><div class="swr-initials" style="background:linear-gradient(135deg,#0d6e75,#14b8a6);color:#fff">${other.charAt(0)||'؟'}</div></div><p class="swr-name">${other}</p><p class="swr-role">${isTutor?'الطالب':'المعلم'}</p><div class="swr-status"><div class="swr-spin"></div><span>في انتظار الانضمام...</span></div><div id="pfWaitCD" style="font-size:.8rem;color:rgba(255,255,255,.5);margin-top:4px"></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px"><button onclick="window._pfRetry()" style="background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:10px;padding:8px 16px;font-size:.82rem;cursor:pointer;font-family:'Cairo',sans-serif">🔄 إعادة الاتصال</button><button onclick="window._pfExitWait()" style="background:transparent;color:rgba(255,255,255,.5);border:1px solid rgba(255,255,255,.15);border-radius:10px;padding:8px 16px;font-size:.82rem;cursor:pointer;font-family:'Cairo',sans-serif">← الخروج</button></div></div>`;
  if(endMs){
    const el=document.getElementById('pfWaitCD');
    const tick=()=>{if(!el)return;const rem=Math.max(0,endMs-Date.now());if(rem<=0){el.textContent='⏰ انتهى الوقت';return;}const m=Math.floor(rem/60000),s=Math.floor((rem%60000)/1000);el.textContent=`⏱️ ${m}:${String(s).padStart(2,'0')} متبقي`;setTimeout(tick,1000);};
    tick();
  }
}
window._pfRetry=async function(){const bid=typeof curSesBid!=='undefined'?curSesBid:null;if(!bid)return;if(typeof pc!=='undefined'&&pc){try{pc.close();}catch(_){}pc=null;}await window.enterSession(bid);};
window._pfExitWait=async function(bookingId){
  const _db=_pf_getDb(), _CU=_pf_getCU();
  const bid = bookingId || (typeof curSesBid!=='undefined' ? curSesBid : null);
  const uid = _CU?.uid;
  const bk = typeof curSesBk!=='undefined' ? curSesBk : null;
  if (!bid || !_db) return;

  try {
    const doc = bk || ((await _db.collection('bookings').doc(bid).get()).data() || null);
    const endMs = typeof getBookingEndMs==='function' ? getBookingEndMs(doc) : (doc?.sessionEndsAtMs || 0);
    const remainingMs = Math.max(0, (Number(endMs || 0) || 0) - Date.now());

    await _db.collection('bookings').doc(bid).set({
      status:'paused',
      lastPausedAt: firebase.firestore.FieldValue.serverTimestamp(),
      pausedBy: uid,
      sessionPausedAtMs: Date.now(),
      sessionRemainingMs: remainingMs
    }, { merge:true }).catch(()=>{});
    await _db.collection('sessions').doc(bid).set({
      status:'paused',
      pausedAt: firebase.firestore.FieldValue.serverTimestamp(),
      pausedBy: uid,
      sessionRemainingMs: remainingMs
    }, { merge:true }).catch(()=>{});

    if (typeof curSesBid !== 'undefined' && curSesBid === bid) {
      _pfCleanup();
      curSesBid = null;
      curSesBk = null;
      if(document.getElementById('mainNav'))document.getElementById('mainNav').style.display='';
      if(typeof go==='function')go('dashboard');
      setTimeout(()=>{if(typeof dNav==='function')dNav('sessions');},300);
    }
    if (typeof showT==='function') showT('🚪 غادرت الجلسة مؤقتاً — يمكنك العودة قبل انتهاء الوقت', 'inf');
  } catch(e) {
    console.warn('[pf exit]', e);
  }
};

/* ── endSession ── */
/* ── endSession ── */
window.endSession=async function(bookingId, opts = {}){
  const _db=_pf_getDb(),_CU=_pf_getCU();
  const bid=bookingId || (typeof curSesBid!=='undefined'?curSesBid:null);
  let bk=typeof curSesBk!=='undefined'?curSesBk:null;
  const uid=_CU?.uid;

  if (bid && !bk && _db) {
    try {
      const s = await _db.collection('bookings').doc(bid).get();
      bk = s.exists ? s.data() : null;
    } catch(_) {}
  }

  if(!bid||!bk||!uid){
    _pfCleanup();
    if(typeof curSesBid!=='undefined')curSesBid=null;
    if(typeof curSesBk!=='undefined')curSesBk=null;
    if(document.getElementById('mainNav'))document.getElementById('mainNav').style.display='';
    if(typeof go==='function')go('dashboard');
    setTimeout(()=>{if(typeof dNav==='function')dNav('sessions');},300);
    return;
  }

  const isStudent=bk.studentId===uid,isTutor=bk.tutorId===uid;
  const endMs = typeof getBookingEndMs === 'function' ? getBookingEndMs(bk) : Number(bk.sessionEndsAtMs || 0);
  const remainingSec = endMs ? Math.max(0, Math.round((endMs - Date.now()) / 1000)) : Number(typeof sesSec !== 'undefined' ? sesSec : 0);
  const totalDurSec = Number(bk.duration || 60) * 60;
  const elapsedSec = endMs ? Math.max(0, totalDurSec - remainingSec) : remainingSec;
  const mins=Math.floor(elapsedSec/60),secs=elapsedSec%60;
  const durStr=mins>0?`${mins} دقيقة${secs>0?' و'+secs+' ثانية':''}`:secs+' ثانية';
  const auto = !!opts.auto;

  if(isStudent){
    if(!auto && !confirm(`إنهاء الجلسة نهائياً؟
المدة: ${durStr}

⚠️ لن يتمكن أحد من العودة.`)) return;
    _pfCleanup();
    try{
      await _db.collection('bookings').doc(bid).update({status:'completed',completedAt:firebase.firestore.FieldValue.serverTimestamp(),completedBy:uid,actualDuration:mins||bk.duration||60,adminConfirmed:false,paymentStatus:'pending_admin'});
      await _db.collection('sessions').doc(bid).set({status:'ended',endedAt:firebase.firestore.FieldValue.serverTimestamp(),endedBy:uid},{merge:true}).catch(()=>{});
      _db.collection('adminNotifications').add({type:'session_completed',bookingId:bid,tutorName:bk.tutorName||'—',studentName:bk.studentName||'—',price:bk.price||0,read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),message:'انتهت الجلسة — يتطلب اعتماد الأدمن'}).catch(()=>{});
    }catch(e){console.error('[pf]',e);}
    curSesBid=null;curSesBk=null;
    if(document.getElementById('mainNav'))document.getElementById('mainNav').style.display='';
    if(typeof go==='function')go('dashboard');
    setTimeout(()=>{if(typeof dNav==='function')dNav('sessions');},300);
    if(!auto) setTimeout(()=>{if(!bk.reviewed&&typeof openRevFromBk==='function')openRevFromBk(bid,bk.tutorId,bk.tutorName||'المعلم');},800);
  } else if(isTutor){
    const endMs=typeof getBookingEndMs==='function'?getBookingEndMs(bk):0;
    const remainingMs=Math.max(0, Number(endMs || 0) - Date.now());
    const remMin=remainingMs?Math.max(0,Math.round(remainingMs/60000)):'؟';
    if(!auto && !confirm(`الخروج مؤقتاً؟
⏸️ الجلسة تبقى نشطة (${remMin} دقيقة)

يمكنك العودة لاحقاً.`)) return;
    _pfCleanup();
    try{
      await _db.collection('bookings').doc(bid).set({status:'paused',lastPausedAt:firebase.firestore.FieldValue.serverTimestamp(),pausedBy:uid,sessionPausedAtMs:Date.now(),sessionRemainingMs:remainingMs},{merge:true});
      await _db.collection('sessions').doc(bid).set({status:'paused',pausedAt:firebase.firestore.FieldValue.serverTimestamp(),sessionRemainingMs:remainingMs},{merge:true}).catch(()=>{});
    }catch(_){}
    curSesBid=null;curSesBk=null;
    if(document.getElementById('mainNav'))document.getElementById('mainNav').style.display='';
    if(typeof go==='function')go('dashboard');
    setTimeout(()=>{if(typeof dNav==='function')dNav('sessions');},300);
    if(typeof showT==='function')showT(auto ? '⏸️ تم إيقاف الجلسة مؤقتاً تلقائياً' : '⏸️ خرجت مؤقتاً — يمكنك العودة لاحقاً','inf');
  }
};

function _pfCleanup(){
  if(typeof sesTInt!=='undefined'&&sesTInt){clearInterval(sesTInt);sesTInt=null;}
  if(typeof _pfSessionMonitor!=='undefined'&&_pfSessionMonitor){clearInterval(_pfSessionMonitor);_pfSessionMonitor=null;}
  if(typeof sesChatL!=='undefined'&&sesChatL){try{sesChatL();}catch(_){}sesChatL=null;}
  if(typeof pc!=='undefined'&&pc){try{pc.close();}catch(_){}pc=null;}
  if(typeof locSt!=='undefined'&&locSt){try{locSt.getTracks().forEach(t=>t.stop());}catch(_){}locSt=null;}
  if(typeof scrSt!=='undefined'&&scrSt){try{scrSt.getTracks().forEach(t=>t.stop());}catch(_){}scrSt=null;}
}

/* ════════════════════════════════════════════════════
   لوحة تحكم مزدوجة لمستخدم "الاثنان"
   ════════════════════════════════════════════════════ */
const _pf_origRdOverview = window.rdOverview;
window.rdOverview = async function(el) {
  const _CU=_pf_getCU(), _CP=_pf_getCP(), _db=_pf_getDb();
  if (!_CU||!_CP||!_db||_CP.role!=='both') {
    if (typeof _pf_origRdOverview==='function') return _pf_origRdOverview(el);
    return;
  }
  el.innerHTML='<div style="text-align:center;padding:40px"><div class="spin" style="margin:0 auto"></div></div>';
  try {
    const uid=_CU.uid, p=_CP;
    const [sb,tb,ws]=await Promise.all([
      _db.collection('bookings').where('studentId','==',uid).get().catch(()=>({docs:[]})),
      _db.collection('bookings').where('tutorId','==',uid).get().catch(()=>({docs:[]})),
      _db.collection('wallets').doc(uid).get().catch(()=>null)
    ]);
    const sB=sb.docs.map(d=>({id:d.id,...d.data()})), tB=tb.docs.map(d=>({id:d.id,...d.data()}));
    const walBal=ws?.exists?Number(ws.data()?.balance||0):0;
    const sComp=sB.filter(b=>b.status==='completed').length;
    const sUp=sB.filter(b=>['pending','confirmed','active','paused'].includes(b.status)).length;
    const sSpent=sB.filter(b=>b.status==='completed').reduce((s,b)=>s+Number(b.price||0)+Number(b.studentFee||0),0);
    const tComp=tB.filter(b=>b.status==='completed').length;
    const tUp=tB.filter(b=>['pending','confirmed','active','paused'].includes(b.status)).length;
    const tEarn=tB.filter(b=>b.status==='completed').reduce((s,b)=>s+Number((b.price||0)-(b.tutorFee??b.fee??0)),0);
    const tPend=tB.filter(b=>b.status==='pending').length;
    const allBks=[...sB,...tB].filter((b,i,a)=>a.findIndex(x=>x.id===b.id)===i).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,8);
    const upAll=allBks.filter(b=>['pending','confirmed','active','paused'].includes(b.status));

    el.innerHTML=`
<div class="dashphdr">
  <div><div style="font-size:.72rem;font-weight:800;letter-spacing:.1em;color:var(--amber);margin-bottom:3px">لوحة التحكم</div><div class="dashph">مرحباً، ${p.name?.split(' ')[0]||'أهلاً'} 👋</div></div>
  <button class="btn btn-p" onclick="go('explore')">+ احجز جلسة</button>
</div>

<div style="background:linear-gradient(135deg,#0a0a1a,#0d1a2e);border-radius:18px;padding:14px 18px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
  <div style="display:flex;align-items:center;gap:12px">
    <span style="font-size:1.5rem">💳</span>
    <div><div style="font-size:.7rem;color:rgba(255,255,255,.4);margin-bottom:2px">رصيد المحفظة</div><div style="font-size:1.5rem;font-weight:900;font-family:'Fraunces',serif;color:#fff">${walBal.toFixed(2)}<span style="font-size:.75rem;opacity:.6"> ج.م</span></div></div>
  </div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-p btn-sm" onclick="go('wallet')">شحن</button>
    <button class="btn btn-gh btn-sm" onclick="go('wallet')">💸 سحب</button>
  </div>
</div>

<div class="dual-block student-block">
  <div class="dual-block-hd">
    <div class="dual-block-icon">📚</div>
    <div><div class="dual-block-title">أنا كمتعلم</div><div class="dual-block-sub">جلساتي التي حجزتها</div></div>
    <button class="btn btn-sm" style="margin-right:auto;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.2)" onclick="dNav('sessions')">عرض ←</button>
  </div>
  <div class="dual-stats">
    <div class="ds-item"><div class="ds-val">${sB.length}</div><div class="ds-lbl">إجمالي</div></div>
    <div class="ds-item"><div class="ds-val">${sComp}</div><div class="ds-lbl">مكتملة ✅</div></div>
    <div class="ds-item"><div class="ds-val">${sUp}</div><div class="ds-lbl">قادمة ⏰</div></div>
    <div class="ds-item"><div class="ds-val">${sSpent.toFixed(0)}<small> ج.م</small></div><div class="ds-lbl">الإنفاق</div></div>
  </div>
  ${sUp>0?`<div class="dual-alert">⏰ <strong>${sUp} جلسة</strong> قادمة كطالب<button onclick="dNav('sessions')" style="margin-right:auto;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:.78rem">عرض</button></div>`:`<div class="dual-alert" style="background:rgba(255,255,255,.08);border:none">💡 ابحث عن معلم جديد<button onclick="go('explore')" style="margin-right:auto;background:rgba(255,255,255,.15);color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:.78rem">استكشف ←</button></div>`}
</div>

<div class="dual-block teacher-block">
  <div class="dual-block-hd">
    <div class="dual-block-icon">🎓</div>
    <div><div class="dual-block-title">أنا كمعلم</div><div class="dual-block-sub">${p.category||'معلم'} · ${(p.rating||0).toFixed(1)} ⭐ · $${p.price||0}/ساعة</div></div>
    <button class="btn btn-sm" style="margin-right:auto;background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.2)" onclick="go('editProfile')">تعديل ✏️</button>
  </div>
  <div class="dual-stats">
    <div class="ds-item"><div class="ds-val">${tComp}</div><div class="ds-lbl">مكتملة</div></div>
    <div class="ds-item"><div class="ds-val">${tUp}</div><div class="ds-lbl">قادمة ⏰</div></div>
    <div class="ds-item"><div class="ds-val">${tEarn.toFixed(0)}<small> ج.م</small></div><div class="ds-lbl">الأرباح 💰</div></div>
    <div class="ds-item"><div class="ds-val">${(p.rating||0).toFixed(1)}<small>⭐</small></div><div class="ds-lbl">تقييمي</div></div>
  </div>
  ${tPend>0?`<div class="dual-alert" style="background:rgba(245,158,11,.15);border-color:rgba(245,158,11,.3)">🔔 <strong>${tPend} طلب</strong> ينتظر موافقتك<button onclick="dNav('sessions')" style="margin-right:auto;background:rgba(245,158,11,.25);color:#fff;border:none;border-radius:8px;padding:5px 12px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:.78rem">راجع</button></div>`:`<div class="dual-teacher-info"><span class="dti-badge">🏆 ${p.experience||0} سنة</span><span class="dti-badge">📂 ${p.category||'—'}</span><span class="dti-badge">🌐 ${p.language||'عربي'}</span><button onclick="dNav('availability')" class="btn btn-sm dti-btn">⏰ أوقاتي</button></div>`}
</div>

${upAll.length>0?`<div class="dsec" style="margin-bottom:16px;border-color:var(--teal)"><div class="dsech" style="background:var(--teal3)"><div class="dsect" style="color:var(--teal)">⏰ الجلسات القادمة (${upAll.length})</div><button class="btn btn-p btn-sm" onclick="dNav('sessions')">الكل</button></div>${typeof bkTblHTML==='function'?bkTblHTML(upAll):''}</div>`:''}
<div class="dsec"><div class="dsech"><div class="dsect">📋 آخر الجلسات</div><button class="btn btn-gh btn-sm" onclick="dNav('sessions')">الكل</button></div>${typeof bkTblHTML==='function'?bkTblHTML(allBks):'<p style="padding:16px;color:var(--muted)">لا توجد جلسات</p>'}</div>`;

  } catch(e) {
    console.error('[pf] rdOverview both:',e);
    if(typeof _pf_origRdOverview==='function') return _pf_origRdOverview(el);
  }
};

/* ── Admin session button ── */
function _pf_addAdminSesBtn(){
  document.querySelectorAll('#adCon table tbody tr').forEach(row=>{
    if(row.querySelector('.pf-adm-ses')) return;
    let bid=null;
    row.querySelectorAll('button[onclick]').forEach(btn=>{const m=btn.getAttribute('onclick')?.match(/['"]([A-Za-z0-9]{15,})['"]/);if(m&&!bid)bid=m[1];});
    if(!bid) return;
    const pill=row.querySelector('.pill'), txt=pill?.textContent||'';
    if(!['نشطة','مؤكدة','معلقة','confirmed','active','paused','✓'].some(s=>txt.includes(s))) return;
    const lastTd=row.querySelector('td:last-child'); if(!lastTd) return;
    const b=document.createElement('button');
    b.className='pf-adm-ses btn btn-p btn-xs';
    b.style.cssText='margin-top:5px;width:100%;background:linear-gradient(135deg,#0d6e75,#14b8a6)!important;color:#fff!important;font-weight:800!important';
    b.textContent='🎥 دخول الجلسة (أدمن)'; b.onclick=()=>window.enterSession(bid);
    lastTd.appendChild(b);
  });
}
const _pf_prevAdTab=window.adTab;
window.adTab=async function(tab,el){
  const r=typeof _pf_prevAdTab==='function'?await _pf_prevAdTab(tab,el):undefined;
  if(tab==='bookings') setTimeout(_pf_addAdminSesBtn,600);
  return r;
};

/* ── CSS ── */
(()=>{const s=document.createElement('style');s.textContent=`
.dual-block{border-radius:20px;padding:18px 20px;margin-bottom:14px;color:#fff}
.student-block{background:linear-gradient(135deg,#1e40af,#3b82f6);box-shadow:0 6px 24px rgba(59,130,246,.2)}
.teacher-block{background:linear-gradient(135deg,#064e3b,#059669);box-shadow:0 6px 24px rgba(5,150,105,.2)}
.dual-block-hd{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.dual-block-icon{width:44px;height:44px;border-radius:13px;background:rgba(255,255,255,.16);display:flex;align-items:center;justify-content:center;font-size:1.35rem;flex-shrink:0}
.dual-block-title{font-weight:900;font-size:1rem}
.dual-block-sub{font-size:.73rem;opacity:.65;margin-top:2px}
.dual-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
@media(max-width:540px){.dual-stats{grid-template-columns:repeat(2,1fr)}}
.ds-item{background:rgba(255,255,255,.12);border-radius:12px;padding:10px 8px;text-align:center}
.ds-val{font-size:1.4rem;font-weight:900;font-family:'Fraunces',serif;line-height:1}
.ds-val small{font-size:.62rem;font-weight:600;opacity:.7}
.ds-lbl{font-size:.63rem;opacity:.7;margin-top:4px}
.dual-alert{display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.1);border-radius:10px;padding:9px 13px;font-size:.81rem;margin-top:4px;flex-wrap:wrap}
.dual-teacher-info{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:4px}
.dti-badge{background:rgba(255,255,255,.14);border-radius:8px;padding:4px 10px;font-size:.76rem;font-weight:700}
.dti-btn{background:rgba(255,255,255,.16)!important;color:#fff!important;border:1px solid rgba(255,255,255,.25)!important}
`;document.head.appendChild(s);})();

/* ── PWA ── */
let _pf_dp = null;
let _pfSessionMonitor = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _pf_dp = e;
});
window.addEventListener('appinstalled', () => {
  _pf_dp = null;
});

console.log('✅ patch_final.js v7.2 loaded — Session timing + finalization');
