import React, { useState } from 'react';
import { Tag, X } from 'lucide-react';
import { auth } from '../firebase';
import { usePlan } from '../hooks/usePlan';
import { applyCode, removeCode } from '../utils/referral';

/** "¿Tienes un código de vendedor?" — aplica o quita el código de la primera compra. */
export const ReferralCodeField: React.FC<{ tone?: 'dark' | 'light' }> = ({ tone = 'dark' }) => {
  const { isFirstPurchase, referralCode, referralDiscountPct, referralSellerName } = usePlan();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isFirstPurchase) return null;
  const dark = tone === 'dark';
  const muted = dark ? 'text-slate-300' : 'text-slate-600';
  const link = dark ? 'text-emerald-300 hover:text-emerald-200' : 'text-emerald-700 hover:text-emerald-800';

  if (referralCode) {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-xs ${muted}`}>
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold ${dark ? 'bg-emerald-500/15 border border-emerald-400/40 text-emerald-200' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
          <Tag className="w-3.5 h-3.5" />
          Código {referralCode}
          {typeof referralDiscountPct === 'number' && referralDiscountPct > 0 ? ` · ${referralDiscountPct}% dcto.` : ''}
        </span>
        {referralSellerName && <span>Te atiende {referralSellerName}.</span>}
        <button
          type="button"
          disabled={busy}
          onClick={async () => { setBusy(true); await removeCode(Boolean(auth.currentUser)); setBusy(false); }}
          className={`inline-flex items-center gap-1 underline underline-offset-2 cursor-pointer disabled:opacity-60 ${link}`}
        >
          <X className="w-3 h-3" /> Quitar
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`text-xs font-semibold underline underline-offset-2 cursor-pointer ${link}`}>
        ¿Tienes un código de vendedor?
      </button>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await applyCode(value, Boolean(auth.currentUser));
    setBusy(false);
    if ('error' in r) setError(r.error);
    else { setOpen(false); setValue(''); }
  };

  return (
    <form onSubmit={submit} className="space-y-1.5">
      <div className="flex gap-2 max-w-sm">
        <label htmlFor="referral-code" className="sr-only">Código de vendedor</label>
        <input
          id="referral-code"
          autoFocus
          value={value}
          onChange={e => setValue(e.target.value.toUpperCase())}
          placeholder="Código de vendedor"
          maxLength={20}
          autoComplete="off"
          className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-sm font-mono uppercase outline-none focus:ring-2 focus:ring-emerald-400 ${dark ? 'bg-slate-950/60 border border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400'}`}
        />
        <button
          type="submit"
          disabled={busy || value.trim().length < 3}
          className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-sm font-bold cursor-pointer disabled:opacity-50"
        >
          {busy ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error && <p role="alert" className={`text-xs ${dark ? 'text-rose-300' : 'text-rose-700'}`}>{error}</p>}
    </form>
  );
};
