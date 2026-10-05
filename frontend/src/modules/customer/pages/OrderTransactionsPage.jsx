import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ArrowUpRight, ArrowDownLeft, ReceiptIndianRupee, ShoppingBag } from 'lucide-react';
import { customerApi } from '../services/customerApi';

const OrderTransactionsPage = () => {
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const fetchTransactions = async () => {
            setLoading(true);
            try {
                const response = await customerApi.getTransactions();
                if (!isMounted) return;

                const resData = response.data?.result || response.data?.data || response.data;
                const items =
                    resData?.transactions ||
                    resData?.items ||
                    (Array.isArray(resData) ? resData : []);

                setTransactions(Array.isArray(items) ? items : []);
            } catch (error) {
                console.error('Failed to fetch transactions:', error);
                if (isMounted) {
                    setTransactions([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchTransactions();

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <div className="min-h-screen bg-slate-50/60 pb-24 font-['Outfit',_sans-serif]">
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 pt-4 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
                <button
                    onClick={() => navigate(-1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1"
                >
                    <ChevronLeft size={22} className="text-slate-800" />
                </button>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Order Transactions</h1>
            </div>

            <div className="max-w-2xl mx-auto px-4 pt-1 relative z-20">
                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-slate-800">Transaction History</h3>
                            <p className="text-[11px] font-medium text-slate-500">
                                Based on your recent orders and payments
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                            <ReceiptIndianRupee size={20} />
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-12 flex items-center justify-center text-xs text-slate-400 font-semibold">
                            Loading transactions...
                        </div>
                    ) : transactions.length === 0 ? (
                        <div className="py-14 flex flex-col items-center justify-center text-center px-6">
                            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                                <ReceiptIndianRupee size={28} />
                            </div>
                            <p className="text-base font-bold text-slate-800 mb-1">
                                No transactions yet
                            </p>
                            <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed mb-4">
                                When you place orders or use your wallet, your payment records will show up here.
                            </p>
                            <button
                                onClick={() => navigate('/categories')}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5"
                            >
                                <ShoppingBag size={14} />
                                <span>Start Shopping</span>
                            </button>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {transactions.map((tx) => {
                                const isCredit =
                                    tx.type === 'credit' ||
                                    tx.isCredit ||
                                    String(tx.type || '').toLowerCase().includes('refund') ||
                                    String(tx.type || '').toLowerCase().includes('topup');
                                const amount = Number(tx.amount || tx.totalAmount || 0);
                                const createdAt = tx.createdAt ? new Date(tx.createdAt) : null;
                                const title =
                                    tx.title ||
                                    tx.description ||
                                    (isCredit ? 'Wallet Credit / Refund' : 'Order Payment');

                                return (
                                    <div
                                        key={tx._id || tx.id}
                                        className="px-4 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div
                                                className={`w-10 h-10 rounded-full border flex items-center justify-center shrink-0 ${
                                                    isCredit
                                                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                                        : 'bg-slate-100 border-slate-200 text-slate-700'
                                                }`}
                                            >
                                                {isCredit ? (
                                                    <ArrowDownLeft size={18} />
                                                ) : (
                                                    <ArrowUpRight size={18} />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 text-sm">
                                                    {title}
                                                </h4>
                                                <p className="text-[11px] font-medium text-slate-500">
                                                    {tx.orderId ? `Order #${tx.orderId} • ` : ''}
                                                    {tx.paymentMethod || 'Online'}
                                                </p>
                                                {createdAt && (
                                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                                        {createdAt.toLocaleDateString('en-GB', {
                                                            day: '2-digit',
                                                            month: '2-digit',
                                                            year: 'numeric',
                                                        })}{' '}
                                                        •{' '}
                                                        {createdAt.toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div
                                            className={`text-sm font-bold ${
                                                isCredit ? 'text-emerald-600' : 'text-slate-900'
                                            }`}
                                        >
                                            {isCredit ? '+' : '-'}₹{Math.abs(amount)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderTransactionsPage;
