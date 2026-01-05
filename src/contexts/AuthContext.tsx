/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface User {
    id: string;
    username: string;
    email: string;
    isAdmin?: boolean;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (token: string, user: User) => void;
    logout: () => void;
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

    useEffect(() => {
        const checkAuth = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                try {
                    // Normalize URL: ensure no double slashes if running locally/production
                    // Assuming relative path /api usually works if proxied, or use window.location.origin
                    // Using '/api/auth/me' directly
                    const res = await axios.get('/api/auth/me', {
                        headers: { Authorization: `Bearer ${storedToken}` }
                    });
                    // /me endpoint returns the user object directly
                    setUser(res.data);
                    setToken(storedToken);
                } catch (err) {
                    console.error("Auth check failed:", err);
                    logout();
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem('token', newToken);
        setToken(newToken);
        setUser(newUser);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!user }}>
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
