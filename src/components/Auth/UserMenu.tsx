import React, { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthModal } from './AuthModal';
import { RESET_TOKEN } from '../../utils/resetLink';
import { LogOut, Car, ChevronDown, ChevronRight, Sparkles, User as UserIcon } from 'lucide-react';
import { TRANSLATIONS } from '../../translations';
import '../../styles/user-menu.css';

interface UserMenuProps {
    onOpenGarage: () => void;
    language?: 'en' | 'zh';
}

export const UserMenu: React.FC<UserMenuProps> = ({ onOpenGarage, language = 'en' }) => {
    const t = TRANSLATIONS[language];
    const { user, logout, isAuthenticated } = useAuth();
    // A reset link opens the dialog straight away, on its reset view.
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(() => Boolean(RESET_TOKEN));
    const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const initialFocusRef = useRef<'first' | 'last'>('first');
    const menuId = useId();
    const initial = user?.username?.trim().charAt(0).toUpperCase() || '?';

    useEffect(() => {
        if (!isOpen) return;
        const items = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
        const index = initialFocusRef.current === 'last' ? (items?.length ?? 1) - 1 : 0;
        items?.[index]?.focus();

        const handleOutsideInteraction = (event: Event) => {
            if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('pointerdown', handleOutsideInteraction);
        document.addEventListener('focusin', handleOutsideInteraction);
        return () => {
            document.removeEventListener('pointerdown', handleOutsideInteraction);
            document.removeEventListener('focusin', handleOutsideInteraction);
        };
    }, [isOpen]);

    const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (!isOpen) return;
        if (event.key === 'Escape' || event.key === 'Tab') {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
            }
            setIsOpen(false);
            triggerRef.current?.focus();
            return;
        }

        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);
        if (!items.length) return;
        const current = items.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0
            : event.key === 'End' ? items.length - 1
                : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next].focus();
    };

    const handleOpenAuth = (tab: 'login' | 'register') => {
        setAuthTab(tab);
        setIsAuthModalOpen(true);
        setIsOpen(false);
    };

    return (
        <div
            ref={rootRef}
            className="account-menu"
            onKeyDown={handleMenuKeyDown}
        >
            {isAuthenticated && user ? (
                <>
                    <button
                        ref={triggerRef}
                        type="button"
                        onClick={() => {
                            initialFocusRef.current = 'first';
                            setIsOpen(open => !open);
                        }}
                        onKeyDown={event => {
                            if (!isOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                                event.preventDefault();
                                initialFocusRef.current = event.key === 'ArrowUp' ? 'last' : 'first';
                                setIsOpen(true);
                            }
                        }}
                        aria-label={t.accountMenu}
                        aria-expanded={isOpen}
                        aria-haspopup="menu"
                        aria-controls={isOpen ? menuId : undefined}
                        className="account-menu__trigger"
                    >
                        <span className="account-menu__avatar" aria-hidden="true">{initial}</span>
                        <ChevronDown className="account-menu__caret" size={12} aria-hidden="true" />
                    </button>

                    {isOpen && (
                        <div className="account-menu__panel">
                            <div className="account-menu__identity">
                                <span className="account-menu__avatar account-menu__avatar--large" aria-hidden="true">{initial}</span>
                                <div className="account-menu__details">
                                    <p className="account-menu__name" title={user.username}>{user.username}</p>
                                    <p className="account-menu__email" title={user.email}>{user.email}</p>
                                </div>
                            </div>

                            <div className="account-menu__balance">
                                <span className="account-menu__balance-label">
                                    <Sparkles size={16} aria-hidden="true" />
                                    {t.balance}
                                </span>
                                <span className="account-menu__balance-value">
                                    <strong>{(user.credits ?? 0).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')}</strong>
                                    <span>{t.credits}</span>
                                </span>
                            </div>

                            <div id={menuId} role="menu" aria-label={t.accountMenu} className="account-menu__actions">
                                <button
                                    type="button"
                                    role="menuitem"
                                    tabIndex={-1}
                                    onClick={() => { onOpenGarage(); setIsOpen(false); }}
                                    className="account-menu__item"
                                >
                                    <Car size={18} aria-hidden="true" />
                                    <span>{t.myGarage}</span>
                                    <ChevronRight size={15} className="account-menu__arrow" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    role="menuitem"
                                    tabIndex={-1}
                                    onClick={() => { setIsOpen(false); logout(); }}
                                    className="account-menu__item account-menu__item--logout"
                                >
                                    <LogOut size={18} aria-hidden="true" />
                                    <span>{t.logout}</span>
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <button
                    type="button"
                    aria-label={t.login}
                    onClick={() => handleOpenAuth('login')}
                    className="account-menu__trigger account-menu__trigger--guest"
                >
                    <span className="account-menu__avatar" aria-hidden="true"><UserIcon size={18} /></span>
                </button>
            )}

            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                defaultTab={authTab}
            />
        </div>
    );
};
