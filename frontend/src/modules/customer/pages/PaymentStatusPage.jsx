import React, { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  Loader2,
  AlertTriangle,
  ArrowRight,
  RefreshCcw,
  ShoppingBag,
  MapPin,
  CreditCard,
  ExternalLink,
  Home,
  Package,
} from "lucide-react";
import { customerApi } from "../services/customerApi";
import { useAuth } from "@/core/context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import Button from "@shared/components/ui/Button";

const PaymentStatusPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const { clearCart } = useCart();

  const merchantOrderId = searchParams.get("merchantOrderId");
  const [status, setStatus] = useState("verifying"); // verifying, success, failure, timeout
  const [paymentData, setPaymentData] = useState(null);
  const [orderSummary, setOrderSummary] = useState(null);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 10;
  const pollInterval = useRef(null);

  const verifyPayment = async () => {
    if (!merchantOrderId) {
      setStatus("failure");
      setError("Missing Order Reference ID");
      return;
    }

    try {
      const response = await customerApi.verifyPaymentStatus(merchantOrderId);
      if (response.data.success) {
        const paymentStatus = response.data.result.status;
        const payment = response.data.result.payment;
        const summary = response.data.result.orderSummary;

        setPaymentData(payment);
        if (summary) setOrderSummary(summary);

        if (paymentStatus === "CAPTURED") {
          setStatus("success");
          if (pollInterval.current) clearInterval(pollInterval.current);
          clearCart();

          const isWallet = summary?.isWalletTopup || merchantOrderId?.startsWith("WTOPUP-");

          // Fast auto-redirect if the user is authenticated
          if (isAuthenticated) {
            setTimeout(() => {
              if (isWallet) {
                navigate("/wallet", { replace: true });
              } else {
                const targetId =
                  summary?.publicOrderId ||
                  summary?.orderId ||
                  payment?.checkoutGroupId ||
                  payment?.publicOrderId ||
                  payment?.order;
                if (targetId) {
                  navigate(`/orders/${targetId}`, { replace: true });
                }
              }
            }, isWallet ? 1000 : 1200);
          }
        } else if (
          paymentStatus === "FAILED" ||
          paymentStatus === "CANCELLED"
        ) {
          setStatus("failure");
          if (pollInterval.current) clearInterval(pollInterval.current);
        } else {
          // Still pending, continue polling
          setRetryCount((prev) => prev + 1);
        }
      }
    } catch (err) {
      console.error("Verification error:", err);
      const isNetworkError = !err?.response;

      if (isNetworkError) {
        setStatus("timeout");
        setError(
          "Cannot reach the backend server. Please verify your connection.",
        );
        if (pollInterval.current) clearInterval(pollInterval.current);
        return;
      }

      setRetryCount((prev) => prev + 1);
    }
  };

  useEffect(() => {
    if (merchantOrderId) {
      verifyPayment();
      // Fast 1.2s polling for rapid gateway status resolution
      pollInterval.current = setInterval(() => {
        setRetryCount((prev) => {
          if (prev >= maxRetries) {
            setStatus("timeout");
            if (pollInterval.current) clearInterval(pollInterval.current);
            return prev;
          }
          verifyPayment();
          return prev;
        });
      }, 1200);
    } else {
      setStatus("failure");
      setError("Invalid payment reference");
    }

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [merchantOrderId]);

  const handleManualRetry = () => {
    setRetryCount(0);
    setStatus("verifying");
    verifyPayment();
  };

  const targetOrderId =
    orderSummary?.publicOrderId ||
    orderSummary?.orderId ||
    paymentData?.checkoutGroupId ||
    paymentData?.publicOrderId ||
    paymentData?.order;

  const displayAmount =
    orderSummary?.amount != null
      ? (orderSummary.amount / 100).toFixed(2)
      : paymentData?.amount != null
        ? (paymentData.amount / 100).toFixed(2)
        : null;

  return (
    <div className="min-h-screen bg-slate-50/50 flex items-center justify-center p-4 font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] p-6 sm:p-8 shadow-2xl shadow-slate-200/80 border border-slate-100 text-center relative overflow-hidden"
      >
        {/* Status-specific background elements */}
        <AnimatePresence mode="wait">
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-50/80 rounded-full blur-3xl pointer-events-none"
            />
          )}
          {(status === "failure" || status === "timeout") && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute -top-24 -right-24 w-64 h-64 bg-rose-50/80 rounded-full blur-3xl pointer-events-none"
            />
          )}
        </AnimatePresence>

        <div className="relative z-10">
          {/* Icon Section */}
          <div className="mb-6 flex justify-center">
            <AnimatePresence mode="wait">
              {status === "verifying" && (
                <motion.div
                  key="verifying"
                  initial={{ scale: 0.5, rotate: 0 }}
                  animate={{ scale: 1, rotate: 360 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{
                    rotate: {
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    },
                  }}
                  className="w-20 h-20 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center shadow-inner"
                >
                  <Loader2 size={38} />
                </motion.div>
              )}

              {status === "success" && (
                <motion.div
                  key="success"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-100/50"
                >
                  <Check size={40} strokeWidth={3} />
                </motion.div>
              )}

              {status === "failure" && (
                <motion.div
                  key="failure"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow-lg shadow-rose-100/50"
                >
                  <X size={40} strokeWidth={3} />
                </motion.div>
              )}

              {status === "timeout" && (
                <motion.div
                  key="timeout"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shadow-lg shadow-amber-100/50"
                >
                  <AlertTriangle size={40} strokeWidth={3} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dynamic Content Body */}
          <AnimatePresence mode="wait">
            {status === "verifying" && (
              <motion.div
                key="text-verifying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h1 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tight">
                  Verifying Payment
                </h1>
                <p className="text-slate-500 text-sm font-medium">
                  Please wait while we confirm your payment with PhonePe. Do not
                  refresh or close this window.
                </p>
                <div className="mt-6 flex justify-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                      className="w-2.5 h-2.5 bg-amber-500 rounded-full"
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="text-success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h1 className="text-2xl font-black text-slate-800 mb-1 uppercase tracking-tight">
                  {(orderSummary?.isWalletTopup || merchantOrderId?.startsWith("WTOPUP-")) ? "Wallet Top-up Confirmed!" : "Order Confirmed!"}
                </h1>
                <p className="text-emerald-600 text-xs font-black mb-6 uppercase tracking-wider">
                  Payment Successful
                </p>

                {/* Receipt Card */}
                <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 text-left space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {(orderSummary?.isWalletTopup || merchantOrderId?.startsWith("WTOPUP-")) ? "Top-up Reference" : "Order Reference"}
                    </span>
                    <span className="text-xs font-black text-slate-800 font-mono">
                      #{targetOrderId || merchantOrderId}
                    </span>
                  </div>

                  {displayAmount && (
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {(orderSummary?.isWalletTopup || merchantOrderId?.startsWith("WTOPUP-")) ? "Amount Added" : "Amount Paid"}
                      </span>
                      <span className="text-sm font-black text-emerald-600">
                        ₹{displayAmount}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Payment Mode
                    </span>
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <CreditCard size={13} className="text-emerald-500" /> PhonePe UPI / Gateway
                    </span>
                  </div>

                  {orderSummary?.address?.address && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <div className="flex items-start gap-1.5 text-slate-500">
                        <MapPin size={14} className="shrink-0 mt-0.5 text-slate-400" />
                        <p className="text-[11px] font-medium leading-tight line-clamp-2">
                          {orderSummary.address.name ? `${orderSummary.address.name}, ` : ""}
                          {orderSummary.address.address}
                          {orderSummary.address.city ? `, ${orderSummary.address.city}` : ""}
                        </p>
                      </div>
                    </div>
                  )}

                  {isAuthenticated && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <p className="text-[11px] text-slate-400 text-center font-medium">
                        {(orderSummary?.isWalletTopup || merchantOrderId?.startsWith("WTOPUP-"))
                          ? "Redirecting to your wallet in a few seconds..."
                          : "Redirecting to order tracking in a few seconds..."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2.5">
                  {(orderSummary?.isWalletTopup || merchantOrderId?.startsWith("WTOPUP-")) ? (
                    <Button
                      onClick={() => navigate("/wallet")}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      Go to Wallet <ArrowRight size={18} />
                    </Button>
                  ) : (
                    <Button
                      onClick={() => {
                        if (targetOrderId) {
                          navigate(`/orders/${targetOrderId}`);
                        } else {
                          navigate("/orders");
                        }
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                    >
                      View Order Details <ArrowRight size={18} />
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="w-full border-slate-200 text-slate-600 font-bold h-11 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-50"
                  >
                    <Home size={16} /> Continue Shopping
                  </Button>
                </div>
              </motion.div>
            )}

            {status === "failure" && (
              <motion.div
                key="text-failure"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h1 className="text-2xl font-black text-slate-800 mb-1 uppercase tracking-tight">
                  Payment Failed
                </h1>
                <p className="text-rose-600 text-xs font-black mb-4 uppercase tracking-wider">
                  {error || "Transaction Declined"}
                </p>
                <p className="text-slate-500 text-xs font-medium mb-6 leading-relaxed">
                  We could not complete your payment. If any amount was debited
                  from your bank, it will be automatically refunded by PhonePe.
                </p>

                <div className="flex flex-col gap-2.5">
                  <Button
                    onClick={() => navigate("/checkout")}
                    className="w-full bg-slate-900 hover:bg-black text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2"
                  >
                    <RefreshCcw size={16} /> Try Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="w-full border-slate-200 text-slate-600 font-bold h-11 rounded-xl"
                  >
                    Back to Home
                  </Button>
                </div>
              </motion.div>
            )}

            {status === "timeout" && (
              <motion.div
                key="text-timeout"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <h1 className="text-2xl font-black text-slate-800 mb-1 uppercase tracking-tight">
                  Payment Processing
                </h1>
                <p className="text-amber-600 text-xs font-black mb-4 uppercase tracking-wider">
                  Awaiting Bank Confirmation
                </p>
                <div className="bg-amber-50 rounded-2xl p-4 mb-6 border border-amber-100 flex items-start gap-2.5 text-left">
                  <AlertTriangle
                    className="text-amber-600 shrink-0 mt-0.5"
                    size={18}
                  />
                  <p className="text-xs text-amber-900 font-medium leading-relaxed">
                    PhonePe is still waiting for confirmation from your bank.
                    Your order will be updated automatically as soon as the
                    payment clears.
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <Button
                    onClick={handleManualRetry}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-12 rounded-xl flex items-center justify-center gap-2"
                  >
                    <RefreshCcw size={16} /> Check Status Again
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="w-full border-slate-200 text-slate-600 font-bold h-11 rounded-xl"
                  >
                    Back to Home
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress bar for polling */}
        {status === "verifying" && (
          <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100">
            <motion.div
              className="h-full bg-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${(retryCount / maxRetries) * 100}%` }}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PaymentStatusPage;
