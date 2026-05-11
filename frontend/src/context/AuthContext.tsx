import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
    id: number;
    username: string;
    role: 'SUPERUSUARIO' | 'JEFE_CAMPANA' | 'PADRINO' | 'COORDINADOR' | 'CANDIDATO' | 'MIEMBRO_DE_MESA';
    nombre: string;
    party?: string;
    assigned_list_id?: number;
    assigned_campaign_id?: number;
    photo_url?: string;
    enabled_modules?: string[];
    distrito?: string;
    ci?: string;
    telefono?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    activeListId: number | null; // NULL means "GLOBAL VIEW" for SuperAdmin
    activeDistrict: string | null;
    setActiveListId: (id: number | null) => void;
    setActiveDistrict: (district: string | null) => void;
    login: (credentials: any) => Promise<User>;
    logout: () => void;
    updateUser: (newData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeListId, setActiveListId] = useState<number | null>(null);
    const [activeDistrict, setActiveDistrict] = useState<string | null>(null);

    useEffect(() => {
        const savedUser = localStorage.getItem('auth_user');
        const savedListId = localStorage.getItem('active_list_id');
        const savedDistrict = localStorage.getItem('active_district');

        if (savedUser) {
            let parsed: User;
            try { parsed = JSON.parse(savedUser); } catch { localStorage.removeItem('auth_user'); setLoading(false); return; }

            // Legacy role mapping
            if ((parsed as any).role === 'SUPER_ADMIN') parsed.role = 'SUPERUSUARIO';
            if ((parsed as any).role === 'COORDINATOR') parsed.role = 'COORDINADOR';
            if ((parsed as any).role === 'CANDIDATE') parsed.role = 'JEFE_CAMPANA';

            // Set immediately from cache (instant UI)
            setUser(parsed);
            if (parsed.role !== 'SUPERUSUARIO') {
                setActiveListId(parsed.assigned_list_id ?? null);
            } else {
                if (savedListId) setActiveListId(savedListId === 'null' ? null : parseInt(savedListId));
                if (savedDistrict) setActiveDistrict(savedDistrict === 'null' ? null : savedDistrict);
            }

            // Background refresh — re-fetch user data from server to catch any changes
            api.get('/me').then(res => {
                const fresh: User = res.data;
                setUser(fresh);
                localStorage.setItem('auth_user', JSON.stringify(fresh));
                // Refresh list if it changed server-side
                if (fresh.role !== 'SUPERUSUARIO' && fresh.assigned_list_id !== parsed.assigned_list_id) {
                    setActiveListId(fresh.assigned_list_id ?? null);
                }
            }).catch(() => {
                // Server unavailable (cold start, offline) — keep cached user, don't logout
            });
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (activeListId !== undefined) {
            localStorage.setItem('active_list_id', activeListId === null ? 'null' : activeListId.toString());
        }
    }, [activeListId]);

    useEffect(() => {
        if (activeDistrict !== undefined) {
            localStorage.setItem('active_district', activeDistrict === null ? 'null' : activeDistrict);
        }
    }, [activeDistrict]);

    useEffect(() => {
        if (user) {
            localStorage.setItem('auth_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('auth_user');
        }
    }, [user]);

    const login = async (credentials: any) => {
        const { data } = await api.post('/login', credentials);
        setUser(data);
        localStorage.setItem('auth_user', JSON.stringify(data));
        
        // Clear global filters on SuperAdmin login to ensure visibility
        if (data.role === 'SUPERUSUARIO') {
            setActiveListId(null);
            setActiveDistrict(null);
            localStorage.setItem('active_list_id', 'null');
            localStorage.setItem('active_district', 'null');
        }
        
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
        <AuthContext.Provider value={{ user, loading, activeListId, setActiveListId, activeDistrict, setActiveDistrict, login, logout, updateUser }}>
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
    const activeDistrict = localStorage.getItem('active_district');
    const user = userStr ? JSON.parse(userStr) : null;
    
    const headers = {
        ...options.headers,
        'Content-Type': 'application/json',
        'x-list-id': activeListId === 'null' ? '' : (activeListId || user?.assigned_list_id?.toString() || ''),
        'x-user-role': user?.role || '',
        'x-district': activeDistrict === 'null' ? '' : (activeDistrict || '')
    };

    return fetch(url, { ...options, headers });
};
