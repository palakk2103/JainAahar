import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { useTranslation } from '@core/context/LanguageContext';
import { ChevronLeft, Globe, ChevronDown, Mail, Phone, ArrowLeft, X } from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';

const CustomerAuth = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(location.pathname !== '/signup');
    const [referralCheck, setReferralCheck] = useState({ state: 'idle', message: '' });
    const [authMethod, setAuthMethod] = useState('phone'); // 'phone' | 'email'
    const [isLoading, setIsLoading] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [timer, setTimer] = useState(0);
    const { login } = useAuth();
    const { settings } = useSettings();
    const { t, language, setLanguage, languages } = useTranslation();
    const [isLangOpen, setIsLangOpen] = useState(false);
    const dropdownRef = useRef(null);
    const appName = settings?.appName || 'App';

    const [formData, setFormData] = useState({
        phone: '',
        email: '',
        otp: '',
        name: '',
        referralCode: (new URLSearchParams(window.location.search).get('ref') || '').toUpperCase()
    });

    // Validate the referral code shortly after the user stops typing.
    useEffect(() => {
        const code = formData.referralCode.trim();
        if (isLogin || !code) {
            setReferralCheck({ state: 'idle', message: '' });
            return undefined;
        }
        if (code.length < 4) return undefined;
        setReferralCheck({ state: 'checking', message: '' });
        const timeout = setTimeout(async () => {
            try {
                const res = await customerApi.validateReferralCode(code);
                const result = res?.data?.result || {};
                const reward = result.reward;
                const rewardText = reward
                    ? reward.type === 'percentage'
                        ? `${reward.value}% of your first order in coins${reward.maxCoins ? ` (up to ${reward.maxCoins})` : ''}`
                        : `${reward.value} coins`
                    : '';
                setReferralCheck({
                    state: 'valid',
                    message: result.kind === 'customer'
                        ? `Code applied${result.referrerName ? ` (invited by ${result.referrerName})` : ''}.${rewardText ? ` You'll get ${rewardText} after your first order is delivered.` : ''}`
                        : 'Referral code is valid.',
                });
            } catch (error) {
                setReferralCheck({
                    state: 'invalid',
                    message: error?.response?.data?.message || 'Invalid referral code',
                });
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [formData.referralCode, isLogin]);

    // Synchronize mode with current route
    useEffect(() => {
        if (location.pathname === '/signup') {
            setIsLogin(false);
        } else if (location.pathname === '/login') {
            setIsLogin(true);
        }
    }, [location.pathname]);

    // Handle timer for OTP resend
    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    // Language dropdown outside click listener
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle Android hardware back & browser popstate to prevent sudden app exit
    useEffect(() => {
        // If loaded as first entry with no history stack, tag state to safely fallback to Home
        if (window.history.state?.idx === 0) {
            window.history.replaceState({ ...window.history.state, initialAuth: true }, '');
            window.history.pushState({ authPage: true }, '');
        }

        const handlePopState = (e) => {
            if (showOtp) {
                setShowOtp(false);
                return;
            }
            if (e.state?.initialAuth) {
                navigate('/', { replace: true });
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [showOtp, navigate]);

    const handleClose = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/', { replace: true });
        }
    };

    const handleSendOtp = async (e) => {
        e?.preventDefault();

        if (authMethod === 'phone') {
            const phoneTrimmed = formData.phone.trim().replace(/\D/g, '');
            if (!phoneTrimmed || phoneTrimmed.length < 10) {
                toast.error(t('enterValidPhone') || 'Please enter a valid 10-digit mobile number');
                return;
            }
            if (!isLogin && !formData.name.trim()) {
                toast.error(t('enterFullName'));
                return;
            }
            if (!isLogin && referralCheck.state === 'invalid') {
                toast.error(referralCheck.message || 'Please fix or remove the referral code');
                return;
            }

            setIsLoading(true);
            try {
                if (isLogin) {
                    await customerApi.sendLoginOtp({ phone: phoneTrimmed });
                } else {
                    await customerApi.sendSignupOtp({
                        name: formData.name.trim(),
                        phone: phoneTrimmed,
                        referralCode: formData.referralCode
                    });
                }
                setShowOtp(true);
                setTimer(30);
                toast.success('OTP sent to your mobile number!');
            } catch (error) {
                const apiMessage = error?.response?.data?.message || error?.message || 'Failed to send OTP';
                toast.error(apiMessage);
            } finally {
                setIsLoading(false);
            }
        } else {
            const emailTrimmed = formData.email.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailTrimmed || !emailRegex.test(emailTrimmed)) {
                toast.error('Please enter a valid email address');
                return;
            }
            if (!isLogin && !formData.name.trim()) {
                toast.error(t('enterFullName'));
                return;
            }
            if (!isLogin && referralCheck.state === 'invalid') {
                toast.error(referralCheck.message || 'Please fix or remove the referral code');
                return;
            }

            setIsLoading(true);
            try {
                if (isLogin) {
                    await customerApi.sendLoginOtp({ email: emailTrimmed });
                } else {
                    await customerApi.sendSignupOtp({
                        name: formData.name.trim(),
                        email: emailTrimmed,
                        referralCode: formData.referralCode
                    });
                }
                setShowOtp(true);
                setTimer(30);
                toast.success('OTP sent to your email!');
            } catch (error) {
                const apiMessage = error?.response?.data?.message || error?.message || 'Failed to send OTP';
                toast.error(apiMessage);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (formData.otp.length !== 4) {
            toast.error('Enter 4-digit code');
            return;
        }
        setIsLoading(true);
        try {
            const payload = {
                otp: formData.otp,
                ...(authMethod === 'phone'
                    ? { phone: formData.phone.trim().replace(/\D/g, '') }
                    : { email: formData.email.trim() }
                )
            };
            const response = await customerApi.verifyOtp(payload);
            const { token, customer, referral } = response.data.result;
            login({ ...customer, token, role: 'customer' });
            toast.success(t('loggedInSuccess'));
            if (referral?.applied) {
                toast.success('Referral code applied! Your coins will be credited after your first order is delivered.');
            } else if (referral && referral.message) {
                toast.warning(`Referral not applied: ${referral.message}`);
            }
            navigate('/');
        } catch (error) {
            const apiMessage = error?.response?.data?.message || error?.message || t('invalidOtp');
            toast.error(apiMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50/50 px-4 py-8 font-['Outfit',_sans-serif]">
            <div className="w-full max-w-[390px] bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 relative">
                {/* Close (Cross) Icon Button */}
                <div className="flex items-center justify-end mb-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-800 bg-gray-100/80 hover:bg-gray-200 rounded-full transition-all cursor-pointer active:scale-95 shadow-2xs"
                        aria-label="Close"
                        title="Close and return to app"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Logo */}
                <div className="flex flex-col items-center justify-center mb-5 -mt-1">
                    <img 
                        src="/jainaaharlogo-removebg-preview.png" 
                        alt="Jain Aahar Logo" 
                        className="h-24 w-auto object-contain cursor-pointer hover:opacity-90 transition-opacity" 
                        onClick={() => navigate('/')}
                    />
                </div>

                {/* Language Switcher Section */}
                <div className="mb-5 pb-4 border-b border-gray-100 flex flex-col items-center">
                    {/* Desktop Dropdown */}
                    <div ref={dropdownRef} className="hidden md:block relative w-full">
                        <button
                            type="button"
                            onClick={() => setIsLangOpen(!isLangOpen)}
                            className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold text-gray-700 transition-all focus:outline-none"
                        >
                            <div className="flex items-center gap-2">
                                <Globe size={16} className="text-gray-400" />
                                <span>{languages.find(l => l.code === language)?.flag} {languages.find(l => l.code === language)?.name}</span>
                            </div>
                            <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isLangOpen && (
                            <div className="absolute right-0 left-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                {languages.map((lang) => (
                                    <button
                                        key={lang.code}
                                        type="button"
                                        onClick={() => {
                                            setLanguage(lang.code);
                                            setIsLangOpen(false);
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-gray-50 ${language === lang.code ? 'bg-orange-50/50 text-[#f97316] font-semibold' : 'text-gray-700'}`}
                                    >
                                        <span className="text-base">{lang.flag}</span>
                                        <span>{lang.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mobile pills */}
                    <div className="block md:hidden w-full">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Globe size={12} /> Language / भाषा
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-start">
                            {languages.map((lang) => (
                                <button
                                    key={lang.code}
                                    type="button"
                                    onClick={() => setLanguage(lang.code)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                                        language === lang.code
                                            ? 'bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/20'
                                            : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    <span>{lang.flag}</span>
                                    <span>{lang.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                
                {!showOtp ? (
                    <>
                        <div className="text-left mb-4">
                            <h2 className="text-xl font-bold text-gray-900">
                                {isLogin ? t('loginSignup') : t('createAccount')}
                            </h2>
                            <p className="mt-1 text-xs text-gray-500">
                                {isLogin
                                    ? (authMethod === 'phone' ? (t('enterMobile') || 'Enter your mobile number to continue') : 'Enter your email address to continue')
                                    : 'Fill in your details to create a new account'}
                            </p>
                        </div>

                        {/* Phone / Email Toggle Switch */}
                        <div className="mb-4 p-1 bg-gray-100/80 rounded-2xl flex items-center gap-1 border border-gray-200/60">
                            <button
                                type="button"
                                onClick={() => setAuthMethod('phone')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    authMethod === 'phone'
                                        ? 'bg-white text-orange-600 shadow-xs border border-gray-200/50'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <Phone size={14} />
                                <span>Phone Number</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setAuthMethod('email')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    authMethod === 'email'
                                        ? 'bg-white text-orange-600 shadow-xs border border-gray-200/50'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                <Mail size={14} />
                                <span>Email Address</span>
                            </button>
                        </div>

                        <form className="space-y-3.5" onSubmit={handleSendOtp}>
                            {!isLogin && (
                                <div className="space-y-3.5">
                                    <div className="relative">
                                        <input
                                            required
                                            type="text"
                                            name="name"
                                            value={formData.name}
                                            placeholder={t('fullName') || 'Your Full Name'}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] transition-all"
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            name="referralCode"
                                            value={formData.referralCode}
                                            placeholder={t('referralCode') || 'Referral Code (Optional)'}
                                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] transition-all uppercase"
                                            onChange={(e) => setFormData({ ...formData, referralCode: e.target.value.toUpperCase().replace(/\s/g, '') })}
                                        />
                                        {referralCheck.state !== 'idle' && (
                                            <p
                                                className={`mt-1.5 px-1 text-[11px] font-semibold ${
                                                    referralCheck.state === 'valid'
                                                        ? 'text-emerald-600'
                                                        : referralCheck.state === 'invalid'
                                                            ? 'text-red-500'
                                                            : 'text-gray-400'
                                                }`}
                                            >
                                                {referralCheck.state === 'checking' ? 'Checking code...' : referralCheck.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {authMethod === 'phone' ? (
                                <div className="relative flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#f97316] focus-within:ring-1 focus-within:ring-[#f97316] transition-all bg-white">
                                    <div className="pl-4 pr-3 py-3 text-gray-600 font-bold text-sm border-r border-gray-200 bg-gray-50 flex items-center gap-1.5">
                                        <Phone size={15} className="text-gray-400" />
                                        <span>+91</span>
                                    </div>
                                    <input
                                        required
                                        type="tel"
                                        name="phone"
                                        maxLength={10}
                                        value={formData.phone}
                                        placeholder={t('enterMobile') || 'Enter 10-digit mobile number'}
                                        className="w-full px-4 py-3 text-sm font-semibold text-gray-800 outline-none bg-transparent"
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                                    />
                                </div>
                            ) : (
                                <div className="relative flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#f97316] focus-within:ring-1 focus-within:ring-[#f97316] transition-all bg-white">
                                    <div className="pl-4 pr-3 py-3 text-gray-400 border-r border-gray-200 bg-gray-50 flex items-center justify-center">
                                        <Mail size={18} />
                                    </div>
                                    <input
                                        required
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        placeholder="Enter your email address"
                                        className="w-full px-4 py-3 text-sm font-semibold text-gray-800 outline-none bg-transparent"
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full mt-2 text-white bg-[#f97316] hover:bg-orange-600 py-3.5 rounded-xl text-sm font-bold tracking-wide flex items-center justify-center gap-3 transition-all cursor-pointer shadow-md shadow-orange-500/20 active:scale-[0.99]"
                            >
                                {isLoading ? t('pleaseWait') : t('continue')}
                            </button>
                        </form>

                        <div className="mt-5 text-center">
                            <button
                                onClick={() => {
                                    const nextIsLogin = !isLogin;
                                    setIsLogin(nextIsLogin);
                                    navigate(nextIsLogin ? '/login' : '/signup', { replace: true });
                                }}
                                className="text-xs font-semibold text-gray-600 hover:text-[#f97316] transition-colors cursor-pointer"
                            >
                                {isLogin ? t('newUser') : t('alreadyAccount')}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="text-left mb-5">
                            <div className="flex items-center gap-2.5 mb-1">
                                <button
                                    onClick={() => setShowOtp(false)}
                                    className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                    aria-label="Back to Phone/Email input"
                                >
                                    <ArrowLeft size={18} />
                                </button>
                                <h2 className="text-xl font-bold text-gray-900">
                                    {t('verifyOtp')}
                                </h2>
                            </div>
                            <p className="mt-1 text-xs text-gray-500 ml-7">
                                Sent to {authMethod === 'phone' ? `+91 ${formData.phone}` : formData.email}
                            </p>
                        </div>

                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div className="flex justify-center gap-2.5">
                                {[...Array(4)].map((_, i) => (
                                    <input
                                        key={i}
                                        type="tel"
                                        maxLength={1}
                                        className="w-12 h-14 bg-gray-50 border border-gray-200 rounded-xl text-center text-xl font-bold text-gray-900 outline-none focus:bg-white focus:border-[#f97316] focus:ring-1 focus:ring-[#f97316] transition-all"
                                        value={formData.otp[i] || ''}
                                        onKeyDown={(e) => {
                                            const target = /** @type {HTMLInputElement} */ (e.currentTarget);
                                            if (e.key === 'Backspace' && !target.value && i > 0) {
                                                const prev = /** @type {HTMLInputElement | null} */ (target.previousElementSibling);
                                                if (prev) prev.focus();
                                            }
                                        }}
                                        onChange={(e) => {
                                            const target = /** @type {HTMLInputElement} */ (e.currentTarget);
                                            const val = target.value;
                                            if (val && i < 3) {
                                                const next = /** @type {HTMLInputElement | null} */ (target.nextElementSibling);
                                                if (next) next.focus();
                                            }
                                            const otpArr = formData.otp.split('');
                                            otpArr[i] = val;
                                            setFormData({ ...formData, otp: otpArr.join('') });
                                        }}
                                    />
                                ))}
                            </div>

                            <div className="space-y-3.5">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full text-white bg-[#f97316] hover:bg-orange-600 py-3.5 rounded-xl text-sm font-bold tracking-wide flex items-center justify-center transition-all cursor-pointer shadow-md shadow-orange-500/20 active:scale-[0.99]"
                                >
                                    {isLoading ? t('verifying') : t('verifyProceed')}
                                </button>
                                <div className="flex justify-center">
                                    <button
                                        type="button"
                                        disabled={timer > 0}
                                        onClick={handleSendOtp}
                                        className={`text-xs font-semibold cursor-pointer ${timer > 0 ? 'text-gray-400' : 'text-[#f97316] hover:underline'}`}
                                    >
                                        {timer > 0 ? `${t('resendIn')} ${timer}s` : t('resendCode')}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </>
                )}

                {/* Legal Agreement Footer */}
                <div className="pt-6 mt-4 border-t border-gray-100 flex flex-col items-center gap-1.5">
                    <p className="text-[11px] text-gray-400 text-center font-medium">
                        {t('agreeText')}
                    </p>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => navigate('/terms')}
                            className="text-[11px] font-semibold text-gray-500 hover:text-[#f97316] transition-colors cursor-pointer"
                        >
                            {t('terms')}
                        </button>
                        <span className="text-[10px] text-gray-300">•</span>
                        <button 
                            onClick={() => navigate('/privacy-policy')}
                            className="text-[11px] font-semibold text-gray-500 hover:text-[#f97316] transition-colors cursor-pointer"
                        >
                            {t('privacy')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerAuth;



