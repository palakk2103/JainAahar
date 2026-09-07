import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import { toast } from 'sonner';
import { adminApi } from '../services/adminApi';
import { Loader2 } from 'lucide-react';

const AdminAuth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();
    const { settings } = useSettings();
    const navigate = useNavigate();
    
    // Attempt to use a configured logo, otherwise fallback to the hardcoded default
    const logoUrl = settings?.logoUrl || '/jainaaharlogo-removebg-preview.png';

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Only validate password complexity for signup, not login
        if (!isLogin) {
            const pwd = (formData.password || '').trim();
            if (pwd.length < 10) {
                toast.error('Password must be at least 10 characters long.');
                setIsLoading(false);
                return;
            }
            if (!/[a-z]/.test(pwd)) {
                toast.error('Password must contain at least one lowercase letter.');
                setIsLoading(false);
                return;
            }
            if (!/[A-Z]/.test(pwd)) {
                toast.error('Password must contain at least one uppercase letter.');
                setIsLoading(false);
                return;
            }
            if (!/[0-9]/.test(pwd)) {
                toast.error('Password must contain at least one number.');
                setIsLoading(false);
                return;
            }
        }

        try {
            const response = isLogin
                ? await adminApi.login({ email: formData.email, password: formData.password })
                : await adminApi.signup({ name: formData.name, email: formData.email, password: formData.password });

            const { token, admin } = response.data.result;

            const authData = {
                ...admin,
                token,
                role: 'admin'
            };

            login(authData);

            toast.success(isLogin ? 'Welcome back, Administrator.' : 'Administrator Account Created.');
            navigate('/admin');
        } catch (error) {
            console.error('Login error:', error);
            toast.error(error.response?.data?.message || 'Authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-8">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center justify-center">
                    <img 
                        src={logoUrl}
                        alt="Admin Portal Logo" 
                        className="h-32 w-auto object-contain" 
                    />
                </div>
                
                <div className="text-left">
                    <h2 className="text-2xl font-bold text-gray-900">
                        {isLogin ? 'Admin Login' : 'Admin Signup'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                        {isLogin ? 'Enter your details to manage the platform' : 'Create an administrator account'}
                    </p>
                </div>

                <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                    <div className="space-y-4">
                        {!isLogin && (
                            <div>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    maxLength={50}
                                    pattern="[a-zA-Z\s]*"
                                    value={formData.name}
                                    onChange={(e) => {
                                        e.target.value = e.target.value.replace(/[^a-zA-Z\s]/g, '');
                                        handleChange(e);
                                    }}
                                    placeholder="Full Name"
                                    className="block w-full rounded-lg border border-gray-200 px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                                />
                            </div>
                        )}
                        <div>
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Email address"
                                className="block w-full rounded-lg border border-gray-200 px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                            />
                        </div>
                        <div>
                            <input
                                type="password"
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder={isLogin ? "Password" : "Password (min 10 chars, uppercase, lowercase, number)"}
                                className="block w-full rounded-lg border border-gray-200 px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 sm:text-sm"
                            />
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex w-full items-center justify-center rounded-xl bg-[#f97316] px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 disabled:opacity-70"
                        >
                            {isLoading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <span>{isLogin ? 'Login' : 'Create Account'}</span>
                            )}
                        </button>
                    </div>

                    <div className="mt-6 text-center space-y-2">
                        <p className="text-sm text-gray-600">
                            {isLogin ? "Don't have an account? " : "Already have an account? "}
                            <span 
                                className="cursor-pointer font-medium text-[#f97316] hover:text-orange-600" 
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setFormData({ email: '', password: '', name: '' });
                                }}
                            >
                                {isLogin ? 'Sign up' : 'Login'}
                            </span>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminAuth;
