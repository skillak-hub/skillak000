/* ══════════════════════════════════════════════════════════════
   Skillak — patch_fix_refund.js  v1.0
   1. إصلاح كامل لمنطق استرداد المبلغ بعد تحويله للمعلم
   2. تحسينات بصرية واحترافية لزر الاسترداد ولوحة الإدارة
   ══════════════════════════════════════════════════════════════ */

(function _skillakRefundFix() {
  'use strict';

  /* ── انتظر تحميل Firebase ── */
  function waitForFirebase(cb, tries) {
    tries = tries || 0;
    if (typeof db !== 'undefined' && typeof firebase !== 'undefined') { cb(); return; }
    if (tries > 60) return;
    setTimeout(() => waitForFirebase(cb, tries + 1), 250);
  }

  waitForFirebase(function () {

    /* ══════════════════════════════════════════════════════════
       1. إصلاح دالة adminRefundBk الأصلية
       - خصم ما استلمه المعلم فعلاً (net) من محفظته
       - إعادة المبلغ الكامل (total) للطالب
       - تحديث حالة الحجز إلى refunded
       - إرسال إشعارات لكلا الطرفين
    ══════════════════════════════════════════════════════════ */
    window.adminRefundBk = async function adminRefundBk(bid, studentId, _legacyAmt) {
      try {
        /* ── جلب بيانات الحجز ── */
        const bkSnap = await db.collection('bookings').doc(bid).get();
        if (!bkSnap.exists) { _toast('لم يتم العثور على الحجز', 'err'); return; }
        const bk = { id: bid, ...bkSnap.data() };

        /* ── حساب المبالغ الصحيحة ── */
        const price      = Number(bk.price      || 0);
        const studentFee = Number(bk.studentFee || bk.fee || 0);
        const tutorFee   = Number(bk.tutorFee   || 0);
        // ما دفعه الطالب = price + studentFee
        const refundToStudent = Number(bk.total || bk.totalDue || (price + studentFee) || 0);
        // ما استلمه المعلم = price - tutorFee
        const deductFromTutor = Number(bk.tutorNetAmount || bk.net || (price - tutorFee) || 0);

        if (!(refundToStudent > 0)) {
          _toast('لا يوجد مبلغ صالح للاسترداد', 'err');
          return;
        }

        const paidToTutor = !!(bk.adminConfirmed || bk.paidToTutorAt || bk.tutorPaidAt);

        /* ── رسالة التأكيد ── */
        const confirmMsg = paidToTutor
          ? `⚠️ تأكيد الاسترداد:\n\n✅ سيُضاف للطالب: ${refundToStudent.toFixed(2)} ج.م\n❌ سيُخصم من المعلم: ${deductFromTutor.toFixed(2)} ج.م\n\nهل تريد المتابعة؟`
          : `⚠️ تأكيد الاسترداد:\n\n✅ سيُعاد للطالب: ${refundToStudent.toFixed(2)} ج.م\n(لم يتم تحويل مبلغ للمعلم بعد)\n\nهل تريد المتابعة؟`;

        if (!confirm(confirmMsg)) return;

        const actualStudentId = bk.studentId || studentId;
        const actualTutorId   = bk.tutorId   || null;

        /* ── تنفيذ المعاملة ── */
        await db.runTransaction(async tx => {
          const bkRef = db.collection('bookings').doc(bid);

          /* طالب — إضافة المبلغ */
          const sRef  = db.collection('wallets').doc(actualStudentId);
          const sSnap = await tx.get(sRef);
          const sBal  = sSnap.exists ? Number(sSnap.data().balance || 0) : 0;
          tx.set(sRef, { balance: +(sBal + refundToStudent).toFixed(2), userId: actualStudentId }, { merge: true });

          /* معلم — خصم المبلغ (فقط إذا كان قد استلمه) */
          if (paidToTutor && actualTutorId && deductFromTutor > 0) {
            const tRef  = db.collection('wallets').doc(actualTutorId);
            const tSnap = await tx.get(tRef);
            const tBal  = tSnap.exists ? Number(tSnap.data().balance || 0) : 0;
            const newBal = +(tBal - deductFromTutor).toFixed(2);
            tx.set(tRef, { balance: newBal, userId: actualTutorId }, { merge: true });
          }

          /* تحديث الحجز */
          tx.set(bkRef, {
            status:               'refunded',
            financeState:         paidToTutor ? 'transferred_then_refunded' : 'refunded_before_transfer',
            refundedAt:           firebase.firestore.FieldValue.serverTimestamp(),
            refundToStudentAmt:   +refundToStudent.toFixed(2),
            refundFromTutorAmt:   paidToTutor ? +deductFromTutor.toFixed(2) : 0,
            refundToStudent:      true,
            refundFromTutor:      paidToTutor,
            lastUpdatedAt:        firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });

        /* ── سجل معاملات الطالب ── */
        await db.collection('transactions').add({
          userId:      actualStudentId,
          type:        'credit',
          kind:        'refund',
          amount:      +refundToStudent.toFixed(2),
          currency:    'EGP',
          description: paidToTutor
            ? 'استرداد كامل — قرار الإدارة (بعد تحويل المعلم)'
            : 'استرداد — قرار الإدارة',
          bookingId:   bid,
          status:      'completed',
          createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        });

        /* ── سجل معاملات المعلم (إذا كان قد استلم) ── */
        if (paidToTutor && actualTutorId && deductFromTutor > 0) {
          await db.collection('transactions').add({
            userId:      actualTutorId,
            type:        'debit',
            kind:        'refund_deduction',
            amount:      +deductFromTutor.toFixed(2),
            currency:    'EGP',
            description: 'خصم استرداد — قرار الإدارة بإعادة المبلغ للطالب',
            bookingId:   bid,
            status:      'completed',
            createdAt:   firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }

        /* ── إشعار للطالب ── */
        if (actualStudentId) {
          const threadId = actualTutorId
            ? [actualStudentId, actualTutorId].sort().join('_')
            : null;
          if (threadId) {
            db.collection('messages').add({
              threadId,
              senderId:      'system',
              senderName:    'Skillak',
              senderPhoto:   '',
              receiverId:    actualStudentId,
              receiverName:  bk.studentName || '',
              text:          `✅ تم استرداد مبلغ ${refundToStudent.toFixed(2)} ج.م لمحفظتك بقرار من إدارة Skillak.`,
              read:          false,
              isSystemNotif: true,
              bookingId:     bid,
              createdAt:     firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
          }
        }

        /* ── إشعار للمعلم ── */
        if (paidToTutor && actualTutorId) {
          const threadId = [actualStudentId, actualTutorId].sort().join('_');
          db.collection('messages').add({
            threadId,
            senderId:      'system',
            senderName:    'Skillak',
            senderPhoto:   '',
            receiverId:    actualTutorId,
            receiverName:  bk.tutorName || '',
            text:          `⚠️ تم خصم مبلغ ${deductFromTutor.toFixed(2)} ج.م من محفظتك بقرار استرداد من إدارة Skillak للحجز بتاريخ ${bk.date || ''}.`,
            read:          false,
            isSystemNotif: true,
            bookingId:     bid,
            createdAt:     firebase.firestore.FieldValue.serverTimestamp()
          }).catch(() => {});
        }

        _toast(
          paidToTutor
            ? `✅ تم استرداد ${refundToStudent.toFixed(2)} ج.م للطالب وخصم ${deductFromTutor.toFixed(2)} ج.م من المعلم`
            : `✅ تم استرداد ${refundToStudent.toFixed(2)} ج.م للطالب`,
          'suc'
        );

        /* تحديث عرض الإدارة */
        if (typeof adTab === 'function') {
          adTab('bookings', document.querySelector('.adminTab[onclick*="bookings"]'));
        }

      } catch (e) {
        console.error('[Refund Fix]', e);
        _toast('خطأ في الاسترداد: ' + (e.message || e), 'err');
      }
    };

    /* ══════════════════════════════════════════════════════════
       2. تحسين عرض الحجوزات في لوحة الإدارة
       - إظهار زر "إرجاع للطالب" حتى بعد التحويل
       - تمييز الحالات المالية بألوان واضحة
    ══════════════════════════════════════════════════════════ */
    const _rfx_prevAdTab = window.adTab;
    window.adTab = async function (tab, el) {
      const res = typeof _rfx_prevAdTab === 'function' ? await _rfx_prevAdTab(tab, el) : undefined;
      if (tab === 'bookings') {
        setTimeout(_rfx_enhanceBookingsTable, 350);
      }
      return res;
    };

    function _rfx_enhanceBookingsTable() {
      const tbody = document.querySelector('#adCon table tbody');
      if (!tbody) return;

      /* ── إضافة زر استرداد للصفوف المدفوعة المكتملة ── */
      const rows = tbody.querySelectorAll('tr');
      rows.forEach(row => {
        if (row.querySelector('.rfx-refund-injected')) return;

        const lastTd = row.querySelector('td:last-child');
        if (!lastTd) return;

        /* استخرج bid من الأزرار الموجودة */
        let bid = null, studentId = null, totalAmt = 0;
        row.querySelectorAll('button[onclick]').forEach(btn => {
          const oc = btn.getAttribute('onclick') || '';
          /* adminPayTutor('bid','tutorId',price,fee) */
          const mPay = oc.match(/adminPayTutor\(['"]([^'"]+)['"]/);
          /* adminRefundBk('bid','studentId',amt) */
          const mRef = oc.match(/adminRefundBk\(['"]([^'"]+)['"],\s*['"]([^'"]+)['"],\s*([\d.]+)\)/);
          if (mPay) bid = mPay[1];
          if (mRef) { bid = mRef[1]; studentId = mRef[2]; totalAmt = parseFloat(mRef[3]) || 0; }
        });
        if (!bid) return;

        /* هل تحوّل للمعلم؟ (نلاحظ نص "تم التحويل" أو وجود ✓) */
        const isPaid = !!(
          row.querySelector('[style*="--green"]') ||
          row.textContent.includes('تم التحويل') ||
          row.textContent.includes('✓ تم التحويل')
        );

        /* هل مسترد بالفعل؟ */
        const isRefunded = row.textContent.includes('مسترد') || row.textContent.includes('↩️');

        if (isPaid && !isRefunded && studentId) {
          /* إضافة زر استرداد موضّح */
          const refundBtn = document.createElement('button');
          refundBtn.className = 'btn btn-o btn-xs rfx-refund-injected';
          refundBtn.style.cssText = 'background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:none;font-weight:700;gap:4px;display:inline-flex;align-items:center';
          refundBtn.innerHTML = '↩️ استرداد للطالب';
          refundBtn.onclick = () => window.adminRefundBk(bid, studentId, totalAmt);
          lastTd.appendChild(refundBtn);
        }

        /* تحديث شارة الحالة إذا كانت مسترد */
        if (isRefunded) {
          const pills = row.querySelectorAll('.pill');
          pills.forEach(p => {
            if (p.textContent.includes('تم التحويل') && !p.textContent.includes('مسترد')) {
              p.textContent = '↩️ مُسترد بعد التحويل';
              p.className = 'pill';
              p.style.cssText = 'background:#fef3c7;color:#b45309;font-weight:700;border:1px solid #fbbf24;border-radius:100px;padding:3px 10px;font-size:.72rem';
            }
          });
        }
      });
    }

    /* ══════════════════════════════════════════════════════════
       3. تحسين عرض حالات الحجز في لوحة تحكم الطالب/المعلم
       - إضافة نص "مسترد بعد التحويل" بدلاً من "مسترد" فقط
    ══════════════════════════════════════════════════════════ */
    const _rfx_origRenderSessions = window.renderSessions;
    if (typeof _rfx_origRenderSessions === 'function') {
      window.renderSessions = function renderSessions(list, role) {
        const result = _rfx_origRenderSessions(list, role);
        /* بعد الرندر نحدث الشارات */
        setTimeout(() => {
          document.querySelectorAll('.pill').forEach(p => {
            if (p.textContent.trim() === '↩️ مسترد') {
              const card = p.closest('[data-bid]');
              if (card) {
                const bkData = list?.find?.(b => b.id === card.dataset.bid);
                if (bkData?.refundFromTutor) {
                  p.textContent = '↩️ مسترد (بعد التحويل)';
                  p.style.background = '#fef3c7';
                  p.style.color = '#b45309';
                }
              }
            }
          });
        }, 200);
        return result;
      };
    }

    /* ══════════════════════════════════════════════════════════
       4. إضافة CSS تحسينات التصميم
    ══════════════════════════════════════════════════════════ */
    const style = document.createElement('style');
    style.id = 'skillak-rfx-styles';
    style.textContent = `
/* ── زر الاسترداد ── */
.rfx-refund-injected {
  margin-top: 4px !important;
  border-radius: 8px !important;
  padding: 5px 11px !important;
  font-size: .75rem !important;
  cursor: pointer;
  transition: transform .15s, opacity .15s;
  white-space: nowrap;
}
.rfx-refund-injected:hover { opacity: .85; transform: scale(1.03); }

/* ── شارة "مسترد بعد التحويل" ── */
.pill-refunded-transferred {
  background: #fef3c7;
  color: #b45309;
  border: 1px solid #fbbf24;
  border-radius: 100px;
  padding: 3px 10px;
  font-size: .72rem;
  font-weight: 700;
  white-space: nowrap;
}

/* ══ تحسينات الاستجابة العامة ══ */

/* ── الجداول في الإدارة ── */
#adCon .dsec { overflow-x: auto; -webkit-overflow-scrolling: touch; }
#adCon table {
  width: 100%;
  border-collapse: collapse;
  font-size: .82rem;
}
#adCon table th {
  background: linear-gradient(135deg, rgba(13,110,117,.12), rgba(13,110,117,.06));
  color: var(--teal, #0d6e75);
  font-weight: 700;
  padding: 10px 12px;
  white-space: nowrap;
  border-bottom: 2px solid rgba(13,110,117,.15);
  position: sticky;
  top: 0;
  z-index: 2;
}
#adCon table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border, #e5e7eb);
  vertical-align: middle;
}
#adCon table tr:hover td { background: rgba(13,110,117,.03); }

/* ── صفحة الإدارة على الموبايل ── */
@media (max-width: 768px) {
  #page-admin > div { padding: 18px 4% !important; }
  #page-admin h1.st { font-size: 1.4rem !important; }
  #adCon table th, #adCon table td { padding: 8px 9px !important; font-size: .74rem !important; }
  .adminTab { font-size: .74rem !important; padding: 6px 10px !important; }
}

/* ── بطاقات الجلسات ── */
.bkcard {
  border-radius: 16px;
  border: 1.5px solid var(--border, #e5e7eb);
  padding: 16px;
  transition: box-shadow .2s, border-color .2s;
  background: var(--white, #fff);
}
.bkcard:hover { box-shadow: 0 6px 24px rgba(13,110,117,.1); border-color: rgba(13,110,117,.25); }

/* ── تحسين Hero على الموبايل ── */
@media (max-width: 640px) {
  .hero { padding: 24px 5% 36px !important; }
  .htitle { font-size: 1.9rem !important; line-height: 1.2 !important; }
  .hg { grid-template-columns: 1fr !important; gap: 28px !important; }
  .hfcwrap { display: none !important; }
  .hstats { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
}

/* ── تحسين صفحة الاستكشاف ── */
@media (max-width: 640px) {
  .tgrid { grid-template-columns: 1fr !important; gap: 14px !important; }
  .exp { padding: 16px 4% !important; }
  .fbar { gap: 10px !important; }
  .fgrp { min-width: unset !important; flex: 1 1 45% !important; }
}

/* ── تحسين لوحة التحكم ── */
@media (max-width: 768px) {
  .dashlay { flex-direction: column !important; }
  .sidebar { width: 100% !important; border-left: none !important; border-bottom: 1.5px solid var(--border) !important; padding: 14px !important; }
  .sbnav { display: flex !important; gap: 8px !important; flex-wrap: wrap !important; overflow-x: auto !important; }
  .sbnavitem { padding: 7px 13px !important; border-radius: 100px !important; white-space: nowrap !important; font-size: .8rem !important; }
  .dashcon { padding: 16px 14px !important; }
}

/* ── تحسين صفحة المحفظة ── */
@media (max-width: 640px) {
  .walwrap { padding: 16px 4% 80px !important; }
  .walcard { padding: 20px 18px !important; }
  .walamt { font-size: 2rem !important; }
  .amt-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
  .pay-tabs { gap: 6px !important; flex-wrap: wrap !important; }
  .pay-tab { flex: 1 1 calc(50% - 6px) !important; font-size: .75rem !important; padding: 9px 8px !important; }
}

/* ── تحسين الشريط العلوي ── */
@media (max-width: 480px) {
  .navbar { padding: 0 14px !important; height: 54px !important; }
  .logo span { font-size: 1.15rem !important; }
  .nav-r .wchip { padding: 4px 9px !important; font-size: .74rem !important; }
}

/* ── تحسين بطاقات المعلمين ── */
.tc {
  border-radius: 18px;
  overflow: hidden;
  transition: transform .2s, box-shadow .2s;
  background: var(--white, #fff);
  border: 1.5px solid var(--border, #e5e7eb);
}
.tc:hover { transform: translateY(-3px); box-shadow: 0 10px 32px rgba(13,110,117,.13); }

/* ── خلفية بديلة للأقسام ── */
section:nth-child(even) { background: var(--cream, #f9fafb); }

/* ── تحسين الـ steps ── */
@media (max-width: 768px) {
  .steps { grid-template-columns: 1fr !important; max-width: 400px !important; margin: 0 auto !important; }
}

/* ── تحسين الـ modals ── */
@media (max-width: 480px) {
  .modal { margin: 8px !important; border-radius: 18px !important; }
  .mi { padding: 20px 16px !important; }
}

/* ── تحسين صفحة الشات ── */
@media (max-width: 640px) {
  .chatlay { flex-direction: column !important; height: auto !important; min-height: calc(100vh - 54px) !important; }
  .cpanel { width: 100% !important; max-height: 35vh !important; border-left: none !important; border-bottom: 1.5px solid var(--border) !important; }
  .chatwin { flex: 1 !important; }
}

/* ── تحسين لوحة إدارة — الإحصائيات ── */
.srow { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
.ad-card {
  background: var(--white, #fff);
  border-radius: 16px;
  padding: 18px 16px;
  border: 1.5px solid var(--border, #e5e7eb);
  text-align: center;
  transition: box-shadow .2s;
}
.ad-card:hover { box-shadow: 0 4px 18px rgba(0,0,0,.07); }
.ad-card .num { font-family: 'Fraunces', serif; font-size: 1.8rem; font-weight: 900; color: var(--teal, #0d6e75); margin: 6px 0; }

/* ── لوحة إدارة — جدول محسّن ── */
@media (max-width: 900px) {
  #adCon table thead { display: none; }
  #adCon table tr {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    border: 1.5px solid var(--border, #e5e7eb);
    border-radius: 14px;
    padding: 12px;
    margin-bottom: 12px;
    background: var(--white, #fff);
  }
  #adCon table td {
    border: none !important;
    padding: 4px 6px !important;
    font-size: .78rem !important;
  }
  #adCon table td:last-child { grid-column: 1 / -1; }
}

/* ── تأثيرات احترافية ── */
.btn { transition: background .15s, transform .1s, box-shadow .15s !important; }
.btn:active { transform: scale(.97) !important; }

/* ── Splash screen محسّن ── */
.skl-splash-logo img {
  filter: drop-shadow(0 8px 32px rgba(13,110,117,.45));
}

/* ── حالة "مسترد بعد التحويل" في قائمة الحجوزات ── */
.bk-status-refunded-transferred {
  background: linear-gradient(135deg, #fef3c7, #fffbeb);
  color: #92400e;
  border: 1px solid #fbbf24;
  border-radius: 8px;
  padding: 4px 10px;
  font-size: .76rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
    `;
    if (!document.getElementById('skillak-rfx-styles')) {
      document.head.appendChild(style);
    }

    console.log('✅ Skillak refund fix patch loaded — v1.0');
  });

  /* ── helper ── */
  function _toast(msg, type) {
    if (typeof showT === 'function') { showT(msg, type); return; }
    if (type === 'err') console.error(msg); else console.log(msg);
  }

})();
