import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Copy, Gift, Users, Coins, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';

const STATUS_META = {
    PENDING: { label: 'Pending first order', className: 'bg-amber-50 text-amber-700 border-amber-100', Icon: Clock },
    ELIGIBLE: { label: 'Processing reward', className: 'bg-blue-50 text-blue-700 border-blue-100', Icon: Clock },
    REWARD_CREDITED: { label: 'Reward credited', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', Icon: CheckCircle2 },
    INELIGIBLE: { label: 'Not eligible', className: 'bg-slate-100 text-slate-600 border-slate-200', Icon: XCircle },
    REWARD_REVERSED: { label: 'Reversed (order returned)', className: 'bg-red-50 text-red-600 border-red-100', Icon: XCircle },
};

const describeReward = (rule) => {
    if (!rule || !rule.value) return null;
    if (rule.type === 'percentage') {
        return `${rule.value}% of order value in coins${rule.maxCoins ? ` (up to ${rule.maxCoins})` : ''}`;
    }
    return `${rule.value} coins`;
};

const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

const StatusBadge = ({ status }) => {
    const meta = STATUS_META[status] || STATUS_META.PENDING;
    const { Icon } = meta;
    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.className}`}>
            <Icon size={11} /> {meta.label}
        </span>
    );
};

const ReferEarnPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        customerApi.getReferralOverview()
            .then((res) => { if (active) setData(res?.data?.result || null); })
            .catch((err) => { if (active) setError(err?.response?.data?.message || 'Could not load Refer & Earn'); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    const code = data?.code || '';
    const referrerText = describeReward(data?.rules?.referrerReward);
    const referredText = describeReward(data?.rules?.referredReward);

    const copyText = async (text, successMsg) => {
        try {
            await navigator.clipboard.writeText(text);
            showToast(successMsg, 'success');
        } catch {
            showToast('Could not copy. Please copy it manually.', 'error');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20 font-['Outfit',_sans-serif]">
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1 cursor-pointer"
                    aria-label="Back"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Refer & Earn</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 space-y-4">
                {loading ? (
                    <div className="py-16 flex justify-center text-slate-400 text-sm font-semibold">
                        <Loader2 className="animate-spin mr-2" size={18} /> Loading...
                    </div>
                ) : error ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center text-sm text-slate-600">{error}</div>
                ) : !data?.enabled ? (
                    <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
                        <Gift size={36} className="mx-auto text-slate-300 mb-3" />
                        <p className="text-sm font-bold text-slate-700">Refer & Earn is not available right now</p>
                        <p className="text-xs text-slate-500 mt-1">Please check back later.</p>
                    </div>
                ) : (
                    <>
                        {/* Hero + code */}
                        <div className="rounded-3xl p-5 bg-gradient-to-br from-orange-500 to-amber-500 text-white shadow-md">
                            <div className="flex items-center gap-2 mb-2">
                                <Gift size={20} />
                                <p className="text-sm font-bold">Invite friends, earn coins</p>
                            </div>
                            <p className="text-xs text-white/90 leading-relaxed">
                                {referrerText ? <>You get <b>{referrerText}</b></> : 'You earn coins'}
                                {referredText ? <> and your friend gets <b>{referredText}</b></> : null}
                                {' '}when they complete their first order
                                {data.rules?.minOrderValue > 0 ? <> of ₹{data.rules.minOrderValue} or more</> : null}.
                            </p>

                            <div className="mt-4 bg-white/15 border border-white/30 rounded-2xl p-3 flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Your referral code</p>
                                    <p className="text-2xl font-black tracking-[0.15em] mt-0.5 select-all">{code}</p>
                                </div>
                                <button
                                    onClick={() => copyText(code, 'Referral code copied!')}
                                    className="h-9 px-3 rounded-full bg-white text-orange-600 text-xs font-black flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
                                >
                                    <Copy size={14} /> Copy Code
                                </button>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { label: 'Referrals', value: data.stats?.totalReferrals ?? 0, Icon: Users, tone: 'text-blue-600 bg-blue-50' },
                                { label: 'Successful', value: data.stats?.successful ?? 0, Icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
                                { label: 'Coins earned', value: data.stats?.coinsEarned ?? 0, Icon: Coins, tone: 'text-amber-600 bg-amber-50' },
                            ].map(({ label, value, Icon, tone }) => (
                                <div key={label} className="bg-white rounded-2xl border border-slate-100 p-3 text-center shadow-2xs">
                                    <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center ${tone}`}>
                                        <Icon size={16} />
                                    </div>
                                    <p className="text-lg font-black text-slate-900 mt-1.5 leading-none">{value}</p>
                                    <p className="text-[10px] font-bold text-slate-500 mt-1">{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Code used by me */}
                        {data.myReferral && (
                            <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-2xs">
                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Your joining reward</p>
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-bold text-slate-800">Joined with code {data.myReferral.code}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {data.myReferral.status === 'REWARD_CREDITED'
                                                ? `${data.myReferral.coinsEarned} coins added to your wallet on ${formatDate(data.myReferral.creditedAt)}${data.myReferral.coinsReversed ? ` (${data.myReferral.coinsReversed} reversed after a return)` : ''}`
                                                : ['INELIGIBLE', 'REWARD_REVERSED'].includes(data.myReferral.status)
                                                    ? data.myReferral.statusReason || 'This referral is no longer eligible'
                                                    : 'Complete your first order to unlock your reward'}
                                        </p>
                                    </div>
                                    <StatusBadge status={data.myReferral.status} />
                                </div>
                            </div>
                        )}

                        {/* History */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100">
                                <h3 className="text-base font-bold text-slate-800">Referral History</h3>
                            </div>
                            {data.history?.length ? (
                                <div className="divide-y divide-slate-100">
                                    {data.history.map((h) => (
                                        <div key={h.id} className="px-4 py-3 flex items-center justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-bold text-slate-800">{h.friendName}</p>
                                                <p className="text-[11px] text-slate-500">Joined {formatDate(h.joinedAt)}</p>
                                                {h.statusReason && <p className="text-[10px] text-slate-400 mt-0.5">{h.statusReason}</p>}
                                            </div>
                                            <div className="text-right space-y-1">
                                                <StatusBadge status={h.status} />
                                                {h.status === 'REWARD_CREDITED' && (
                                                    <p className="text-xs font-black text-emerald-600">+{h.coinsEarned} coins</p>
                                                )}
                                                {h.coinsReversed > 0 && (
                                                    <p className="text-[10px] font-bold text-red-500">−{h.coinsReversed} coins reversed</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center px-6">
                                    <Users size={28} className="mx-auto text-slate-300 mb-2" />
                                    <p className="text-sm font-semibold text-slate-600">No referrals yet</p>
                                    <p className="text-xs text-slate-400">Give your code to friends to start earning coins.</p>
                                </div>
                            )}
                        </div>

                        {/* Terms */}
                        <div className="bg-white rounded-2xl border border-slate-100 p-4 text-[11px] text-slate-500 space-y-1.5">
                            <p className="font-bold text-slate-700 text-xs">How it works</p>
                            <p>1. Give your code to a friend. They enter it while signing up.</p>
                            <p>2. Coins are credited to both wallets once your friend's first eligible order is delivered.</p>
                            <p>3. Coins are always whole numbers (rounded down). 1 coin = ₹1 in your wallet and can be used at checkout.</p>
                            {data.rules?.percentageBase && (referrerText?.includes('%') || referredText?.includes('%')) && (
                                <p>Percentage rewards are calculated on: {data.rules.percentageBase}.</p>
                            )}
                            {data.rules?.validityDays > 0 && (
                                <p>Your friend must place the order within {data.rules.validityDays} days of signing up.</p>
                            )}
                            <p>Cancelled, failed or returned orders do not qualify. Rewards are given only once per friend.</p>
                            <p>If the qualifying order is later returned, refunded or cancelled, the coins earned from it are taken back.</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ReferEarnPage;
