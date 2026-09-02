import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { X, Mail, Lock, User as UserIcon, Loader } from 'lucide-react';
import { Button } from '../ui/Button';
import { RESET_TOKEN } from '../../utils/resetLink';

const INPUT = 'w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all dark:bg-zinc-950 dark:border-zinc-800 dark:text-white dark:focus:ring-white dark:focus:border-white';
const LABEL = 'text-xs font-bold uppercase text-gray-500 dark:text-zinc-400';
const LINK = 'text-xs text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white underline';

type View = 'login' | 'register' | 'forgot' | 'forgot-sent' | 'reset' | 'reset-invalid';

const TITLES: Record<View, string> = {
    login: 'Welcome Back',
    register: 'Create Account',
    forgot: 'Reset Password',
    'forgot-sent': 'Reset Password',
    reset: 'Set New Password',
    'reset-invalid': 'Set New Password',
};

/** What the one button at the bottom says on each view; the two -sent/-invalid views navigate instead of submitting. */
const SUBMIT: Record<View, string> = {
    login: 'Sign In',
    register: 'Create Account',
    forgot: 'Send reset link',
    'forgot-sent': 'Back to login',
    reset: 'Set new password',
    'reset-invalid': 'Request a new link',
};
const NAVIGATE: Partial<Record<View, View>> = { 'forgot-sent': 'login', 'reset-invalid': 'forgot' };
const BUTTON = 'mt-2 dark:bg-white dark:text-black dark:hover:bg-zinc-200';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTab?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login' }) => {
    const [activeTab, setActiveTab] = useState<View>(RESET_TOKEN ? 'reset' : defaultTab);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirm: '',
    });
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    // The token stays valid for an hour, but it does not belong in the address bar.
    useEffect(() => {
        if (!RESET_TOKEN) return;
        const params = new URLSearchParams(window.location.search);
        if (!params.has('reset')) return;
        params.delete('reset');
        const rest = params.toString();
        window.history.replaceState({}, '', window.location.pathname + (rest ? `?${rest}` : ''));
    }, []);

    if (!isOpen) return null;

    const switchTo = (view: View) => {
        setActiveTab(view);
        setError('');
        setNotice('');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (activeTab === 'forgot') {
                const res = await axios.post('/api/auth/forgot', { email: formData.email });
                setNotice(res.data.message);
                setActiveTab('forgot-sent');
                return;
            }
            if (activeTab === 'reset') {
                if (formData.password.length < 8) { setError('Password must be at least 8 characters'); return; }
                if (formData.password !== formData.confirm) { setError('The two passwords do not match'); return; }
                const res = await axios.post('/api/auth/reset', { token: RESET_TOKEN, password: formData.password });
                login(res.data.token, res.data.user);
                onClose();
                return;
            }
            const endpoint = activeTab === 'login' ? '/api/auth/login' : '/api/auth/register';
            const payload = activeTab === 'login'
                ? { emailOrUsername: formData.email, password: formData.password } // For login, email input can be username
                : { username: formData.username, email: formData.email, password: formData.password };

            const res = await axios.post(endpoint, payload);

            login(res.data.token, res.data.user);
            onClose();
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                if (err.response?.data?.code === 'RESET_INVALID') {
                    setNotice('This reset link is no longer valid. Request a new one below.');
                    setActiveTab('reset-invalid');
                } else {
                    setError(err.response?.data?.error || 'An error occurred. Please try again.');
                }
            } else {
                setError('An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const hasTabs = activeTab === 'login' || activeTab === 'register';
    const next = NAVIGATE[activeTab];

    // Portalled to the document root: the studio and gallery shells reset padding
    // and margin on every descendant, which would flatten this Tailwind layout.
    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-transparent dark:border-zinc-800">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-zinc-800">
                    <h2 className="font-serif text-xl font-bold dark:text-white">
                        {TITLES[activeTab]}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-black dark:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                {hasTabs && <div className="flex border-b dark:border-zinc-800">
                    <button
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'login' ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400'}`}
                        onClick={() => switchTo('login')}
                    >
                        Login
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'register' ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400'}`}
                        onClick={() => switchTo('register')}
                    >
                        Register
                    </button>
                </div>}

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded border border-red-100 dark:border-red-900/30">
                            {error}
                        </div>
                    )}
                    {notice && (
                        <div className="p-3 bg-gray-50 dark:bg-zinc-800 text-gray-700 dark:text-zinc-200 text-sm rounded border border-gray-100 dark:border-zinc-700">
                            {notice}
                        </div>
                    )}

                    {activeTab === 'register' && (
                        <div className="space-y-1">
                            <label className={LABEL}>Username</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    name="username"
                                    required
                                    className={INPUT}
                                    placeholder="Choose a username"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    {(hasTabs || activeTab === 'forgot') && (
                        <div className="space-y-1">
                            <label className={LABEL}>
                                {activeTab === 'login' ? 'Email or Username' : 'Email'}
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type={activeTab === 'forgot' ? 'email' : 'text'}
                                    name="email" // using 'email' state for both email/username in login
                                    required
                                    className={INPUT}
                                    placeholder={activeTab === 'login' ? "Enter email or username" : "Enter your email"}
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    {(hasTabs || activeTab === 'reset') && (
                        <div className="space-y-1">
                            <label className={LABEL}>{activeTab === 'reset' ? 'New Password' : 'Password'}</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={activeTab === 'reset' ? 8 : undefined}
                                    className={INPUT}
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={handleChange}
                                />
                            </div>
                            {activeTab === 'login' && (
                                <div className="text-right">
                                    <button type="button" className={LINK} onClick={() => switchTo('forgot')}>Forgot password?</button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'reset' && (
                        <div className="space-y-1">
                            <label className={LABEL}>Confirm Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="password"
                                    name="confirm"
                                    required
                                    minLength={8}
                                    className={INPUT}
                                    placeholder="••••••••"
                                    value={formData.confirm}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'forgot' && (
                        <p className="text-xs text-gray-500 dark:text-zinc-400">Enter the email on your account and we will send a link to choose a new password.</p>
                    )}

                    {next ? (
                        <Button type="button" fullWidth size="lg" className={BUTTON} onClick={() => switchTo(next)}>
                            {SUBMIT[activeTab]}
                        </Button>
                    ) : (
                        <Button fullWidth disabled={loading} size="lg" className={BUTTON}>
                            {loading ? <Loader className="animate-spin" /> : SUBMIT[activeTab]}
                        </Button>
                    )}

                    {(activeTab === 'forgot' || activeTab === 'reset') && (
                        <div className="text-center">
                            <button type="button" className={LINK} onClick={() => switchTo('login')}>Back to login</button>
                        </div>
                    )}
                </form>
            </div>
        </div>,
        document.body,
    );
};
