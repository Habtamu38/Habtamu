import React, { useState } from 'react';
import {
  InventoryAssetRecord,
  InvoiceRecord,
  LibraryBookRecord,
  SharedViewProps,
  TransportRouteRecord,
} from '../types/esms';
import {
  formatCalendarDate,
  formatEtb,
  SCHOOL_PAYMENT_ACCOUNTS,
} from '../utils/ethiopianRules';
import { TRANSLATIONS } from '../utils/i18n';
import { Landmark, RotateCcw, BookOpen, Bus, Package, Pencil, Trash2, X, Printer } from 'lucide-react';

export const FinanceAndFeesView: React.FC<SharedViewProps> = ({
  lang,
  calendarMode,
  workspace,
  onRefresh,
  apiFetch,
}) => {
  const t = TRANSLATIONS[lang];

  // Invoice Create & Edit State
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [invStudentId, setInvStudentId] = useState<number>(workspace.students[0]?.id || 1);
  const [feeCategory, setFeeCategory] = useState('Term 1 Tuition & STEM Fee');
  const [totalAmountEtb, setTotalAmountEtb] = useState('8500.00');
  const [discountEtb, setDiscountEtb] = useState('0.00');
  const [dueDate, setDueDate] = useState('2026-11-30');

  // Payment State
  const [payInvoiceId, setPayInvoiceId] = useState<number>(
    workspace.invoices[1]?.id || workspace.invoices[0]?.id || 1
  );
  const [payAmountEtb, setPayAmountEtb] = useState('2000.00');
  const [paymentMethod, setPaymentMethod] = useState('Telebirr');
  const [transactionReference, setTransactionReference] = useState('TLB-2019-77410ET');
  const [idempotencyKey, setIdempotencyKey] = useState(`IDEMP-ETB-${Date.now()}`);

  // Reversal State
  const [revPaymentId, setRevPaymentId] = useState<number>(workspace.payments[0]?.id || 1);
  const [reversalReason, setReversalReason] = useState(
    'Cashier bank reference correction — authorized by Finance Head'
  );

  const [financeMsg, setFinanceMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleLoadInvoiceForEdit = (inv: InvoiceRecord) => {
    setEditingInvoiceId(inv.id);
    setInvStudentId(inv.studentId);
    setFeeCategory(inv.feeCategory);
    setTotalAmountEtb(inv.totalAmountEtb);
    setDiscountEtb(inv.discountEtb);
    setDueDate(inv.dueDate);
    setFinanceMsg({
      type: 'ok',
      text: `Editing Invoice ${inv.invoiceNumber} — update category, gross amount, discount, or due date and click Save.`,
    });
  };

  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinanceMsg(null);
    try {
      if (editingInvoiceId) {
        const res = await apiFetch(`/api/v1/invoices/${editingInvoiceId}`, {
          method: 'PUT',
          body: JSON.stringify({
            schoolId: workspace.school?.id,
            feeCategory,
            totalAmountEtb,
            discountEtb,
            dueDate,
          }),
        });
        setFinanceMsg({
          type: 'ok',
          text: `Updated Invoice ${res.invoice.invoiceNumber}: New Balance ${formatEtb(
            res.invoice.balanceEtb,
            lang
          )} (${res.invoice.status}).`,
        });
        setEditingInvoiceId(null);
      } else {
        const res = await apiFetch('/api/v1/invoices', {
          method: 'POST',
          body: JSON.stringify({
            schoolId: workspace.school?.id,
            studentId: invStudentId,
            feeCategory,
            academicYear: '2019 E.C.',
            term: 'Term 1',
            totalAmountEtb,
            discountEtb,
            dueDate,
          }),
        });
        setFinanceMsg({
          type: 'ok',
          text: `Created Invoice ${res.invoice.invoiceNumber} for ${formatEtb(
            res.invoice.balanceEtb,
            lang
          )}.`,
        });
      }
      await onRefresh();
    } catch (err: any) {
      setFinanceMsg({ type: 'err', text: err.message || 'Failed to save invoice' });
    }
  };

  const handleDeleteInvoice = async (inv: InvoiceRecord) => {
    setFinanceMsg(null);
    try {
      await apiFetch(
        `/api/v1/invoices/${inv.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingInvoiceId === inv.id) {
        setEditingInvoiceId(null);
      }
      setFinanceMsg({
        type: 'ok',
        text: `Deleted Invoice ${inv.invoiceNumber} (${inv.feeCategory}).`,
      });
      await onRefresh();
    } catch (err: any) {
      setFinanceMsg({ type: 'err', text: err.message || 'Failed to delete invoice' });
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinanceMsg(null);
    try {
      const res = await apiFetch('/api/v1/payments', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          invoiceId: payInvoiceId,
          amountEtb: payAmountEtb,
          paymentMethod,
          transactionReference,
          idempotencyKey,
        }),
      });
      if (res.idempotentReplay) {
        setFinanceMsg({
          type: 'ok',
          text: `IDEMPOTENT REPLAY DETECTED: Key "${idempotencyKey}" already processed under Receipt ${res.payment.receiptNumber}. Duplicate charge prevented!`,
        });
      } else {
        setFinanceMsg({
          type: 'ok',
          text: `Issued Official Receipt ${res.payment.receiptNumber} for ${formatEtb(
            res.payment.amountEtb,
            lang
          )} via ${res.payment.paymentMethod}.`,
        });
      }
      await onRefresh();
    } catch (err: any) {
      setFinanceMsg({ type: 'err', text: err.message || 'Failed to record payment' });
    }
  };

  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFinanceMsg(null);
    try {
      const res = await apiFetch('/api/v1/payments/reverse', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          paymentId: revPaymentId,
          reversalReason,
        }),
      });
      setFinanceMsg({
        type: 'ok',
        text: `Authorized immutable reversal entry ${res.reversal.receiptNumber} (${formatEtb(
          res.reversal.amountEtb,
          lang
        )}). Original ledger row preserved.`,
      });
      await onRefresh();
    } catch (err: any) {
      setFinanceMsg({ type: 'err', text: err.message || 'Reversal failed' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Finance View Toolbar with Print Report Button */}
      <div
        data-testid="finance-view-toolbar"
        className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print"
      >
        <div>
          <h2 className="text-base font-bold text-slate-900">
            {lang === 'am'
              ? 'የፋይናንስ፣ የክፍያ ደረሰኞች እና የሒሳብ መግለጫ (Finance & Fees — ETB)'
              : 'Finance, Student Invoices & Official Financial Statements (ETB)'}
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            {lang === 'am'
              ? 'የተማሪዎች የትምህርት ቤት ክፍያ፣ ቴሌብር/ንግድ ባንክ ደረሰኞች እና የማይሰረዝ የሒሳብ መዝገብ'
              : 'Idempotent ETB tuition billing, Telebirr & CBE receipts, and immutable payment ledger'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          data-testid="finance-print-report-btn"
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>Print Report</span>
        </button>
      </div>

      {financeMsg && (
        <div
          className={`p-4 rounded-lg text-xs font-medium border no-print ${
            financeMsg.type === 'ok'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          {financeMsg.text}
        </div>
      )}

      {/* Official School Tuition Payment Accounts Banner (Telebirr 0938680030 & CBE 1000302646787) */}
      <div
        data-testid="official-payment-accounts-banner"
        className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs"
      >
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
            Official School Tuition &amp; Fee Payment Accounts
          </div>
          <p className="text-xs text-slate-300 mt-0.5">
            Parents and students may settle tuition fees via Telebirr or Commercial Bank of Ethiopia (CBE) using the verified account numbers below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs">
          <span className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-bold">
            Telebirr {SCHOOL_PAYMENT_ACCOUNTS.telebirr.accountNumber}
          </span>
          <span className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white font-bold">
            CBE {SCHOOL_PAYMENT_ACCOUNTS.cbe.accountNumber}
          </span>
        </div>
      </div>

      {/* 3-Column Financial Operations Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 no-print">
        {/* 1. Issue / Edit Student Invoice */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                {editingInvoiceId
                  ? `Edit Invoice #${editingInvoiceId}`
                  : t.issueInvoice}
              </h2>
            </div>
            {editingInvoiceId && (
              <button
                type="button"
                onClick={() => setEditingInvoiceId(null)}
                className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleSaveInvoice} className="space-y-3">
            <div>
              <label htmlFor="inv-student" className="block text-xs text-slate-600 mb-1">
                Student
              </label>
              <select
                id="inv-student"
                value={invStudentId}
                disabled={Boolean(editingInvoiceId)}
                onChange={(e) => setInvStudentId(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white disabled:bg-slate-100"
              >
                {workspace.students.map((stu) => (
                  <option key={stu.id} value={stu.id}>
                    {stu.firstName} {stu.fatherName} ({stu.studentCode})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inv-category" className="block text-xs text-slate-600 mb-1">
                Fee Category
              </label>
              <input
                id="inv-category"
                type="text"
                value={feeCategory}
                onChange={(e) => setFeeCategory(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="inv-total" className="block text-xs text-slate-600 mb-1">
                  Gross Amount (ETB)
                </label>
                <input
                  id="inv-total"
                  type="number"
                  step="0.01"
                  value={totalAmountEtb}
                  onChange={(e) => setTotalAmountEtb(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="inv-discount" className="block text-xs text-slate-600 mb-1">
                  Scholarship / Discount
                </label>
                <input
                  id="inv-discount"
                  type="number"
                  step="0.01"
                  value={discountEtb}
                  onChange={(e) => setDiscountEtb(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono tabular-nums"
                />
              </div>
            </div>
            <div>
              <label htmlFor="inv-due" className="block text-xs text-slate-600 mb-1">
                Due Date
              </label>
              <input
                id="inv-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors"
            >
              {editingInvoiceId ? 'Save Invoice Changes' : t.issueInvoice}
            </button>
          </form>
        </div>

        {/* 2. Record Idempotent Payment */}
        <div className="bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {t.recordPayment} (Idempotent)
            </h2>
            <button
              type="button"
              onClick={() => setIdempotencyKey(`IDEMP-ETB-${Date.now()}`)}
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              New Key
            </button>
          </div>

          <form onSubmit={handleRecordPayment} className="space-y-3">
            <div>
              <label htmlFor="pay-invoice" className="block text-xs text-slate-600 mb-1">
                Target Invoice
              </label>
              <select
                id="pay-invoice"
                value={payInvoiceId}
                onChange={(e) => setPayInvoiceId(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              >
                {workspace.invoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} · Bal: ETB {inv.balanceEtb} ({inv.status})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pay-amount" className="block text-xs text-slate-600 mb-1">
                  Amount (ETB)
                </label>
                <input
                  id="pay-amount"
                  type="number"
                  step="0.01"
                  value={payAmountEtb}
                  onChange={(e) => setPayAmountEtb(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="pay-method" className="block text-xs text-slate-600 mb-1">
                  Payment Channel
                </label>
                <select
                  id="pay-method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  <option value="Telebirr">Telebirr ({SCHOOL_PAYMENT_ACCOUNTS.telebirr.accountNumber})</option>
                  <option value="CBE Bank Transfer">CBE ({SCHOOL_PAYMENT_ACCOUNTS.cbe.accountNumber})</option>
                  <option value="CBE Birr">CBE Birr ({SCHOOL_PAYMENT_ACCOUNTS.cbe.accountNumber})</option>
                  <option value="Dashen Bank Amole">Dashen Bank / Amole</option>
                  <option value="Cashier Receipt">School Cashier Office</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="pay-ref" className="block text-xs text-slate-600 mb-1">
                Provider Transaction Reference
              </label>
              <input
                id="pay-ref"
                type="text"
                value={transactionReference}
                onChange={(e) => setTransactionReference(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono"
              />
            </div>
            <div>
              <label htmlFor="pay-idemp" className="block text-xs text-slate-600 mb-1">
                Idempotency Key (Prevents Double-Charge on Retry)
              </label>
              <input
                id="pay-idemp"
                type="text"
                value={idempotencyKey}
                onChange={(e) => setIdempotencyKey(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md font-mono text-slate-600"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 text-xs font-medium text-white bg-slate-900 rounded-md hover:bg-slate-800 transition-colors"
            >
              {t.recordPayment}
            </button>
          </form>
        </div>

        {/* 3. Authorized Payment Reversal (Audit-Safe) */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
              <RotateCcw className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                {t.reversePayment} (Immutable Ledger)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Completed financial transactions can never be deleted. Reversals append an offsetting
              negative ledger entry with a mandatory audit trail.
            </p>
            <form onSubmit={handleReversePayment} className="space-y-3">
              <div>
                <label htmlFor="rev-payment" className="block text-xs text-slate-600 mb-1">
                  Select Receipt to Reverse
                </label>
                <select
                  id="rev-payment"
                  value={revPaymentId}
                  onChange={(e) => setRevPaymentId(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {workspace.payments
                    .filter((p) => p.entryType === 'PAYMENT')
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.receiptNumber} · ETB {p.amountEtb} ({p.paymentMethod})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="rev-reason" className="block text-xs text-slate-600 mb-1">
                  Mandatory Reversal Audit Reason *
                </label>
                <textarea
                  id="rev-reason"
                  rows={2}
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 px-4 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors"
              >
                {t.reversePayment}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Official Financial Statement Sheet: Student Invoices & Immutable Payments Ledger */}
      <div
        data-testid="financial-statement-report-sheet"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-6 print-report-sheet print-financial-statement"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <div className="text-xs text-slate-500">
              {workspace.school?.nameEn} · {workspace.school?.academicYearLabel} · Currency: ETB
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Official School Financial Statement &amp; Tuition Ledger
            </h2>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            data-testid="print-financial-statement-pdf-btn"
            className="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 no-print whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Financial Statement PDF
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 print-report-grid">
          <div className="lg:col-span-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2.5">
              Student Invoices ({workspace.invoices.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse print-report-table">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-2">Invoice #</th>
                    <th className="py-2 px-2">Fee Category</th>
                    <th className="py-2 px-2 text-right">Paid (ETB)</th>
                    <th className="py-2 px-2 text-right">Balance (ETB)</th>
                    <th className="py-2 px-2 text-right">Status</th>
                    <th className="py-2 pl-2 text-right no-print">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {workspace.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-xs text-slate-500">
                        No student invoices recorded for this term.
                      </td>
                    </tr>
                  ) : (
                    workspace.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-2 font-mono font-medium text-slate-900 tabular-nums">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-2.5 px-2 text-slate-700">
                          <div>{inv.feeCategory}</div>
                          <div className="text-slate-500">
                            Due: {formatCalendarDate(inv.dueDate, calendarMode, lang)}
                          </div>
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono tabular-nums text-emerald-700">
                          {formatEtb(inv.paidAmountEtb, lang)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold tabular-nums text-slate-900">
                          {formatEtb(inv.balanceEtb, lang)}
                        </td>
                        <td className="py-2.5 px-2 text-right font-mono font-semibold">
                          {inv.status}
                        </td>
                        <td className="py-2.5 pl-2 text-right whitespace-nowrap no-print">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLoadInvoiceForEdit(inv)}
                              className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <Pencil className="w-3 h-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteInvoice(inv)}
                              className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-200 pb-2.5">
              Immutable Payment &amp; Reversal Ledger ({workspace.payments.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse print-report-table">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <th className="py-2 pr-2">Receipt #</th>
                    <th className="py-2 px-2">Channel &amp; Reference</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 pl-2 text-right">Amount (ETB)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {workspace.payments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-xs text-slate-500">
                        No verified payment receipts or reversals recorded yet.
                      </td>
                    </tr>
                  ) : (
                    workspace.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 pr-2 font-mono font-medium text-slate-900 tabular-nums">
                          {p.receiptNumber}
                        </td>
                        <td className="py-2.5 px-2 text-slate-700">
                          <div>{p.paymentMethod}</div>
                          <div className="font-mono text-slate-500">
                            Ref: {p.transactionReference} · Key: {p.idempotencyKey}
                          </div>
                          {p.reversalReason && (
                            <div className="text-red-700 mt-0.5">Reason: {p.reversalReason}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-2 font-mono">
                          <span
                            className={
                              p.entryType === 'REVERSAL'
                                ? 'text-red-700 font-semibold'
                                : 'text-emerald-700 font-semibold'
                            }
                          >
                            {p.entryType}
                          </span>
                        </td>
                        <td className="py-2.5 pl-2 text-right font-mono font-semibold tabular-nums">
                          {formatEtb(p.amountEtb, lang)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Official Print-Only Financial Audit Signature Block */}
        <div className="print-only pt-6 border-t border-slate-300 grid grid-cols-3 gap-6 text-xs text-slate-700">
          <div>
            <div className="font-semibold text-slate-900">Chief Cashier / Finance Officer</div>
            <div className="mt-6 border-b border-slate-400" />
            <div className="mt-1 text-[11px] text-slate-500">Signature &amp; Date</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">Internal Auditor</div>
            <div className="mt-6 border-b border-slate-400" />
            <div className="mt-1 text-[11px] text-slate-500">Ledger Reconciliation Stamp</div>
          </div>
          <div>
            <div className="font-semibold text-slate-900">School Director / Principal</div>
            <div className="mt-6 border-b border-slate-400" />
            <div className="mt-1 text-[11px] text-slate-500">Official Authorization &amp; Date</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LibraryTransportInventoryView: React.FC<SharedViewProps> = ({
  lang,
  workspace,
  onRefresh,
  apiFetch,
}) => {
  const [selectedBorrowerId, setSelectedBorrowerId] = useState<number>(
    workspace.students[0]?.id || 1
  );
  const [opMsg, setOpMsg] = useState<string | null>(null);

  // Library Book Add / Edit State
  const [editingBookId, setEditingBookId] = useState<number | null>(null);
  const [bkCopyCode, setBkCopyCode] = useState('LIB-BOLE-BIO10-C01');
  const [bkIsbn, setBkIsbn] = useState('978-99944-0-301-2');
  const [bkTitleEn, setBkTitleEn] = useState('Grade 10 Biology Textbook');
  const [bkTitleAm, setBkTitleAm] = useState('Grade 10 Biology Textbook');
  const [bkAuthor, setBkAuthor] = useState('Ministry of Education (MoE Ethiopia)');
  const [bkCategory, setBkCategory] = useState('Natural Sciences');
  const [bkGrade, setBkGrade] = useState('Grade 10');

  // Transport Route Add / Edit State
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [rtCode, setRtCode] = useState('RT-BOLE-AYAT-03');
  const [rtName, setRtName] = useState('Ayat Condominium - Summit - Bole Campus');
  const [rtStops, setRtStops] = useState('Ayat Roundabout ->Summit ->CMC ->Bole Campus');
  const [rtPlate, setRtPlate] = useState('AA-3-B90412');
  const [rtDriver, setRtDriver] = useState('Ato Kassahun Bekele');
  const [rtPhone, setRtPhone] = useState('+251-911-309-441');
  const [rtCapacity, setRtCapacity] = useState('32');
  const [rtAssigned, setRtAssigned] = useState('18');
  const [rtFee, setRtFee] = useState('3400.00');

  // Inventory Asset Add / Edit State
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [astCode, setAstCode] = useState('AST-BOLE-PHY-04');
  const [astName, setAstName] = useState('Digital Oscilloscopes & Circuit Boards');
  const [astCategory, setAstCategory] = useState('Laboratory Equipment');
  const [astDept, setAstDept] = useState('Physics Lab');
  const [astQty, setAstQty] = useState('16');
  const [astMin, setAstMin] = useState('8');
  const [astVal, setAstVal] = useState('28500.00');

  const handleToggleBookLoan = async (bookId: number) => {
    setOpMsg(null);
    try {
      const res = await apiFetch('/api/v1/library/toggle-loan', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          bookId,
          studentId: selectedBorrowerId,
          dueDate: '2026-11-18',
        }),
      });
      setOpMsg(
        `Updated Library Copy ${res.book.copyCode}: Status is now ${res.book.status}${
          res.book.borrowerName ? ` (Borrower: ${res.book.borrowerName})` : ''
        }.`
      );
      await onRefresh();
    } catch (err: any) {
      setOpMsg(err.message || 'Library operation failed');
    }
  };

  const handleLoadBookForEdit = (bk: LibraryBookRecord) => {
    setEditingBookId(bk.id);
    setBkCopyCode(bk.copyCode);
    setBkIsbn(bk.isbn);
    setBkTitleEn(bk.titleEn);
    setBkTitleAm(bk.titleAm);
    setBkAuthor(bk.author);
    setBkCategory(bk.category);
    setBkGrade(bk.gradeLevel);
    setOpMsg(`Loaded Library Book ${bk.copyCode} (${bk.titleEn}) into form for editing.`);
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpMsg(null);
    try {
      const res = await apiFetch('/api/v1/library/books', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          bookId: editingBookId || undefined,
          copyCode: bkCopyCode,
          isbn: bkIsbn,
          titleEn: bkTitleEn,
          titleAm: bkTitleAm || bkTitleEn,
          author: bkAuthor,
          category: bkCategory,
          gradeLevel: bkGrade,
        }),
      });
      setOpMsg(
        editingBookId
          ? `Updated Library Book ${res.book.copyCode} (${res.book.titleEn}).`
          : `Cataloged New Library Book ${res.book.copyCode} (${res.book.titleEn}).`
      );
      setEditingBookId(null);
      await onRefresh();
    } catch (err: any) {
      setOpMsg(err.message || 'Failed to save library book');
    }
  };

  const handleLoadRouteForEdit = (rt: TransportRouteRecord) => {
    setEditingRouteId(rt.id);
    setRtCode(rt.routeCode);
    setRtName(rt.routeName);
    setRtStops(rt.stopsList);
    setRtPlate(rt.vehiclePlate);
    setRtDriver(rt.driverName);
    setRtPhone(rt.driverPhone);
    setRtCapacity(String(rt.capacity));
    setRtAssigned(String(rt.assignedCount));
    setRtFee(rt.termFeeEtb);
    setOpMsg(`Loaded Transport Route ${rt.routeCode} (${rt.routeName}) for editing.`);
  };

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpMsg(null);
    try {
      const res = await apiFetch('/api/v1/transport/routes', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          routeId: editingRouteId || undefined,
          routeCode: rtCode,
          routeName: rtName,
          stopsList: rtStops,
          vehiclePlate: rtPlate,
          driverName: rtDriver,
          driverPhone: rtPhone,
          capacity: Number(rtCapacity) || 30,
          assignedCount: Number(rtAssigned) || 0,
          termFeeEtb: rtFee,
        }),
      });
      setOpMsg(
        editingRouteId
          ? `Updated Transport Route ${res.route.routeCode} (${res.route.routeName}).`
          : `Added Transport Route ${res.route.routeCode} (${res.route.routeName}).`
      );
      setEditingRouteId(null);
      await onRefresh();
    } catch (err: any) {
      setOpMsg(err.message || 'Failed to save transport route');
    }
  };

  const handleLoadAssetForEdit = (ast: InventoryAssetRecord) => {
    setEditingAssetId(ast.id);
    setAstCode(ast.assetCode);
    setAstName(ast.name);
    setAstCategory(ast.category);
    setAstDept(ast.department);
    setAstQty(String(ast.quantity));
    setAstMin(String(ast.minimumThreshold));
    setAstVal(ast.unitValueEtb);
    setOpMsg(`Loaded Inventory Asset ${ast.assetCode} (${ast.name}) for editing.`);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpMsg(null);
    try {
      const res = await apiFetch('/api/v1/inventory/assets', {
        method: 'POST',
        body: JSON.stringify({
          schoolId: workspace.school?.id,
          assetId: editingAssetId || undefined,
          assetCode: astCode,
          name: astName,
          category: astCategory,
          department: astDept,
          quantity: Number(astQty) || 0,
          minimumThreshold: Number(astMin) || 5,
          unitValueEtb: astVal,
        }),
      });
      setOpMsg(
        editingAssetId
          ? `Updated Asset ${res.asset.assetCode} (${res.asset.name}) — Qty: ${res.asset.quantity}.`
          : `Added Asset ${res.asset.assetCode} (${res.asset.name}) — Qty: ${res.asset.quantity}.`
      );
      setEditingAssetId(null);
      await onRefresh();
    } catch (err: any) {
      setOpMsg(err.message || 'Failed to save inventory asset');
    }
  };

  const handleDeleteBook = async (bk: LibraryBookRecord) => {
    setOpMsg(null);
    try {
      await apiFetch(
        `/api/v1/library/books/${bk.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingBookId === bk.id) {
        setEditingBookId(null);
      }
      setOpMsg(`Deleted Library Book Copy ${bk.copyCode} (${bk.titleEn}).`);
      await onRefresh();
    } catch (err: any) {
      setOpMsg(err.message || 'Failed to delete library book');
    }
  };

  const handleDeleteRoute = async (rt: TransportRouteRecord) => {
    setOpMsg(null);
    try {
      await apiFetch(
        `/api/v1/transport/routes/${rt.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingRouteId === rt.id) {
        setEditingRouteId(null);
      }
      setOpMsg(`Deleted Transport Route ${rt.routeCode} (${rt.routeName}).`);
      await onRefresh();
    } catch (err: any) {
      setOpMsg(err.message || 'Failed to delete transport route');
    }
  };

  const handleDeleteAsset = async (ast: InventoryAssetRecord) => {
    setOpMsg(null);
    try {
      await apiFetch(
        `/api/v1/inventory/assets/${ast.id}?schoolId=${workspace.school?.id || 1}`,
        { method: 'DELETE' }
      );
      if (editingAssetId === ast.id) {
        setEditingAssetId(null);
      }
      setOpMsg(`Deleted Inventory Asset ${ast.assetCode} (${ast.name}).`);
      await onRefresh();
    } catch (err: any) {
      setOpMsg(err.message || 'Failed to delete inventory asset');
    }
  };

  return (
    <div className="space-y-8">
      {opMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs text-emerald-900 font-medium">
          {opMsg}
        </div>
      )}

      {/* 3-Column Admin Add & Edit Forms: Library Book, Transport Route, Inventory Asset */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 1. Add / Edit Library Book */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                {editingBookId ? `Edit Book #${editingBookId}` : 'Add Library Book Copy'}
              </h3>
            </div>
            {editingBookId && (
              <button
                type="button"
                onClick={() => setEditingBookId(null)}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            )}
          </div>
          <form onSubmit={handleSaveBook} className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="bk-code" className="block text-slate-600 mb-1">
                  Copy Code *
                </label>
                <input
                  id="bk-code"
                  type="text"
                  value={bkCopyCode}
                  onChange={(e) => setBkCopyCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="bk-isbn" className="block text-slate-600 mb-1">
                  ISBN
                </label>
                <input
                  id="bk-isbn"
                  type="text"
                  value={bkIsbn}
                  onChange={(e) => setBkIsbn(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
            <div>
              <label htmlFor="bk-en" className="block text-slate-600 mb-1">
                Book Title (English) *
              </label>
              <input
                id="bk-en"
                type="text"
                value={bkTitleEn}
                onChange={(e) => setBkTitleEn(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div>
              <label htmlFor="bk-am" className="block text-slate-600 mb-1">
                Book Subtitle / Edition
              </label>
              <input
                id="bk-am"
                type="text"
                value={bkTitleAm}
                onChange={(e) => setBkTitleAm(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="bk-author" className="block text-slate-600 mb-1">
                  Author
                </label>
                <input
                  id="bk-author"
                  type="text"
                  value={bkAuthor}
                  onChange={(e) => setBkAuthor(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label htmlFor="bk-grade" className="block text-slate-600 mb-1">
                  Grade Level
                </label>
                <input
                  id="bk-grade"
                  type="text"
                  value={bkGrade}
                  onChange={(e) => setBkGrade(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-3 font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors"
            >
              {editingBookId ? 'Save Book Changes' : 'Add Book Copy'}
            </button>
          </form>
        </div>

        {/* 2. Add / Edit Transport Route */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Bus className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                {editingRouteId ? `Edit Route #${editingRouteId}` : 'Add Transport Route'}
              </h3>
            </div>
            {editingRouteId && (
              <button
                type="button"
                onClick={() => setEditingRouteId(null)}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            )}
          </div>
          <form onSubmit={handleSaveRoute} className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="rt-code" className="block text-slate-600 mb-1">
                  Route Code *
                </label>
                <input
                  id="rt-code"
                  type="text"
                  value={rtCode}
                  onChange={(e) => setRtCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="rt-plate" className="block text-slate-600 mb-1">
                  Bus Plate #
                </label>
                <input
                  id="rt-plate"
                  type="text"
                  value={rtPlate}
                  onChange={(e) => setRtPlate(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
            <div>
              <label htmlFor="rt-name" className="block text-slate-600 mb-1">
                Route Corridor Name *
              </label>
              <input
                id="rt-name"
                type="text"
                value={rtName}
                onChange={(e) => setRtName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="rt-driver" className="block text-slate-600 mb-1">
                  Driver Name
                </label>
                <input
                  id="rt-driver"
                  type="text"
                  value={rtDriver}
                  onChange={(e) => setRtDriver(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
              <div>
                <label htmlFor="rt-phone" className="block text-slate-600 mb-1">
                  Driver Phone
                </label>
                <input
                  id="rt-phone"
                  type="text"
                  value={rtPhone}
                  onChange={(e) => setRtPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="rt-cap" className="block text-slate-600 mb-1">
                  Capacity
                </label>
                <input
                  id="rt-cap"
                  type="number"
                  value={rtCapacity}
                  onChange={(e) => setRtCapacity(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="rt-ass" className="block text-slate-600 mb-1">
                  Assigned
                </label>
                <input
                  id="rt-ass"
                  type="number"
                  value={rtAssigned}
                  onChange={(e) => setRtAssigned(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="rt-fee" className="block text-slate-600 mb-1">
                  Fee (ETB)
                </label>
                <input
                  id="rt-fee"
                  type="number"
                  step="0.01"
                  value={rtFee}
                  onChange={(e) => setRtFee(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-3 font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors"
            >
              {editingRouteId ? 'Save Route Changes' : 'Add Transport Route'}
            </button>
          </form>
        </div>

        {/* 3. Add / Edit Inventory Asset */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-700" />
              <h3 className="text-sm font-semibold text-slate-900">
                {editingAssetId ? `Edit Asset #${editingAssetId}` : 'Add School Inventory Asset'}
              </h3>
            </div>
            {editingAssetId && (
              <button
                type="button"
                onClick={() => setEditingAssetId(null)}
                className="text-xs text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
            )}
          </div>
          <form onSubmit={handleSaveAsset} className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="ast-code" className="block text-slate-600 mb-1">
                  Asset Code *
                </label>
                <input
                  id="ast-code"
                  type="text"
                  value={astCode}
                  onChange={(e) => setAstCode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="ast-dept" className="block text-slate-600 mb-1">
                  Department
                </label>
                <input
                  id="ast-dept"
                  type="text"
                  value={astDept}
                  onChange={(e) => setAstDept(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
              </div>
            </div>
            <div>
              <label htmlFor="ast-name" className="block text-slate-600 mb-1">
                Asset Description *
              </label>
              <input
                id="ast-name"
                type="text"
                value={astName}
                onChange={(e) => setAstName(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label htmlFor="ast-qty" className="block text-slate-600 mb-1">
                  Quantity
                </label>
                <input
                  id="ast-qty"
                  type="number"
                  value={astQty}
                  onChange={(e) => setAstQty(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="ast-min" className="block text-slate-600 mb-1">
                  Min Alert
                </label>
                <input
                  id="ast-min"
                  type="number"
                  value={astMin}
                  onChange={(e) => setAstMin(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
              <div>
                <label htmlFor="ast-val" className="block text-slate-600 mb-1">
                  Unit ETB
                </label>
                <input
                  id="ast-val"
                  type="number"
                  step="0.01"
                  value={astVal}
                  onChange={(e) => setAstVal(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-2 px-3 font-medium text-white bg-slate-900 rounded hover:bg-slate-800 transition-colors"
            >
              {editingAssetId ? 'Save Asset Changes' : 'Add Inventory Asset'}
            </button>
          </form>
        </div>
      </div>

      {/* 1. Library Book Catalog & Single-Borrower Circulation */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Library Catalog & Copy Circulation (Single-Borrower Enforced)
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="lib-borrower" className="text-xs text-slate-600">
              Active Borrower Student:
            </label>
            <select
              id="lib-borrower"
              value={selectedBorrowerId}
              onChange={(e) => setSelectedBorrowerId(Number(e.target.value))}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              {workspace.students.map((stu) => (
                <option key={stu.id} value={stu.id}>
                  {stu.firstName} {stu.fatherName} ({stu.studentCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                <th className="py-2.5 pr-3">Copy Code & ISBN</th>
                <th className="py-2.5 px-3">Book Title</th>
                <th className="py-2.5 px-3">Author & Category</th>
                <th className="py-2.5 px-3">Status & Current Holder</th>
                <th className="py-2.5 pl-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {workspace.libraryBooks.map((bk) => (
                <tr key={bk.id} className="hover:bg-slate-50">
                  <td className="py-3 pr-3 font-mono text-xs text-slate-700 tabular-nums">
                    <div>{bk.copyCode}</div>
                    <div className="text-slate-500">ISBN: {bk.isbn}</div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-medium text-slate-900">{bk.titleEn}</div>
                    <div className="text-xs text-slate-500">{bk.titleAm}</div>
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-600">
                    <div>{bk.author}</div>
                    <div className="text-slate-500">
                      {bk.category} · {bk.gradeLevel}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs">
                    <span
                      className={`font-mono font-semibold ${
                        bk.status === 'AVAILABLE' ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {bk.status}
                    </span>
                    {bk.borrowerName && (
                      <div className="text-slate-600 mt-0.5">
                        Issued to: {bk.borrowerName} · Due {bk.dueDate}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadBookForEdit(bk)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBook(bk)}
                        className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleBookLoan(bk.id)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                      >
                        {bk.status === 'AVAILABLE' ? 'Check Out Copy' : 'Record Return'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Transport Fleet & Inventory Assets */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
            <Bus className="w-4 h-4 text-slate-700" />
            <h3 className="text-base font-semibold text-slate-900">
              Student Transport Routes & Vehicle Capacity
            </h3>
          </div>
          <div className="space-y-4">
            {workspace.transportRoutes.map((rt) => (
              <div key={rt.id} className="pb-4 border-b border-slate-100 last:border-none">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-600">{rt.routeCode}</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-900 tabular-nums">
                      {rt.assignedCount} / {rt.capacity} Seats · {formatEtb(rt.termFeeEtb, lang)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleLoadRouteForEdit(rt)}
                      className="px-2 py-0.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRoute(rt)}
                      className="px-2 py-0.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
                <div className="text-sm font-semibold text-slate-900 mt-1">{rt.routeName}</div>
                <div className="text-xs text-slate-500 mt-0.5">Stops: {rt.stopsList}</div>
                <div className="text-xs text-slate-600 mt-1 font-mono">
                  Plate: {rt.vehiclePlate} · Driver: {rt.driverName} ({rt.driverPhone})
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-6">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
            <Package className="w-4 h-4 text-slate-700" />
            <h3 className="text-base font-semibold text-slate-900">
              School Assets & Laboratory Inventory
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 px-2">Asset & Department</th>
                  <th className="py-2 px-2 text-right">Qty</th>
                  <th className="py-2 px-2 text-right">Condition</th>
                  <th className="py-2 pl-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {workspace.inventoryAssets.map((ast) => (
                  <tr key={ast.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-2 font-mono text-slate-700">{ast.assetCode}</td>
                    <td className="py-2.5 px-2">
                      <div className="font-medium text-slate-900">{ast.name}</div>
                      <div className="text-slate-500">
                        {ast.department} · Unit: {formatEtb(ast.unitValueEtb, lang)}
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold tabular-nums">
                      {ast.quantity}
                    </td>
                    <td className="py-2.5 px-2 text-right font-mono font-semibold">
                      <span
                        className={
                          ast.conditionStatus === 'LOW_STOCK'
                            ? 'text-red-700'
                            : 'text-emerald-700'
                        }
                      >
                        {ast.conditionStatus}
                      </span>
                    </td>
                    <td className="py-2.5 pl-2 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadAssetForEdit(ast)}
                          className="px-2 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAsset(ast)}
                          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
