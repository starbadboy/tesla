/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
    id: string;
    username: string;
    email: string;
    isAdmin?: boolean;
    credits?: number;
    hasPurchased?: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
    /** Re-read the current user from the server, e.g. after a purchase or a generation. */
    refreshUser: () => Promise<void>;
    isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    function logout() {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
    }

    // /me answers { user: {...} }, unlike login/register which hand the user back bare.
    // Unwrapping here keeps the stored shape the same on both paths.
    const refreshUser = async () => {
        const storedToken = localStorage.getItem('token');
        if (!storedToken) return;
        try {
            const res = await axios.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${storedToken}` }
            });
            setUser(res.data.user ?? res.data);
            setToken(storedToken);
        } catch (err) {
            // Only a rejected token means signed out; a network blip or a 5xx keeps the cached user.
            if (axios.isAxiosError(err) && err.response?.status === 401) {
                logout();
            } else {
                console.error("Auth refresh failed:", err);
            }
        }
    };

    useEffect(() => {
        const checkAuth = async () => {
            await refreshUser();
            setLoading(false);
        };
        checkAuth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(newUser);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser, isAuthenticated: !!user }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
