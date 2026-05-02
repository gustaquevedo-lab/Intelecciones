import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
    id: number;
    username: string;
    role: 'SUPERUSUARIO' | 'JEFE_CAMPANA' | 'COORDINADOR';
    nombre: string;
    party?: string;
    assigned_list_id?: number;
    photo_url?: string;
    enabled_modules?: string[];
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    activeListId: number | null; // NULL means "GLOBAL VIEW" for SuperAdmin
    setActiveListId: (id: number | null) => void;
    login: (credentials: any) => Promise<User>;
    logout: () => void;
    updateUser: (newData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeListId, setActiveListId] = useState<number | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('auth_user');
        const savedListId = localStorage.getItem('active_list_id');
        if (savedUser) {
            let parsed = JSON.parse(savedUser);
            // Legacy mapping
            if (parsed.role === 'SUPER_ADMIN') parsed.role = 'SUPERUSUARIO';
            if (parsed.role === 'COORDINATOR') parsed.role = 'COORDINADOR';
            if (parsed.role === 'CANDIDATE') parsed.role = 'JEFE_CAMPANA';
            
            setUser(parsed);
            
            // For non-superadmins, force their assigned_list_id
            if (parsed.role !== 'SUPERUSUARIO') {
                setActiveListId(parsed.assigned_list_id);
            } else if (savedListId) {
                setActiveListId(savedListId === 'null' ? null : parseInt(savedListId));
            }
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (activeListId !== undefined) {
            localStorage.setItem('active_list_id', activeListId === null ? 'null' : activeListId.toString());
        }
    }, [activeListId]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('auth_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('auth_user');
        }
    }, [user]);

    const login = async (credentials: any) => {
        const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setUser(data);
        localStorage.setItem('auth_user', JSON.stringify(data)); // Force immediate update
        return data;
    };

    const logout = () => {
        setUser(null);
        window.location.href = '/login';
    };

    const updateUser = (newData: Partial<User>) => {
        setUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, ...newData };
            localStorage.setItem('auth_user', JSON.stringify(updated));
            return updated;
        });
    };

    return (
        <AuthContext.Provider value={{ user, loading, activeListId, setActiveListId, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

// Global Fetch Interceptor (Helper)
export const apiFetch = (url: string, options: any = {}) => {
    const userStr = localStorage.getItem('auth_user');
    const activeListId = localStorage.getItem('active_list_id');
    const user = userStr ? JSON.parse(userStr) : null;
    
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'x-list-id': activeListId === 'null' ? '' : (activeListId || user?.assigned_list_id?.toString() || ''),
        'x-user-role': user?.role || ''
    };

    return fetch(url, { ...options, headers });
};
