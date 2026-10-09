import React from 'react';
import { Shield, ChevronLeft, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '@core/context/SettingsContext';
import ContactDetailCard from '../components/shared/ContactDetailCard';

const PrivacyPage = () => {
    const navigate = useNavigate();
    const { settings } = useSettings();
    const appName = settings?.appName || 'Aahar Jain';

    return (
        <div className="min-h-screen bg-slate-50 font-['Outfit',_sans-serif] pb-24">
            {/* Header */}
            <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md px-4 py-3.5 border-b border-slate-100 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors -ml-1 text-slate-800 cursor-pointer"
                        aria-label="Back"
                    >
                        <ChevronLeft size={22} />
                    </button>
                    <div>
                        <h1 className="text-lg font-black text-slate-900 leading-tight">Privacy Policy</h1>
                        <p className="text-[11px] text-slate-500 font-medium">Customer data & privacy handling</p>
                    </div>
                </div>
            </div>

            <div className="px-4 pt-5 max-w-3xl mx-auto space-y-5">
                {/* Hero Card */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-2xl bg-brand-50 border border-brand-100 flex items-center justify-center text-primary shadow-2xs shrink-0">
                            <Shield size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-900">{appName} Privacy Policy</h2>
                            <p className="text-xs text-slate-500 font-semibold mt-0.5">Last updated: August 2026</p>
                        </div>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        At <strong className="text-slate-800">{appName}</strong>, we are committed to protecting your privacy and ensuring transparency in how we handle your personal information. This Privacy Policy outlines our data collection, usage, protection practices, and your rights.
                    </p>
                </div>

                {/* Grievance & Privacy Contact Officer Card */}
                <ContactDetailCard title="Grievance & Privacy Officer" />

                {/* Policy Clauses */}
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-brand-100 text-primary text-xs font-black flex items-center justify-center">1</span>
                            Information We Collect
                        </h3>
                        <p className="text-slate-600 text-sm leading-relaxed mb-2">
                            We collect personal information that you provide when registering, updating your profile, placing orders, or communicating with us. This includes:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 pl-2">
                            <li><strong className="text-slate-700">Account Details:</strong> Name, mobile phone number, email address.</li>
                            <li><strong className="text-slate-700">Delivery Information:</strong> Delivery address, GPS coordinates, saved landmarks.</li>
                            <li><strong className="text-slate-700">Transactional Data:</strong> Order history, payment status, transaction identifiers.</li>
                        </ul>
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-brand-100 text-primary text-xs font-black flex items-center justify-center">2</span>
                            How We Use Your Information
                        </h3>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            We use your data to process and fulfill your orders, provide real-time delivery updates, communicate customer service support, maintain account security, and enhance our service offerings.
                        </p>
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-brand-100 text-primary text-xs font-black flex items-center justify-center">3</span>
                            Data Security & Retention
                        </h3>
                        <p className="text-slate-600 text-sm leading-relaxed">
                            We adopt strict security standards and encrypted transmission to protect your personal information against unauthorized access, loss, or misuse.
                        </p>
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <h3 className="text-base font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-brand-100 text-primary text-xs font-black flex items-center justify-center">4</span>
                            Account Deletion & Data Rights
                        </h3>
                        <p className="text-slate-600 text-sm leading-relaxed mb-3">
                            You have full rights over your data. You can request the deletion of your account and associated personal data at any time by contacting our support team at <a href="mailto:aaharjain@gmail.com" className="text-primary font-bold hover:underline">aaharjain@gmail.com</a>.
                        </p>
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex items-start gap-3">
                            <CheckCircle2 size={20} className="text-primary shrink-0 mt-0.5" />
                            <div className="text-xs text-slate-600 leading-relaxed">
                                <span className="font-bold text-slate-800">Data Deletion Assistance:</span> Contact our support team to request permanent deletion of your profile, active cart, and personal records.
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white rounded-2xl border border-slate-100 text-sm text-slate-600">
                    <span>Have questions about our privacy policies?</span>
                    <Link to="/support" className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline">
                        Visit Support Page <ArrowRight size={16} />
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;


