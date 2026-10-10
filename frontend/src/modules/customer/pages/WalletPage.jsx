import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownLeft, ChevronLeft, Wallet, ArrowRight, Plus, X, Loader2, CheckCircle2, ShieldCheck, Sparkles, Gift, Coins } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { useToast } from '@shared/components/ui/Toast';
import { invalidateCache } from '@core/api/dedupe';
import WalletPaymentModal from './wallet/WalletPaymentModal';

const formatDate = (d) => {
    if (!d) return '';
    const date = new Date(d);
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

let cachedWalletData = null;

const WalletPage = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [balance, setBalance] = useState(() => cachedWalletData?.balance ?? 0);
    const [transactions, setTransactions] = useState(() => cachedWalletData?.transactions ?? []);
    const [loading, setLoading] = useState(() => !cachedWalletData);
    const [referralEnabled, setReferralEnabled] = useState(false);

    useEffect(() => {
        customerApi.getReferralProgram()
            .then((res) => setReferralEnabled(Boolean(res?.data?.result?.enabled)))
            .catch(() => setReferralEnabled(false));
    }, []);

    // Modal state for PhonePe / UPI Add Money
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const fetchData = async (showLoadingState = false) => {
        invalidateCache("/customer/profile");
        invalidateCache("/customer/transactions");
        if (showLoadingState || !cachedWalletData) {
            setLoading(true);
        }
        try {
            const [profileRes, txRes] = await Promise.all([
                customerApi.getProfile().catch(() => null),
                customerApi.getWalletTransactions().catch(() => null),
            ]);

            const profile = profileRes?.data?.result ?? profileRes?.data?.data ?? profileRes?.data;
            const currentBal = profile?.walletBalance ?? 0;
            setBalance(currentBal);

            // Check if server returned wallet transactions (handleResponse wraps in result.items)
            const txResult = txRes?.data?.result ?? txRes?.data?.data ?? txRes?.data;
            const txItems = Array.isArray(txResult?.items)
                ? txResult.items
                : Array.isArray(txResult)
                ? txResult
                : (Array.isArray(txRes?.data?.items) ? txRes.data.items : []);

            const finalTxList = Array.isArray(txItems) ? txItems : [];
            setTransactions(finalTxList);

            cachedWalletData = {
                balance: currentBal,
                transactions: finalTxList,
            };
        } catch (err) {
            console.error('Wallet fetch error:', err);
            if (!cachedWalletData) {
                setBalance(0);
                setTransactions([]);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        cachedWalletData = null;
        fetchData(false);
    }, []);

    const handlePaymentSuccess = async (newBalance, txDetails) => {
        setBalance(newBalance);
        showToast(`₹${Number(txDetails?.amount || 0).toLocaleString('en-IN')} added to your wallet!`, "success");
        // Freshly sync transactions from server
        await fetchData();
    };

    return (
        <div className="min-h-screen bg-white pb-16 font-['Outfit',_sans-serif]">
            {/* Top Navigation */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-2 border-b border-slate-100 mb-2 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1 cursor-pointer"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Wallet</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20 space-y-4">
                {/* Wallet Balance Card */}
                <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-xs flex items-center justify-between overflow-hidden relative">
                    {/* Left Column */}
                    <div className="flex flex-col items-start text-left">
                        <p className="text-xs font-bold text-slate-800 tracking-tight">My Wallet</p>
                        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-1.5 leading-none tracking-tight">
                            {loading ? '...' : `₹${(balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </h2>
                        <p className="text-xs font-bold text-slate-400 mt-1.5 leading-none">Wallet Balance</p>

                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="mt-5 h-9 px-5 rounded-full bg-gradient-to-r from-[#5f259f] to-[#4c1d95] hover:from-[#5f259f]/95 hover:to-[#4c1d95]/95 text-white font-black text-[11px] flex items-center gap-1.5 shadow-md shadow-purple-950/20 hover:scale-105 active:scale-95 transition-all select-none cursor-pointer"
                        >
                            <span>Add Money</span>
                            <ArrowRight size={13} strokeWidth={3} />
                        </button>
                    </div>

                    {/* Right Column */}
                    <div className="w-[160px] h-[130px] flex items-center justify-center shrink-0">
                        <img
                            src="/wallet iamge .png"
                            alt="Wallet Illustration"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    </div>
                </div>

                {referralEnabled && (
                    <button
                        onClick={() => navigate('/refer-earn')}
                        className="w-full rounded-2xl border border-amber-100 bg-amber-50/70 p-4 flex items-center justify-between text-left cursor-pointer hover:bg-amber-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white border border-amber-100 flex items-center justify-center text-amber-600">
                                <Gift size={18} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-800">Refer & Earn</p>
                                <p className="text-[11px] text-slate-500">Invite friends and earn coins (1 coin = ₹1)</p>
                            </div>
                        </div>
                        <ArrowRight size={16} className="text-amber-600" />
                    </button>
                )}

                {/* Transaction History Section */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-800">Transaction History</h3>
                        <div className="w-10 h-10 rounded-full bg-teal-50/80 border border-teal-100 flex items-center justify-center text-teal-700 shrink-0">
                            <span className="text-lg">👛</span>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-8 flex justify-center text-slate-400 text-sm font-semibold">
                            <Loader2 className="animate-spin text-slate-400 mr-2" size={18} /> Loading wallet history...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-8 flex flex-col items-center justify-center text-center px-6">
                            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-2xl mb-2">
                                💳
                            </div>
                            <p className="text-sm font-semibold text-slate-600 mb-1">No wallet payments yet</p>
                            <p className="text-xs text-slate-400 max-w-xs">
                                Top ups & orders paid using wallet balance will appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {transactions.map((tx) => {
                                const isCredit = tx.type === 'credit';
                                return (
                                    <div key={tx._id} className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                                        <div className="flex items-center gap-3.5">
                                            <div className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-2xs shrink-0 ${isCredit ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                                                {isCredit ? (
                                                    <ArrowDownLeft size={20} className="text-emerald-600" />
                                                ) : (
                                                    <ArrowUpRight size={20} className="text-slate-600" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <h4 className="font-bold text-slate-800 text-sm">{tx.title}</h4>
                                                    {tx.paymentMethod && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-[#5f259f] border border-purple-100">
                                                            {tx.paymentMethod}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-medium text-slate-500 mt-0.5">{formatDate(tx.date)}</p>
                                                {tx.orderId && (
                                                    <p className="text-[10px] text-slate-400">Order #{tx.orderId}</p>
                                                )}
                                                {tx.category === 'referral' && (
                                                    <p className="text-[10px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                                        <Coins size={11} /> {isCredit ? '+' : '−'}{tx.coins} coins
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className={`text-sm font-black ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                                            {isCredit ? '+' : '-'}₹{(tx.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* PhonePe & Multi-Payment Modal */}
            <WalletPaymentModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                initialAmount="500"
                onPaymentSuccess={handlePaymentSuccess}
            />
        </div>
    );
};

export default WalletPage;
