import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { LogOut, Car, User as UserIcon } from 'lucide-react';
import { Button } from '../ui/Button';
import { TRANSLATIONS } from '../../translations';

interface UserMenuProps {
    onOpenGarage: () => void;
    language?: 'en' | 'zh';
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenGarage, language = 'en' }) => {
    const t = TRANSLATIONS[language];
    const { user, logout, isAuthenticated } = useAuth();
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
    const [isOpen, setIsOpen] = useState(false);

    const handleOpenAuth = (tab: 'login' | 'register') => {
        setAuthTab(tab);
        setIsAuthModalOpen(true);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            {isAuthenticated && user ? (
                <>
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs hover:scale-105 transition-transform"
                    >
                        {user.username?.charAt(0).toUpperCase() || '?'}
                    </button>

                    {isOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                            <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-3 py-2 border-b border-gray-100 mb-1">
                                    <p className="font-bold text-xs truncate">{user.username}</p>
                                    <p className="text-[10px] text-gray-400 truncate">{user.email}</p>
                                </div>
                                <button
                                    onClick={() => { onOpenGarage(); setIsOpen(false); }}
                                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded mb-1"
                                >
                                    <Car size={14} /> {t.myGarage}
                                </button>
                                <button
                                    onClick={() => { logout(); setIsOpen(false); }}
                                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
                                >
                                    <LogOut size={14} /> {t.logout}
                                </button>
                            </div>
                        </>
                    )}
                </>
            ) : (
                <>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenAuth('login')}
                        className="h-8 w-8 p-0 rounded-full bg-gray-100 hover:bg-gray-200"
                    >
                        <UserIcon size={16} />
                    </Button>
                </>
            )}

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                defaultTab={authTab}
            />
        </div>
    );
};
