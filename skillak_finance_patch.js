/* Skillak finance UX patch
   - fixes withdrawal methods (adds Fawry + better labels)
   - aligns minimum withdrawal amount with UI
   - keeps existing Firestore transaction structure
*/
(function () {
  'use strict';

  const METHODS = {
    instapay: {
      label: 'رقم الهاتف المرتبط بـ InstaPay',
      hint: 'سيتم تحويل الأرباح على الحساب المرتبط بنفس رقم الهاتف.',
    },
    vodafone: {
      label: 'رقم فودافون كاش',
      hint: 'اكتب الرقم المرتبط بمحفظة Vodafone Cash.',
    },
    fawry: {
      label: 'رقم الهاتف / المحفظة المرتبطة',
      hint: 'ادخل بيانات الاستلام المرتبطة بخدمة Fawry أو الحساب البديل.',
    },
    bank: {
      label: 'رقم الحساب البنكي / IBAN',
      hint: 'اكتب رقم الحساب البنكي ثم الاسم المسجل كما هو في البنك.',
    },
  };

  function $(id) { return document.getElementById(id); }
  function toast(msg, type) { if (typeof window.showT === 'function') window.showT(msg, type); }
  function esc(v) {
    return String(v || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function currentMethod() {
    const active = document.querySelector('.withdraw-method-btn.sel');
    return active ? String(active.id || '').replace(/^wm-/, '') : 'instapay';
  }

  function applyMethodUi(method) {
    const m = METHODS[method] ? method : 'instapay';
    document.querySelectorAll('.withdraw-method-btn').forEach(btn => btn.classList.remove('sel'));
    const btn = $(`wm-${m}`);
    if (btn) btn.classList.add('sel');

    const label = $('wdAccLabel');
    const hint = $('wdAccHint');
    const nameDiv = $('wdAccNameDiv');

    if (label) label.innerHTML = `${METHODS[m].label} <span class="req">*</span>`;
    if (hint) hint.textContent = METHODS[m].hint;
    if (nameDiv) nameDiv.style.display = 'block';
  }

  window.selWdMethod = function (method) {
    applyMethodUi(method);
  };

  async function refreshWalletBalance() {
    if (!window.CU || !window.db) return 0;
    const ws = await db.collection('wallets').doc(CU.uid).get().catch(() => null);
    const bal = ws?.exists ? Number(ws.data().balance || 0) : Number(window.walBal || 0);
    window.walBal = bal;
    const wb = $('wBal'); if (wb) wb.textContent = bal.toFixed(2);
    const nw = $('nwAmt'); if (nw) nw.textContent = bal.toFixed(2) + ' ج.م';
    const wd = $('wdBal'); if (wd) wd.textContent = bal.toFixed(2) + ' ج.م';
    return bal;
  }

  window.submitWithdrawal = async function () {
    if (!window.CU) {
      if (typeof openM === 'function') openM('loginMod');
      return;
    }

    const amtEl = $('wdAmt');
    const accEl = $('wdAccNum');
    const nameEl = $('wdAccName');
    const btn = document.querySelector('#withdrawCard .pay-submit-btn');

    const amt = Number(amtEl?.value || 0);
    const method = currentMethod();
    const account = String(accEl?.value || '').trim();
    const accountName = String(nameEl?.value || '').trim();
    const methodNames = {
      instapay: 'InstaPay',
      vodafone: 'فودافون كاش',
      fawry: 'Fawry',
      bank: 'تحويل بنكي',
    };

    if (!(amt >= 50)) {
      toast('الحد الأدنى للسحب 50 جنيه', 'err');
      return;
    }
    if (!account) {
      toast('أدخل رقم الحساب أو الهاتف أولاً', 'err');
      return;
    }
    if (!accountName) {
      toast('أدخل الاسم المسجل أولاً', 'err');
      return;
    }

    const walletBalance = await refreshWalletBalance();
    if (amt > walletBalance) {
      toast(`رصيدك غير كافٍ. الرصيد الحالي ${walletBalance.toFixed(2)} ج.م`, 'err');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spin spin-sm spin-wh" style="display:inline-block"></div> جاري إرسال طلب السحب...';
    }

    const reqRef = db.collection('withdrawalRequests').doc();
    try {
      await db.runTransaction(async tx => {
        const wRef = db.collection('wallets').doc(CU.uid);
        const wSnap = await tx.get(wRef);
        const bal = wSnap.exists ? Number(wSnap.data().balance || 0) : 0;
        if (amt > bal) throw new Error(`رصيدك (${bal.toFixed(2)} ج.م) غير كافٍ`);

        tx.set(wRef, { balance: Number((bal - amt).toFixed(2)), userId: CU.uid }, { merge: true });
        tx.set(reqRef, {
          userId: CU.uid,
          userName: CP?.name || '—',
          userPhone: CP?.phone || '',
          amount: Number(amt.toFixed(2)),
          currency: 'EGP',
          method,
          methodName: methodNames[method] || method,
          accountNumber: account,
          accountName,
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        tx.set(db.collection('transactions').doc(reqRef.id), {
          userId: CU.uid,
          type: 'debit',
          kind: 'withdrawal',
          amount: Number(amt.toFixed(2)),
          currency: 'EGP',
          status: 'pending',
          description: `طلب سحب أرباح — ${methodNames[method] || method}`,
          requestId: reqRef.id,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      });

      window.walBal = Number((walletBalance - amt).toFixed(2));
      const wb = $('wBal'); if (wb) wb.textContent = window.walBal.toFixed(2);
      const nw = $('nwAmt'); if (nw) nw.textContent = window.walBal.toFixed(2) + ' ج.م';
      const wd = $('wdBal'); if (wd) wd.textContent = window.walBal.toFixed(2) + ' ج.م';
      if (amtEl) amtEl.value = '';
      if (accEl) accEl.value = '';
      if (nameEl && CP?.name) nameEl.value = CP.name;

      toast('✅ تم إرسال طلب السحب بنجاح — بانتظار مراجعة الإدارة', 'suc');
      if (typeof loadTxList === 'function') await loadTxList().catch(() => {});
      if (typeof loadWdHistory === 'function') await loadWdHistory().catch(() => {});
    } catch (e) {
      toast('خطأ: ' + e.message, 'err');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>💸</span> طلب السحب';
      }
    }
  };

  function init() {
    applyMethodUi('instapay');
    const hintWrap = $('wdAccHint');
    if (!hintWrap && $('wdAccPanel')) {
      const node = document.createElement('div');
      node.id = 'wdAccHint';
      node.style.cssText = 'margin-top:10px;font-size:.76rem;color:var(--muted);line-height:1.7;text-align:right';
      node.textContent = METHODS.instapay.hint;
      $('wdAccPanel').appendChild(node);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('load', init);
})();
