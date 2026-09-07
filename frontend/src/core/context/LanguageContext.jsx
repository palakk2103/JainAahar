import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { translateText } from '../services/translationService';

const LanguageContext = createContext(null);

const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' }
];

const translations = {
    en: {
        // Login / Signup Page
        loginSignup: "Login / Signup",
        enterMobile: "Enter your mobile number",
        createAccount: "Create a new account",
        fullName: "Full Name",
        referralCode: "Referral Code (Optional)",
        mobileNumber: "Mobile Number",
        continue: "Continue",
        pleaseWait: "Please wait...",
        newUser: "New user? Create an account",
        alreadyAccount: "Already have an account? Login",
        verifyOtp: "Verify OTP",
        sentTo: "Sent to",
        verifyProceed: "Verify & Proceed",
        verifying: "Verifying...",
        resendIn: "Resend Code in",
        resendCode: "Resend Code",
        agreeText: "By continuing, you agree to our",
        terms: "Terms & Conditions",
        privacy: "Privacy Policy",
        enterValidPhone: "Enter valid 10-digit number",
        enterFullName: "Please enter your full name",
        otpSent: "OTP sent!",
        loggedInSuccess: "Successfully Logged In!",
        invalidOtp: "Invalid OTP",

        // Profile Page
        myProfile: "My Profile",
        personalAccount: "Personal Account",
        myCart: "My Cart",
        viewAdded: "View your added products",
        yourOrders: "Your Orders",
        trackReturn: "Track, return or buy things again",
        transactions: "Order Transactions",
        viewPayments: "View all payments & refunds",
        wallet: "Wallet",
        balanceRefunds: "Balance & return refunds",
        wishlist: "Your Wishlist",
        savedItems: "Your saved items",
        savedAddresses: "Saved Addresses",
        manageLocations: "Manage your delivery locations",
        helpSettings: "Help & Settings",
        helpSupport: "Help & Support",
        aboutUs: "About Us",
        signOut: "Sign out",
        version: "Version",
        signOutTitle: "Sign out?",
        signOutConfirm: "Are you sure you want to sign out from your account? You will need to login again to access your orders.",
        cancel: "Cancel",
        yesSignOut: "Yes, Sign out",
        selectLanguage: "Select Language",
        languageDesc: "Choose your preferred language",
        english: "English",
        hindi: "Hindi (हिन्दी)"
    },
    hi: {
        // Login / Signup Page
        loginSignup: "लॉगिन / साइनअप",
        enterMobile: "अपना मोबाइल नंबर दर्ज करें",
        createAccount: "नया खाता बनाएं",
        fullName: "पूरा नाम",
        referralCode: "रेफरल कोड (वैकल्पिक)",
        mobileNumber: "मोबाइल नंबर",
        continue: "जारी रखें",
        pleaseWait: "कृपया प्रतीक्षा करें...",
        newUser: "नए उपयोगकर्ता? खाता बनाएं",
        alreadyAccount: "पहले से ही खाता है? लॉगिन करें",
        verifyOtp: "ओटीपी सत्यापित करें",
        sentTo: "भेजा गया",
        verifyProceed: "सत्यापित करें और आगे बढ़ें",
        verifying: "सत्यापित किया जा रहा है...",
        resendIn: "कोड पुनः भेजें",
        resendCode: "कोड पुनः भेजें",
        agreeText: "जारी रखकर, आप हमारी शर्तों से सहमत होते हैं",
        terms: "नियम और शर्तें",
        privacy: "गोपनीयता नीति",
        enterValidPhone: "सटीक 10-अंकीय नंबर दर्ज करें",
        enterFullName: "कृपया अपना पूरा नाम दर्ज करें",
        otpSent: "ओटीपी भेजा गया!",
        loggedInSuccess: "सफलतापूर्वक लॉगिन किया गया!",
        invalidOtp: "अमान्य ओटीपी",

        // Profile Page
        myProfile: "मेरी प्रोफाइल",
        personalAccount: "व्यक्तिगत खाता",
        myCart: "मेरा कार्ट",
        viewAdded: "अपने जोड़े गए उत्पाद देखें",
        yourOrders: "आपके आदेश",
        trackReturn: "ट्रैक करें, वापस करें या दोबारा खरीदें",
        transactions: "आदेश लेनदेन",
        viewPayments: "सभी भुगतान और धनवापसी देखें",
        wallet: "वॉलेट",
        balanceRefunds: "शेष राशि और वापसी रिफंड देखें",
        wishlist: "आपकी विशलिस्ट",
        savedItems: "आपके सहेजे गए उत्पाद",
        savedAddresses: "सहेजे गए पते",
        manageLocations: "अपने वितरण स्थानों को प्रबंधित करें",
        helpSettings: "सहायता और सेटिंग्स",
        helpSupport: "सहायता और समर्थन",
        aboutUs: "हमारे बारे में",
        signOut: "साइन आउट",
        version: "संस्करण",
        signOutTitle: "साइन आउट करें?",
        signOutConfirm: "क्या आप सुनिश्चित हैं कि आप अपने खाते से साइन आउट करना चाहते हैं? अपने आदेशों तक पहुँचने के लिए आपको फिर से लॉगिन करना होगा।",
        cancel: "रद्द करें",
        yesSignOut: "हाँ, साइन आउट करें",
        selectLanguage: "भाषा चुनें",
        languageDesc: "अपनी पसंदीदा भाषा चुनें",
        english: "English",
        hindi: "हिन्दी (Hindi)"
    }
};

const GlobalDomTranslator = ({ language }) => {
    useEffect(() => {
        let isCurrent = true;

        const path = window.location.pathname.toLowerCase();
        const isAdminOrStaff = path.startsWith('/admin') || path.startsWith('/seller') || path.startsWith('/delivery') || path.startsWith('/warehouse');

        if (language === 'en' || isAdminOrStaff) {
            const revertNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    if (node['_originalText'] !== undefined && node.nodeValue !== node['_originalText']) {
                        node.nodeValue = node['_originalText'];
                    }
                    node['_lastTranslatedValue'] = undefined;
                } else if (node.nodeType === Node.ELEMENT_NODE) {
                    const tagName = node.tagName.toLowerCase();
                    if (!['script', 'style', 'textarea', 'iframe', 'noscript'].includes(tagName)) {
                        if (node['_originalPlaceholder']) {
                            node.setAttribute('placeholder', node['_originalPlaceholder']);
                        }
                        Array.from(node.childNodes).forEach(revertNode);
                    }
                }
            };
            revertNode(document.body);
            return () => {
                isCurrent = false;
            };
        }

        const translateNode = async (node) => {
            if (!isCurrent) return;
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                if (['script', 'style', 'textarea', 'iframe', 'noscript'].includes(tagName)) {
                    return;
                }
                const placeholder = node.getAttribute('placeholder');
                if (placeholder && placeholder.trim()) {
                    const cleanPlaceholder = placeholder.trim();
                    if (cleanPlaceholder.length >= 2 && !/^[0-9\s\p{P}]+$/u.test(cleanPlaceholder)) {
                        if (!node['_originalPlaceholder']) {
                            node['_originalPlaceholder'] = placeholder;
                        }
                        try {
                            const translated = await translateText(node['_originalPlaceholder'], language, 'en');
                            if (!isCurrent) return;
                            if (translated) node.setAttribute('placeholder', translated);
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
                // Recursively translate child nodes
                for (const child of Array.from(node.childNodes)) {
                    if (!isCurrent) return;
                    await translateNode(child);
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                const text = node.nodeValue.trim();
                if (!text || text.length < 2 || /^[0-9\s\p{P}]+$/u.test(text)) {
                    return;
                }
                if (node['_originalText'] === undefined) {
                    node['_originalText'] = node.nodeValue;
                }
                try {
                    const translated = await translateText(node['_originalText'], language, 'en');
                    if (!isCurrent) return;
                    if (translated && translated !== node.nodeValue) {
                        node['_lastTranslatedValue'] = translated;
                        node.nodeValue = translated;
                    }
                } catch (err) {
                    console.error('Failed to translate text node:', err);
                }
            }
        };

        translateNode(document.body);

        const observer = new MutationObserver(async (mutations) => {
            if (!isCurrent) return;
            for (const mutation of mutations) {
                if (!isCurrent) return;
                for (const addedNode of Array.from(mutation.addedNodes)) {
                    if (!isCurrent) return;
                    await translateNode(addedNode);
                }
                if (mutation.type === 'characterData') {
                    const node = mutation.target;
                    if (node.nodeType === Node.TEXT_NODE) {
                        if (node.nodeValue === node['_lastTranslatedValue']) {
                            continue;
                        }
                        const text = node.nodeValue.trim();
                        if (!text || text.length < 2 || /^[0-9\s\p{P}]+$/u.test(text)) {
                            continue;
                        }
                        node['_originalText'] = node.nodeValue;
                        try {
                            const translated = await translateText(node['_originalText'], language, 'en');
                            if (!isCurrent) return;
                            node['_lastTranslatedValue'] = translated;
                            node.nodeValue = translated;
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        return () => {
            isCurrent = false;
            observer.disconnect();
        };
    }, [language]);

    return null;
};

export const LanguageProvider = ({ children }) => {
    const [language, setLanguageState] = useState(() => {
        return localStorage.getItem('language') || 'en';
    });
    const [isChangingLanguage, setIsChangingLanguage] = useState(false);

    const changeLanguage = (langCode) => {
        setIsChangingLanguage(true);
        setLanguageState(langCode);
        localStorage.setItem('language', langCode);
        setIsChangingLanguage(false);
    };

    const setLanguage = changeLanguage;

    useEffect(() => {
        const rtlLanguages = ['ar', 'he', 'ur', 'fa'];
        if (rtlLanguages.includes(language)) {
            document.dir = 'rtl';
        } else {
            document.dir = 'ltr';
        }
    }, [language]);

    const t = (key) => {
        return translations[language]?.[key] || translations['en']?.[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ 
            language, 
            setLanguage, 
            changeLanguage, 
            isChangingLanguage, 
            languages, 
            t 
        }}>
            <GlobalDomTranslator language={language} />
            {children}
        </LanguageContext.Provider>
    );
};

export const useTranslation = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useTranslation must be used within a LanguageProvider');
    }
    return context;
};
