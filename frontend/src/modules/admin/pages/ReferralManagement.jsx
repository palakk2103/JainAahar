import React, { useCallback, useEffect, useState } from 'react';
import Card from '@shared/components/ui/Card';
import Badge from '@shared/components/ui/Badge';
import Modal from '@shared/components/ui/Modal';
import ConfirmDialog from '@shared/components/ui/ConfirmDialog';
import Pagination from '@shared/components/ui/Pagination';
import { useToast } from '@shared/components/ui/Toast';
import { Gift, Search, RefreshCw, Power, Save, Loader2, Eye, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminApi } from '../services/adminApi';

const STATUS_OPTIONS = [
    { value: '', label: 'All statuses' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'ELIGIBLE', label: 'Eligible' },
    { value: 'REWARD_CREDITED', label: 'Reward Credited' },
    { value: 'INELIGIBLE', label: 'Ineligible' },
    { value: 'REWARD_REVERSED', label: 'Reward Reversed' },
];

const STATUS_VARIANT = {
    PENDING: 'warning',
    ELIGIBLE: 'primary',
    REWARD_CREDITED: 'success',
    INELIGIBLE: 'error',
    REWARD_REVERSED: 'gray',
};

const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]));

const AUDIT_ACTIONS = [
    '', 'CODE_GENERATED', 'CODE_VALIDATION_FAILED', 'REFERRAL_CREATED', 'ORDER_INELIGIBLE',
    'REWARD_CALCULATED', 'COINS_CREDITED', 'CREDIT_FAILED', 'MARKED_INELIGIBLE', 'COINS_REVERSED',
    'REVERSAL_FAILED', 'SETTINGS_UPDATED',
];

const EMPTY_RULE = { type: 'fixed', value: 0, maxCoins: 0 };
const DEFAULT_SETTINGS = {
    enabled: false,
    referrerReward: { ...EMPTY_RULE },
    referredReward: { ...EMPTY_RULE },
    minOrderValue: 0,
    validityDays: 0,
};

const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
const fmtRule = (r) => {
    if (!r?.type) return '—';
    return r.type === 'percentage'
        ? `${r.value}%${r.maxCoins ? ` (max ${r.maxCoins})` : ''}`
        : `${r.value} coins`;
};
const CREDITED = ['REWARD_CREDITED', 'REWARD_REVERSED'];
const coinsCell = (reward) => {
    const coins = reward?.coins ?? 0;
    const reversed = reward?.reversedCoins ?? 0;
    return reversed ? `${coins} (−${reversed})` : `${coins}`;
};
const userLabel = (u) => (u ? `${u.name || 'Unnamed'}${u.phone ? ` · ${u.phone}` : u.email ? ` · ${u.email}` : ''}` : '—');
const resultOf = (res) => res?.data?.result ?? res?.data?.data ?? {};

const inputCls = 'h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary';

/* ---------------- Settings ---------------- */

const RuleEditor = ({ title, hint, rule, onChange }) => (
    <div className="rounded-xl border border-gray-100 p-4 space-y-3 bg-gray-50/40">
        <div>
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="text-xs text-gray-500">{hint}</p>
        </div>
        <div className="flex gap-2">
            {['fixed', 'percentage'].map((type) => (
                <button
                    key={type}
                    type="button"
                    onClick={() => onChange({ ...rule, type })}
                    className={cn(
                        'flex-1 h-9 rounded-lg border text-xs font-semibold capitalize transition-colors',
                        rule.type === type ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50',
                    )}
                >
                    {type === 'fixed' ? 'Fixed coins' : 'Percentage'}
                </button>
            ))}
        </div>
        <label className="block">
            <span className="text-xs font-medium text-gray-600">
                {rule.type === 'percentage' ? 'Percentage of purchase amount (%)' : 'Coins'}
            </span>
            <input
                type="number"
                min="0"
                max={rule.type === 'percentage' ? 100 : undefined}
                step={rule.type === 'percentage' ? '0.01' : '1'}
                value={rule.value}
                onChange={(e) => onChange({ ...rule, value: e.target.value })}
                className={cn(inputCls, 'w-full mt-1')}
            />
        </label>
        {rule.type === 'percentage' && (
            <label className="block">
                <span className="text-xs font-medium text-gray-600">Maximum coins (0 = no cap)</span>
                <input
                    type="number"
                    min="0"
                    step="1"
                    value={rule.maxCoins}
                    onChange={(e) => onChange({ ...rule, maxCoins: e.target.value })}
                    className={cn(inputCls, 'w-full mt-1')}
                />
            </label>
        )}
    </div>
);

const SettingsTab = ({ settings, onSaved }) => {
    const { showToast } = useToast();
    const [form, setForm] = useState(settings);
    const [saving, setSaving] = useState(false);

    useEffect(() => setForm(settings), [settings]);

    const save = async () => {
        setSaving(true);
        try {
            const payload = {
                enabled: Boolean(form.enabled),
                referrerReward: { ...form.referrerReward, value: Number(form.referrerReward.value), maxCoins: Number(form.referrerReward.maxCoins || 0) },
                referredReward: { ...form.referredReward, value: Number(form.referredReward.value), maxCoins: Number(form.referredReward.maxCoins || 0) },
                minOrderValue: Number(form.minOrderValue || 0),
                validityDays: Number(form.validityDays || 0),
            };
            const res = await adminApi.updateReferralSettings(payload);
            onSaved(resultOf(res));
            showToast('Referral settings saved', 'success');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Failed to save settings', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card 
            title="Reward Configuration" 
            subtitle="Rewards are coins credited to the customer wallet (1 coin = ₹1)."
            headerAction={
                <button
                    onClick={save}
                    disabled={saving}
                    className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-sm hover:shadow transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save Settings
                </button>
            }
        >
            <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                    <RuleEditor
                        title="Referrer reward"
                        hint="Customer who shared the code"
                        rule={form.referrerReward}
                        onChange={(r) => setForm({ ...form, referrerReward: r })}
                    />
                    <RuleEditor
                        title="Referred customer reward"
                        hint="New customer who signed up with the code"
                        rule={form.referredReward}
                        onChange={(r) => setForm({ ...form, referredReward: r })}
                    />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                        <span className="text-xs font-medium text-gray-600">Minimum purchase amount (₹, 0 = none)</span>
                        <input
                            type="number"
                            min="0"
                            value={form.minOrderValue}
                            onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })}
                            className={cn(inputCls, 'w-full mt-1')}
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-medium text-gray-600">Referral validity in days (0 = no expiry)</span>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={form.validityDays}
                            onChange={(e) => setForm({ ...form, validityDays: e.target.value })}
                            className={cn(inputCls, 'w-full mt-1')}
                        />
                    </label>
                </div>

                {/* Direct Action Bar right below the inputs */}
                <div className="flex items-center justify-between pt-3 pb-1 border-t border-gray-100">
                    <p className="text-xs text-gray-500">Settings save karne ke liye yahan click karein:</p>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Settings
                    </button>
                </div>

                <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
                    <p><b>Purchase amount (percentage base):</b> selling price of the products in the qualifying order × quantity (not MRP, e.g. MRP ₹700 sold at ₹400 → ₹400). Delivery fee, handling fee, tip and taxes are excluded.</p>
                    <p><b>Rounding:</b> coins are always whole numbers, rounded down (e.g. 10% of ₹455 = 45 coins). Fixed rewards must be whole coins.</p>
                    <p><b>Returns &amp; refunds:</b> if the qualifying order is returned, refunded or cancelled after coins were credited, the coins are taken back. Partial returns recalculate percentage rewards on the value kept; if the kept value falls below the minimum, all coins are reversed. Wallets never go negative: coins already spent are recorded as unrecovered.</p>
                    <p><b>Qualifying order:</b> the referred customer&apos;s first order placed after signup that is delivered, not cancelled, not returned, has its online payment captured (if paid online) and meets the minimum amount. Rewards are credited once per referred customer.</p>
                </div>
                <div className="flex justify-end">
                    <button
                        onClick={save}
                        disabled={saving}
                        className="h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Settings
                    </button>
                </div>
            </div>
        </Card>
    );
};

/* ---------------- Logs ---------------- */

const LogsTab = () => {
    const { showToast } = useToast();
    const [filters, setFilters] = useState({ search: '', status: '', code: '', from: '', to: '' });
    const [applied, setApplied] = useState(filters);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [data, setData] = useState({ items: [], total: 0, totalPages: 1, summary: {} });
    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [reevaluating, setReevaluating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: pageSize };
            Object.entries(applied).forEach(([k, v]) => { if (v) params[k] = v; });
            const res = await adminApi.getReferrals(params);
            setData(resultOf(res));
        } catch (err) {
            showToast(err?.response?.data?.message || 'Failed to load referrals', 'error');
        } finally {
            setLoading(false);
        }
    }, [applied, page, pageSize, showToast]);

    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        const t = setTimeout(() => {
            setPage(1);
            setApplied(filters);
        }, 400);
        return () => clearTimeout(t);
    }, [filters]);

    const openDetail = async (id) => {
        setDetail({ referral: null, auditTrail: [] });
        setDetailLoading(true);
        try {
            const res = await adminApi.getReferralDetail(id);
            setDetail(resultOf(res));
        } catch (err) {
            showToast(err?.response?.data?.message || 'Failed to load referral', 'error');
            setDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    const reevaluate = async () => {
        const id = detail?.referral?._id;
        if (!id) return;
        setReevaluating(true);
        try {
            const res = await adminApi.reevaluateReferral(id);
            showToast(res?.data?.message || 'Re-evaluated', 'success');
            await Promise.all([openDetail(id), load()]);
        } catch (err) {
            showToast(err?.response?.data?.message || 'Re-evaluation failed', 'error');
        } finally {
            setReevaluating(false);
        }
    };

    const summary = data.summary || {};
    const r = detail?.referral;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                {[
                    ['Pending', summary.PENDING],
                    ['Eligible', summary.ELIGIBLE],
                    ['Reward Credited', summary.REWARD_CREDITED],
                    ['Ineligible', summary.INELIGIBLE],
                    ['Reward Reversed', summary.REWARD_REVERSED],
                    ['Coins credited', summary.totalCoinsCredited],
                    ['Coins reversed', summary.totalCoinsReversed],
                    ['Coins unrecovered', summary.totalCoinsUnrecovered],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-gray-100 bg-white p-3">
                        <p className="text-[11px] font-medium text-gray-500">{label}</p>
                        <p className="text-xl font-bold text-gray-900">{value ?? 0}</p>
                    </div>
                ))}
            </div>

            <Card contentClassName="p-0">
                <div className="flex flex-wrap items-end gap-2 p-4 border-b border-gray-100">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            placeholder="Search customer name, phone, email or order ID"
                            className={cn(inputCls, 'w-full pl-9')}
                        />
                    </div>
                    <input
                        value={filters.code}
                        onChange={(e) => setFilters({ ...filters, code: e.target.value.toUpperCase() })}
                        placeholder="Referral code"
                        className={cn(inputCls, 'w-36 uppercase')}
                    />
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                        className={cn(inputCls, 'w-40')}
                    >
                        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <label className="text-[11px] text-gray-500">From
                        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={cn(inputCls, 'block')} />
                    </label>
                    <label className="text-[11px] text-gray-500">To
                        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={cn(inputCls, 'block')} />
                    </label>
                    <button onClick={load} className="h-9 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50" title="Refresh">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                            <tr>
                                {['Referrer', 'Referred customer', 'Code', 'Qualifying order', 'Purchase amt', 'Reward type (referrer / referred)', 'Coins (referrer / referred)', 'Status', 'Created', 'Credited', ''].map((h) => (
                                    <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && !data.items?.length ? (
                                <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400"><Loader2 size={18} className="animate-spin inline mr-2" />Loading...</td></tr>
                            ) : !data.items?.length ? (
                                <tr><td colSpan={11} className="px-3 py-10 text-center text-gray-400">No referrals found</td></tr>
                            ) : data.items.map((row) => (
                                <tr key={row._id} className="hover:bg-gray-50/60">
                                    <td className="px-3 py-2.5 whitespace-nowrap">{userLabel(row.referrer)}</td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">{userLabel(row.referred)}</td>
                                    <td className="px-3 py-2.5 font-mono font-semibold">{row.referralCode}</td>
                                    <td className="px-3 py-2.5 font-mono">{row.qualifyingOrderId || '—'}</td>
                                    <td className="px-3 py-2.5">{row.purchaseAmount ? `₹${row.purchaseAmount}` : '—'}</td>
                                    <td className="px-3 py-2.5 whitespace-nowrap">
                                        {CREDITED.includes(row.status) ? `${fmtRule(row.referrerReward)} / ${fmtRule(row.referredReward)}` : '—'}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold">
                                        {CREDITED.includes(row.status) ? `${coinsCell(row.referrerReward)} / ${coinsCell(row.referredReward)}` : '—'}
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <Badge variant={STATUS_VARIANT[row.status]}>{STATUS_LABEL[row.status] || row.status}</Badge>
                                        {row.statusReason && <p className="text-[10px] text-gray-400 mt-0.5 max-w-[180px]">{row.statusReason}</p>}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{fmtDate(row.createdAt)}</td>
                                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{fmtDate(row.creditedAt)}</td>
                                    <td className="px-3 py-2.5">
                                        <button onClick={() => openDetail(row._id)} className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500" title="View details">
                                            <Eye size={15} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="p-4 border-t border-gray-100">
                    <Pagination
                        page={data.page || page}
                        totalPages={data.totalPages || 1}
                        total={data.total || 0}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                        loading={loading}
                    />
                </div>
            </Card>

            <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title="Referral details" size="lg">
                {detailLoading || !r ? (
                    <div className="py-10 text-center text-gray-400"><Loader2 size={18} className="animate-spin inline mr-2" />Loading...</div>
                ) : (
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-2 gap-3">
                            <div><p className="text-[11px] text-gray-500">Referrer</p><p className="font-medium">{userLabel(r.referrer)}</p></div>
                            <div><p className="text-[11px] text-gray-500">Referred customer</p><p className="font-medium">{userLabel(r.referred)}</p></div>
                            <div><p className="text-[11px] text-gray-500">Code</p><p className="font-mono font-semibold">{r.referralCode}</p></div>
                            <div><p className="text-[11px] text-gray-500">Status</p><Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge></div>
                            <div><p className="text-[11px] text-gray-500">Qualifying order</p><p className="font-mono">{r.qualifyingOrderId || '—'}</p></div>
                            <div><p className="text-[11px] text-gray-500">Purchase amount</p><p>{r.purchaseAmount ? `₹${r.purchaseAmount}` : '—'}</p></div>
                            <div><p className="text-[11px] text-gray-500">Referrer reward</p><p>{fmtRule(r.referrerReward)} → <b>{r.referrerReward?.coins ?? 0} coins</b></p>{(r.referrerReward?.reversedCoins > 0 || r.referrerReward?.unrecoveredCoins > 0) && <p className="text-[11px] text-red-600">Reversed {r.referrerReward?.reversedCoins ?? 0}{r.referrerReward?.unrecoveredCoins ? `, unrecovered ${r.referrerReward.unrecoveredCoins}` : ''}</p>}</div>
                            <div><p className="text-[11px] text-gray-500">Referred reward</p><p>{fmtRule(r.referredReward)} → <b>{r.referredReward?.coins ?? 0} coins</b></p>{(r.referredReward?.reversedCoins > 0 || r.referredReward?.unrecoveredCoins > 0) && <p className="text-[11px] text-red-600">Reversed {r.referredReward?.reversedCoins ?? 0}{r.referredReward?.unrecoveredCoins ? `, unrecovered ${r.referredReward.unrecoveredCoins}` : ''}</p>}</div>
                            <div><p className="text-[11px] text-gray-500">Created</p><p>{fmtDate(r.createdAt)}</p></div>
                            <div><p className="text-[11px] text-gray-500">Credited</p><p>{fmtDate(r.creditedAt)}</p></div>
                        </div>
                        {r.statusReason && <p className="text-xs rounded-lg bg-amber-50 border border-amber-100 p-2 text-amber-800">{r.statusReason}</p>}

                        {['PENDING', 'ELIGIBLE', 'REWARD_CREDITED', 'REWARD_REVERSED'].includes(r.status) && (
                            <button
                                onClick={reevaluate}
                                disabled={reevaluating}
                                className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-semibold flex items-center gap-2 hover:bg-gray-50 disabled:opacity-60"
                            >
                                {reevaluating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                {CREDITED.includes(r.status) ? 'Re-check returns / refunds' : 'Re-check eligibility / retry credit'}
                            </button>
                        )}

                        <div>
                            <p className="text-xs font-semibold text-gray-700 mb-2">Audit trail</p>
                            <ol className="space-y-2 border-l border-gray-200 pl-4">
                                {(detail.auditTrail || []).map((a) => (
                                    <li key={a._id} className="text-xs">
                                        <p className="font-semibold text-gray-800">{a.action.replace(/_/g, ' ')} <span className="font-normal text-gray-400">· {fmtDate(a.createdAt)} · {a.actorType}</span></p>
                                        {a.message && <p className="text-gray-600">{a.message}</p>}
                                        {a.orderId && <p className="text-gray-400">Order {a.orderId}</p>}
                                    </li>
                                ))}
                                {!detail.auditTrail?.length && <li className="text-xs text-gray-400">No audit entries</li>}
                            </ol>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

/* ---------------- Audit ---------------- */

const AuditTab = () => {
    const { showToast } = useToast();
    const [filters, setFilters] = useState({ search: '', action: '', from: '', to: '' });
    const [applied, setApplied] = useState(filters);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => { setPage(1); setApplied(filters); }, 400);
        return () => clearTimeout(t);
    }, [filters]);

    useEffect(() => {
        let active = true;
        setLoading(true);
        const params = { page, limit: pageSize };
        Object.entries(applied).forEach(([k, v]) => { if (v) params[k] = v; });
        adminApi.getReferralAudit(params)
            .then((res) => { if (active) setData(resultOf(res)); })
            .catch((err) => showToast(err?.response?.data?.message || 'Failed to load audit trail', 'error'))
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [applied, page, pageSize, showToast]);

    return (
        <Card contentClassName="p-0">
            <div className="flex flex-wrap items-end gap-2 p-4 border-b border-gray-100">
                <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={filters.search}
                        onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                        placeholder="Search customer, code, order ID or message"
                        className={cn(inputCls, 'w-full pl-9')}
                    />
                </div>
                <select value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} className={cn(inputCls, 'w-52')}>
                    {AUDIT_ACTIONS.map((a) => <option key={a} value={a}>{a ? a.replace(/_/g, ' ') : 'All events'}</option>)}
                </select>
                <label className="text-[11px] text-gray-500">From
                    <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className={cn(inputCls, 'block')} />
                </label>
                <label className="text-[11px] text-gray-500">To
                    <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className={cn(inputCls, 'block')} />
                </label>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] tracking-wider">
                        <tr>
                            {['Time', 'Event', 'Referrer', 'Referred', 'Code', 'Order', 'Actor', 'Details'].map((h) => (
                                <th key={h} className="px-3 py-2.5 text-left font-semibold whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading && !data.items?.length ? (
                            <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400"><Loader2 size={18} className="animate-spin inline mr-2" />Loading...</td></tr>
                        ) : !data.items?.length ? (
                            <tr><td colSpan={8} className="px-3 py-10 text-center text-gray-400">No audit entries</td></tr>
                        ) : data.items.map((a) => (
                            <tr key={a._id}>
                                <td className="px-3 py-2.5 whitespace-nowrap text-gray-500">{fmtDate(a.createdAt)}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap font-semibold">{a.action.replace(/_/g, ' ')}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap">{userLabel(a.referrer)}</td>
                                <td className="px-3 py-2.5 whitespace-nowrap">{userLabel(a.referred)}</td>
                                <td className="px-3 py-2.5 font-mono">{a.referralCode || '—'}</td>
                                <td className="px-3 py-2.5 font-mono">{a.orderId || '—'}</td>
                                <td className="px-3 py-2.5">{a.actorType}</td>
                                <td className="px-3 py-2.5 text-gray-600 min-w-[240px]">{a.message}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 border-t border-gray-100">
                <Pagination
                    page={data.page || page}
                    totalPages={data.totalPages || 1}
                    total={data.total || 0}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                    loading={loading}
                />
            </div>
        </Card>
    );
};

/* ---------------- Page ---------------- */

const TABS = [
    { key: 'logs', label: 'Referral Logs' },
    { key: 'audit', label: 'Audit Trail' },
    { key: 'settings', label: 'Settings' },
];

const ReferralManagement = () => {
    const { showToast } = useToast();
    const [tab, setTab] = useState('logs');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [toggling, setToggling] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    useEffect(() => {
        adminApi.getReferralSettings()
            .then((res) => setSettings({ ...DEFAULT_SETTINGS, ...resultOf(res) }))
            .catch((err) => showToast(err?.response?.data?.message || 'Failed to load referral settings', 'error'))
            .finally(() => setLoadingSettings(false));
    }, [showToast]);

    const setEnabled = async (enabled) => {
        setToggling(true);
        try {
            const res = await adminApi.updateReferralSettings({ ...settings, enabled });
            setSettings({ ...DEFAULT_SETTINGS, ...resultOf(res) });
            showToast(enabled ? 'Refer & Earn enabled' : 'Refer & Earn disabled', 'success');
        } catch (err) {
            showToast(err?.response?.data?.message || 'Failed to update program status', 'error');
        } finally {
            setToggling(false);
            setConfirmOpen(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center"><Gift size={20} /></div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Refer & Earn</h1>
                        <p className="text-xs text-gray-500 flex items-center gap-1"><Coins size={12} /> Customer referral rewards, logs and audit trail</p>
                    </div>
                </div>

                <div className={cn(
                    'flex items-center gap-3 rounded-xl border px-4 py-2',
                    settings.enabled ? 'border-emerald-200 bg-emerald-50/60' : 'border-gray-200 bg-gray-50',
                )}>
                    <Power size={16} className={settings.enabled ? 'text-emerald-600' : 'text-gray-400'} />
                    <div>
                        <p className="text-xs font-semibold text-gray-800">Program is {loadingSettings ? '…' : settings.enabled ? 'ON' : 'OFF'}</p>
                        <p className="text-[10px] text-gray-500">{settings.enabled ? 'Customers can refer and earn' : 'Hidden from customers; no new rewards'}</p>
                    </div>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={settings.enabled}
                        disabled={loadingSettings || toggling}
                        onClick={() => (settings.enabled ? setConfirmOpen(true) : setEnabled(true))}
                        className={cn(
                            'relative h-6 w-11 rounded-full transition-colors disabled:opacity-50',
                            settings.enabled ? 'bg-emerald-500' : 'bg-gray-300',
                        )}
                    >
                        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', settings.enabled ? 'left-5' : 'left-0.5')} />
                    </button>
                </div>
            </div>

            <div className="flex gap-1 border-b border-gray-200">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={cn(
                            'px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors',
                            tab === t.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800',
                        )}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'logs' && <LogsTab />}
            {tab === 'audit' && <AuditTab />}
            {tab === 'settings' && !loadingSettings && <SettingsTab settings={settings} onSaved={(s) => setSettings({ ...DEFAULT_SETTINGS, ...s })} />}

            <ConfirmDialog
                isOpen={confirmOpen}
                title="Disable Refer & Earn?"
                message="Customers will no longer see Refer & Earn or be able to use referral codes. Pending referrals whose qualifying order is delivered while the program is off will be marked Ineligible. Rewards already credited are not affected."
                confirmLabel="Disable"
                variant="danger"
                loading={toggling}
                onConfirm={() => setEnabled(false)}
                onCancel={() => setConfirmOpen(false)}
            />
        </div>
    );
};

export default ReferralManagement;
