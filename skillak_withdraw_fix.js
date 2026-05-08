(function () {
  'use strict';

  const MIN_WITHDRAW = 50;
  const METHOD_LABELS = {
    instapay: 'InstaPay',
    vodafone: 'فودافون كاش',
    fawry: 'Fawry',
    bank: 'تحويل بنكي'
  };
  const METHOD_HINTS = {
    instapay: { label: 'رقم الهاتف المرتبط بـ InstaPay', placeholder: '01xxxxxxxxx' },
    vodafone: { label: 'رقم فودافون كاش', placeholder: '01xxxxxxxxx' },
    fawry: { label: 'رقم المحفظة / الحساب المرتبط بـ Fawry', placeholder: '01xxxxxxxxx' },
    bank: { label: 'رقم الحساب / IBAN', placeholder: 'EG18XXXX...' }
  };

  let activeWithdrawMethod = 'instapay';

  function byId(id) { return document.getElementById(id); }
  function toast(msg, type) { if (typeof window.showT === 'function') window.showT(msg, type); }
  function isTutorRole(role) { return ['tutor', 'both', 'admin'].includes(String(role || '').toLowerCase()); }

  function ensureHiddenMethodField() {
    const card = byId('withdrawCard');
    if (!card) return null;
    let hidden = byId('wdMethod');
    if (!hidden) {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.id = 'wdMethod';
      hidden.value = activeWithdrawMethod;
      card.querySelector('.cb')?.appendChild(hidden);
    }
    return hidden;
  }

  function currentMethod() {
    const hidden = byId('wdMethod');
    const val = hidden?.value || activeWithdrawMethod || 'instapay';
    return METHOD_LABELS[val] ? val : 'instapay';
  }

  function syncWithdrawUI(method) {
    const m = METHOD_LABELS[method] ? method : 'instapay';
    activeWithdrawMethod = m;
    const hidden = ensureHiddenMethodField();
    if (hidden) hidden.value = m;

    document.querySelectorAll('.withdraw-method-btn').forEach(btn => {
      btn.classList.toggle('sel', btn.id === `wm-${m}`);
    });

    const hint = METHOD_HINTS[m] || METHOD_HINTS.instapay;
    const labelEl = byId('wdAccLabel');
    const accEl = byId('wdAccNum') || byId('wdAccount');
    const nameEl = byId('wdAccName') || byId('wdName');

    if (labelEl) labelEl.innerHTML = `${hint.label} <span class="req">*</span>`;
    if (accEl) {
      accEl.placeholder = hint.placeholder;
      accEl.style.direction = 'ltr';
      accEl.autocomplete = 'off';
      accEl.inputMode = 'text';
      accEl.value = accEl.value.trim();
    }
    if (nameEl) nameEl.placeholder = 'الاسم الكامل كما هو مسجل';
  }

  async function safeGetWalletBalance() {
    try {
      const uid = window.CU?.uid;
      if (!uid || !window.db) return 0;
      const snap = await db.collection('wallets').doc(uid).get();
      return snap?.exists ? Number(snap.data().balance || 0) : 0;
    } catch (_) {
      return Number(window.walBal || 0);
    }
  }

  function selectedMethodFromUI() {
    const hidden = byId('wdMethod');
    if (hidden && METHOD_LABELS[hidden.value]) return hidden.value;

    const sel = document.querySelector('.withdraw-method-btn.sel');
    if (sel?.id) {
      const m = sel.id.replace('wm-', '');
      if (METHOD_LABELS[m]) return m;
    }
    return activeWithdrawMethod || 'instapay';
  }

  window.selWdMethod = function selWdMethod(method) { syncWithdrawUI(method); };
  window.updWdFields = function updWdFields() { syncWithdrawUI(selectedMethodFromUI()); };

  window.submitWithdrawal = async function submitWithdrawal() {
    if (!window.CU) { if (typeof window.openM === 'function') openM('loginMod'); return; }
    const role = String(window.CP?.role || '').toLowerCase();
    if (!isTutorRole(role)) { toast('طلب سحب الأرباح متاح للمعلم فقط', 'err'); return; }

    const amtEl = byId('wdAmt');
    const accEl = byId('wdAccNum') || byId('wdAccount');
    const nameEl = byId('wdAccName') || byId('wdName');
    const amt = Number(amtEl?.value || 0);
    const method = selectedMethodFromUI();
    const account = String(accEl?.value || '').trim();
    const accountName = String(nameEl?.value || '').trim();
    const methodName = METHOD_LABELS[method] || 'سحب أرباح';

    if (!(amt >= MIN_WITHDRAW)) { toast(`الحد الأدنى للسحب ${MIN_WITHDRAW} ج.م`, 'err'); return; }
    if (!account) { toast('أدخل رقم المحفظة أو الحساب', 'err'); return; }
    if (!accountName) { toast('أدخل الاسم المسجل على الحساب', 'err'); return; }

    const walletBal = await safeGetWalletBalance();
    if (amt > walletBal) { toast(`رصيدك (${walletBal.toFixed(2)} ج.م) غير كافٍ`, 'err'); return; }

    const reqRef = db.collection('withdrawalRequests').doc();
    const btn = document.querySelector('#withdrawCard .pay-submit-btn') || document.querySelector('#withdrawCard button[onclick="submitWithdrawal()"]');
    const oldBtnHtml = btn?.innerHTML || '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spin spin-sm spin-wh" style="display:inline-block"></div> جاري إرسال الطلب...';
    }

    try {
      await db.runTransaction(async tx => {
        const walletRef = db.collection('wallets').doc(window.CU.uid);
        const walletSnap = await tx.get(walletRef);
        const bal = walletSnap.exists ? Number(walletSnap.data().balance || 0) : 0;
        if (amt > bal) throw new Error(`رصيدك (${bal.toFixed(2)} ج.م) غير كافٍ`);

        tx.set(walletRef, { balance: bal - amt, userId: window.CU.uid }, { merge: true });
        tx.set(reqRef, {
          userId: window.CU.uid,
          userName: window.CP?.name || '—',
          userPhone: window.CP?.phone || '',
          amount: amt,
          currency: 'EGP',
          method,
          methodName,
          accountNumber: account,
          accountName,
          payoutTarget: account,
          payoutTargetName: accountName,
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        tx.set(db.collection('transactions').doc(reqRef.id), {
          userId: window.CU.uid,
          type: 'debit',
          kind: 'withdrawal',
          amount: amt,
          currency: 'EGP',
          status: 'pending',
          description: `طلب سحب أرباح — ${methodName}`,
          requestId: reqRef.id,
          method,
          methodName,
          accountNumber: account,
          accountName,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      window.walBal = Math.max(0, walletBal - amt);
      ['nwAmt', 'wBal', 'wdBal'].forEach(id => {
        const el = byId(id);
        if (!el) return;
        el.textContent = id === 'nwAmt' ? `${window.walBal.toFixed(2)} ج.م` : window.walBal.toFixed(2) + (id === 'wdBal' ? ' ج.م' : '');
      });

      if (amtEl) amtEl.value = '';
      if (accEl) accEl.value = '';
      if (nameEl && window.CP?.name) nameEl.value = window.CP.name;

      toast('✅ تم إرسال طلب سحب الأرباح بنجاح', 'suc');
      if (typeof window.loadTxList === 'function') await window.loadTxList();
      if (typeof window.go === 'function') window.go('wallet');
    } catch (e) {
      toast('خطأ: ' + (e?.message || 'تعذّر تنفيذ طلب السحب'), 'err');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = oldBtnHtml || '<span>💸</span> طلب السحب';
      }
    }
  };

  const _origLoadTxList = window.loadTxList;
  window.loadTxList = async function loadTxListWrapped() {
    const res = _origLoadTxList ? await _origLoadTxList.apply(this, arguments) : undefined;
    const role = String(window.CP?.role || '').toLowerCase();
    const allowWithdraw = isTutorRole(role);
    const wCard = byId('withdrawCard');
    if (wCard) {
      wCard.style.display = allowWithdraw ? 'block' : 'none';
      if (allowWithdraw) {
        syncWithdrawUI(currentMethod());
        if (!byId('wdMethod')) ensureHiddenMethodField();
      }
    }
    return res;
  };

  function bootWithdraw() {
    const card = byId('withdrawCard');
    if (!card) return;
    ensureHiddenMethodField();
    syncWithdrawUI(currentMethod());
  }

  window.addEventListener('DOMContentLoaded', bootWithdraw);
  window.addEventListener('load', bootWithdraw);
  setTimeout(bootWithdraw, 500);
  setTimeout(bootWithdraw, 1500);
})();
