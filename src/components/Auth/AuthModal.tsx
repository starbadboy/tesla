import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import { X, Mail, Lock, User as UserIcon, Loader } from 'lucide-react';
import { Button } from '../ui/Button';

interface AuthModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultTab?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login' }) => {
    const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const endpoint = activeTab === 'login' ? '/api/auth/login' : '/api/auth/register';
            const payload = activeTab === 'login'
                ? { emailOrUsername: formData.email, password: formData.password } // For login, email input can be username
                : formData;

            const res = await axios.post(endpoint, payload);

            login(res.data.token, res.data.user);
            onClose();
        } catch (err: unknown) {
            if (axios.isAxiosError(err)) {
                setError(err.response?.data?.error || 'An error occurred. Please try again.');
            } else {
                setError('An error occurred. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-transparent dark:border-zinc-800">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b dark:border-zinc-800">
                    <h2 className="font-serif text-xl font-bold dark:text-white">
                        {activeTab === 'login' ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full transition-colors text-black dark:text-white">
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-zinc-800">
                    <button
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'login' ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400'}`}
                        onClick={() => setActiveTab('login')}
                    >
                        Login
                    </button>
                    <button
                        className={`flex-1 py-3 text-sm font-bold uppercase tracking-wider transition-colors ${activeTab === 'register' ? 'bg-black text-white dark:bg-white dark:text-black' : 'hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400'}`}
                        onClick={() => setActiveTab('register')}
                    >
                        Register
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded border border-red-100 dark:border-red-900/30">
                            {error}
                        </div>
                    )}

                    {activeTab === 'register' && (
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Username</label>
                            <div className="relative">
                                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                <input
                                    type="text"
                                    name="username"
                                    required
                                    className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all dark:bg-zinc-950 dark:border-zinc-800 dark:text-white dark:focus:ring-white dark:focus:border-white"
                                    placeholder="Choose a username"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">
                            {activeTab === 'login' ? 'Email or Username' : 'Email'}
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                name="email" // using 'email' state for both email/username in login
                                required
                                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all dark:bg-zinc-950 dark:border-zinc-800 dark:text-white dark:focus:ring-white dark:focus:border-white"
                                placeholder={activeTab === 'login' ? "Enter email or username" : "Enter your email"}
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-bold uppercase text-gray-500 dark:text-zinc-400">Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="password"
                                name="password"
                                required
                                className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none transition-all dark:bg-zinc-950 dark:border-zinc-800 dark:text-white dark:focus:ring-white dark:focus:border-white"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                            />
                        </div>
                    </div>

                    <Button fullWidth disabled={loading} size="lg" className="mt-2 dark:bg-white dark:text-black dark:hover:bg-zinc-200">
                        {loading ? <Loader className="animate-spin" /> : (activeTab === 'login' ? 'Sign In' : 'Create Account')}
                    </Button>
                </form>
            </div>
        </div>
    );
};
