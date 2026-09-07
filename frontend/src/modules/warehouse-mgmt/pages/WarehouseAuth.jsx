import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { toast } from 'sonner';
import axiosInstance from '@core/api/axios';
import { Loader2, ArrowRight, ArrowLeft, Upload, FileText, CheckCircle2 } from 'lucide-react';

const WarehouseAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [signupStep, setSignupStep] = useState(1);
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();

    const logoUrl = settings?.logoUrl || '/jainaaharlogo-removebg-preview.png';

    // Form states
    const [loginData, setLoginData] = useState({
        emailOrPhone: '',
        password: '',
    });

    const [signupData, setSignupData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        warehouseName: '',
        category: 'General',
        description: '',
        address: '',
        locality: '',
        pincode: '',
        city: '',
        state: '',
    });

    // File upload states
    const [files, setFiles] = useState({
        tradeLicense: null,
        gstCertificate: null,
        idProof: null,
    });

    const handleLoginChange = (e) => {
        const { name, value } = e.target;
        setLoginData(prev => ({ ...prev, [name]: value }));
    };

    const handleSignupChange = (e) => {
        const { name, value } = e.target;
        setSignupData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e, fieldName) => {
        const file = e.target.files[0];
        if (file) {
            setFiles(prev => ({ ...prev, [fieldName]: file }));
            toast.success(`${file.name} selected!`);
        }
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await axiosInstance.post('/warehouse/login', {
                emailOrPhone: loginData.emailOrPhone,
                password: loginData.password
            });

            const { token, seller } = response.data.result;

            const authData = {
                ...seller,
                token,
                role: 'warehouse'
            };

            login(authData);

            toast.success('Welcome back, Warehouse Manager.');
            navigate('/warehouse/dashboard');
        } catch (error) {
            console.error('Warehouse login error:', error);
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignupSubmit = async (e) => {
        e.preventDefault();
        if (!files.tradeLicense || !files.gstCertificate || !files.idProof) {
            toast.error("Please upload all three required verification documents.");
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            
            // Append text fields
            Object.entries(signupData).forEach(([key, val]) => {
                formData.append(key, val);
            });

            // Append files
            if (files.tradeLicense) formData.append('tradeLicense', files.tradeLicense);
            if (files.gstCertificate) formData.append('gstCertificate', files.gstCertificate);
            if (files.idProof) formData.append('idProof', files.idProof);

            await axiosInstance.post('/warehouse/signup', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            toast.success('Warehouse registered successfully! You can now log in.');
            
            // Reset to login screen
            setIsLogin(true);
            setSignupStep(1);
            setSignupData({
                name: '',
                email: '',
                phone: '',
                password: '',
                warehouseName: '',
                category: 'General',
                description: '',
                address: '',
                locality: '',
                pincode: '',
                city: '',
                state: '',
            });
            setFiles({
                tradeLicense: null,
                gstCertificate: null,
                idProof: null,
            });
        } catch (error) {
            console.error('Warehouse registration error:', error);
            toast.error(error.response?.data?.message || 'Registration failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-8 font-['Outfit',_sans-serif]">
            <div className="w-full max-w-md space-y-6 bg-white p-6 rounded-3xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
                <div className="flex flex-col items-center justify-center">
                    <img 
                        src={logoUrl}
                        alt="Warehouse Portal Logo" 
                        className="h-28 w-auto object-contain" 
                    />
                </div>
                
                <div className="text-left">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {isLogin ? 'Warehouse Login' : 'Register Warehouse'}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {isLogin 
                          ? 'Enter your credentials to manage warehouse inventory and logistics.' 
                          : `Warehouse Onboarding (Step ${signupStep} of 3)`
                        }
                    </p>
                </div>

                {isLogin ? (
                    /* ────────── LOGIN FORM ────────── */
                    <form className="space-y-4" onSubmit={handleLoginSubmit}>
                        <div className="space-y-3">
                            <input
                                type="text"
                                name="emailOrPhone"
                                required
                                value={loginData.emailOrPhone}
                                onChange={handleLoginChange}
                                placeholder="Email address or Phone number"
                                className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                            />
                            <input
                                type="password"
                                name="password"
                                required
                                value={loginData.password}
                                onChange={handleLoginChange}
                                placeholder="Password"
                                className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex w-full items-center justify-center rounded-xl bg-[#f97316] px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-70 transition-all"
                        >
                            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Login</span>}
                        </button>
                    </form>
                ) : (
                    /* ────────── SIGNUP FORM ────────── */
                    <form className="space-y-4" onSubmit={handleSignupSubmit}>
                        
                        {/* Step 1: Personal / Contact details */}
                        {signupStep === 1 && (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={signupData.name}
                                    onChange={handleSignupChange}
                                    placeholder="Manager Full Name"
                                    className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                />
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={signupData.email}
                                    onChange={handleSignupChange}
                                    placeholder="Email Address"
                                    className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                />
                                <input
                                    type="tel"
                                    name="phone"
                                    required
                                    value={signupData.phone}
                                    onChange={handleSignupChange}
                                    placeholder="Mobile Number"
                                    className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                />
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    value={signupData.password}
                                    onChange={handleSignupChange}
                                    placeholder="Password"
                                    className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!signupData.name || !signupData.email || !signupData.phone || !signupData.password) {
                                            toast.error("Please fill out all fields.");
                                            return;
                                        }
                                        setSignupStep(2);
                                    }}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#f97316] py-3.5 text-sm font-semibold text-white hover:bg-orange-600 transition-all"
                                >
                                    Continue <ArrowRight size={16} />
                                </button>
                            </div>
                        )}

                        {/* Step 2: Warehouse Location details */}
                        {signupStep === 2 && (
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    name="warehouseName"
                                    required
                                    value={signupData.warehouseName}
                                    onChange={handleSignupChange}
                                    placeholder="Warehouse Name (e.g., Indore Hub)"
                                    className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                />
                                <input
                                    type="text"
                                    name="address"
                                    required
                                    value={signupData.address}
                                    onChange={handleSignupChange}
                                    placeholder="Full Address"
                                    className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        name="locality"
                                        value={signupData.locality}
                                        onChange={handleSignupChange}
                                        placeholder="Locality"
                                        className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                    />
                                    <input
                                        type="text"
                                        name="pincode"
                                        required
                                        value={signupData.pincode}
                                        onChange={handleSignupChange}
                                        placeholder="Pincode"
                                        className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input
                                        type="text"
                                        name="city"
                                        required
                                        value={signupData.city}
                                        onChange={handleSignupChange}
                                        placeholder="City (e.g., Indore)"
                                        className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                    />
                                    <input
                                        type="text"
                                        name="state"
                                        required
                                        value={signupData.state}
                                        onChange={handleSignupChange}
                                        placeholder="State"
                                        className="block w-full rounded-xl border border-gray-200 px-4 py-3.5 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setSignupStep(1)}
                                        className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-600 rounded-xl py-3.5 text-sm font-semibold hover:bg-gray-200 transition-all"
                                    >
                                        <ArrowLeft size={16} /> Back
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!signupData.warehouseName || !signupData.address || !signupData.pincode || !signupData.city || !signupData.state) {
                                                toast.error("Please fill out all required location fields.");
                                                return;
                                            }
                                            setSignupStep(3);
                                        }}
                                        className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl bg-[#f97316] text-sm font-semibold text-white hover:bg-orange-600 transition-all"
                                    >
                                        Next <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Documents upload */}
                        {signupStep === 3 && (
                            <div className="space-y-4">
                                <div className="space-y-3">
                                    {/* Trade License */}
                                    <div className="rounded-xl border border-dashed border-gray-200 p-3 bg-gray-50/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText size={18} className="text-gray-400" />
                                            <span className="text-xs font-bold text-gray-700">Trade License</span>
                                        </div>
                                        <label className="cursor-pointer text-[10px] font-black uppercase bg-[#f97316] text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 flex items-center gap-1">
                                            <Upload size={10} /> {files.tradeLicense ? 'Change' : 'Upload'}
                                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileChange(e, 'tradeLicense')} />
                                        </label>
                                    </div>
                                    {files.tradeLicense && <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> {files.tradeLicense.name}</p>}

                                    {/* GST Certificate */}
                                    <div className="rounded-xl border border-dashed border-gray-200 p-3 bg-gray-50/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText size={18} className="text-gray-400" />
                                            <span className="text-xs font-bold text-gray-700">GST Certificate</span>
                                        </div>
                                        <label className="cursor-pointer text-[10px] font-black uppercase bg-[#f97316] text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 flex items-center gap-1">
                                            <Upload size={10} /> {files.gstCertificate ? 'Change' : 'Upload'}
                                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileChange(e, 'gstCertificate')} />
                                        </label>
                                    </div>
                                    {files.gstCertificate && <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> {files.gstCertificate.name}</p>}

                                    {/* ID Proof */}
                                    <div className="rounded-xl border border-dashed border-gray-200 p-3 bg-gray-50/50 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText size={18} className="text-gray-400" />
                                            <span className="text-xs font-bold text-gray-700">Manager ID Proof</span>
                                        </div>
                                        <label className="cursor-pointer text-[10px] font-black uppercase bg-[#f97316] text-white px-3 py-1.5 rounded-lg hover:bg-orange-600 flex items-center gap-1">
                                            <Upload size={10} /> {files.idProof ? 'Change' : 'Upload'}
                                            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => handleFileChange(e, 'idProof')} />
                                        </label>
                                    </div>
                                    {files.idProof && <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1"><CheckCircle2 size={12}/> {files.idProof.name}</p>}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        disabled={isLoading}
                                        onClick={() => setSignupStep(2)}
                                        className="flex-1 flex items-center justify-center gap-1 bg-gray-100 text-gray-600 rounded-xl py-3.5 text-sm font-semibold hover:bg-gray-200 transition-all"
                                    >
                                        <ArrowLeft size={16} /> Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex-[2] flex items-center justify-center gap-1.5 rounded-xl bg-orange-500 py-3.5 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:opacity-75"
                                    >
                                        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Submit Onboarding</span>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </form>
                )}

                <div className="text-center pt-2 border-t border-gray-100">
                    <p className="text-sm text-gray-600">
                        {isLogin ? "Want to register a warehouse? " : "Already registered? "}
                        <span 
                            className="cursor-pointer font-bold text-[#f97316] hover:text-orange-600 transition-colors" 
                            onClick={() => {
                                setIsLogin(!isLogin);
                                setSignupStep(1);
                            }}
                        >
                            {isLogin ? 'Sign up' : 'Login'}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default WarehouseAuth;
