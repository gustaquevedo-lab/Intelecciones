import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface User {
    id: number;
    username: string;
    role: 'SUPERUSUARIO' | 'JEFE_CAMPANA' | 'PADRINO' | 'COORDINADOR' | 'CANDIDATO' | 'MIEMBRO_DE_MESA' | 'SUBJEFE' | 'APODERADO' | 'VEEDOR';
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
    activeListId: number | null;
    activeDistrict: string | null;
    setActiveListId: (id: number | null) => void;
    setActiveDistrict: (district: string | null) => void;
    login: (credentials: any) => Promise<User>;
    logout: () => void;
    updateUser: (newData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Normalize role names from various backend formats
const normalizeRole = (role: string | undefined): User['role'] => {
    if (!role) return 'COORDINADOR'; // Default role
    
    const upperRole = role.toUpperCase();
    
    // Handle various role aliases
    if (upperRole === 'SUPER_ADMIN' || upperRole === 'SUPERUSUARIO') return 'SUPERUSUARIO';
    if (upperRole === 'COORDINATOR' || upperRole === 'COORDINADOR') return 'COORDINADOR';
    if (upperRole === 'CANDIDATE' || upperRole === 'CANDIDATO' || upperRole === 'JEFE_CAMPANA') return 'JEFE_CAMPANA';
    if (upperRole === 'LIDER_LISTA' || upperRole === 'SUBJEFE') return 'SUBJEFE';
    if (upperRole === 'PADRINO') return 'PADRINO';
    if (upperRole === 'MIEMBRO_DE_MESA' || upperRole === 'MIEMBRO_MESA') return 'MIEMBRO_DE_MESA';
    if (upperRole === 'APODERADO') return 'APODERADO';
    if (upperRole === 'VEEDOR') return 'VEEDOR';
    
    return 'COORDINADOR' as User['role'];
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeListId, setActiveListId] = useState<number | null>(null);
    const [activeDistrict, setActiveDistrict] = useState<string | null>(null);

    useEffect(() => {
        try {
            const savedUser = localStorage.getItem('auth_user');
            const savedListId = localStorage.getItem('active_list_id');
            const savedDistrict = localStorage.getItem('active_district');

            if (savedUser) {
                let parsed: User;
                try { 
                    parsed = JSON.parse(savedUser); 
                } catch { 
                    localStorage.removeItem('auth_user'); 
                    setLoading(false); 
                    return; 
                }

                // Normalize role on load
                parsed.role = normalizeRole(parsed.role as unknown as string);

                setUser(parsed);
                if (parsed.role !== 'SUPERUSUARIO') {
                    setActiveListId(parsed.assigned_list_id ?? null);
                } else {
                    if (savedListId) setActiveListId(savedListId === 'null' ? null : parseInt(savedListId));
                    if (savedDistrict) setActiveDistrict(savedDistrict === 'null' ? null : savedDistrict);
                }
            }
        } catch (err) {
            console.warn("Storage access denied in this environment.");
        } finally {
            setTimeout(() => setLoading(false), 100);
        }
    }, []);

    useEffect(() => {
        if (activeListId !== undefined) {
            try { localStorage.setItem('active_list_id', activeListId === null ? 'null' : activeListId.toString()); } catch(e) {}
        }
    }, [activeListId]);

    useEffect(() => {
        if (activeDistrict !== undefined) {
            try { localStorage.setItem('active_district', activeDistrict === null ? 'null' : activeDistrict); } catch(e) {}
        }
    }, [activeDistrict]);

    useEffect(() => {
        try {
            if (user) {
                localStorage.setItem('auth_user', JSON.stringify(user));
            } else {
                localStorage.removeItem('auth_user');
            }
        } catch(e) {}
    }, [user]);

    const login = async (credentials: any) => {
        const { data } = await api.post('/login', credentials);
        
        // Normalize role from server response
        const normalizedUser = {
            ...data,
            role: normalizeRole(data.role)
        };
        
        setUser(normalizedUser);
        try { localStorage.setItem('auth_user', JSON.stringify(normalizedUser)); } catch(e) {}
        
        if (normalizedUser.role === 'SUPERUSUARIO') {
            setActiveListId(null);
            setActiveDistrict(null);
            try {
                localStorage.setItem('active_list_id', 'null');
                localStorage.setItem('active_district', 'null');
            } catch(e) {}
        }
        
        return normalizedUser;
    };

    const logout = () => {
        setUser(null);
        window.location.href = '/login';
    };

    const updateUser = (newData: Partial<User>) => {
        setUser(prev => {
            if (!prev) return null;
            const updated = { ...prev, ...newData };
            // Normalize role if updated
            if (newData.role) {
                updated.role = normalizeRole(newData.role);
            }
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
        'x-list-id': (activeListId === null || activeListId === 'null') ? '' : activeListId.toString(),
        'x-user-role': user?.role || '',
        'x-district': activeDistrict === 'null' ? '' : (activeDistrict || '')
    };

    return fetch(url, { ...options, headers });
};

// Permission helpers for consistent role checking
export const canEdit = (role: User['role'] | undefined): boolean => {
    if (!role) return false;
    return ['COORDINADOR', 'MIEMBRO_DE_MESA', 'PADRINO', 'SUBJEFE'].includes(role);
};

export const canViewCommandCenter = (role: User['role'] | undefined): boolean => {
    if (!role) return false;
    return ['SUPERUSUARIO', 'JEFE_CAMPANA', 'SUBJEFE', 'PADRINO'].includes(role);
};

export const canManageUsers = (role: User['role'] | undefined): boolean => {
    if (!role) return false;
    return ['SUPERUSUARIO', 'JEFE_CAMPANA', 'SUBJEFE', 'PADRINO'].includes(role);
};

export const canAccessWhatsApp = (role: User['role'] | undefined): boolean => {
    if (!role) return false;
    return ['SUPERUSUARIO', 'JEFE_CAMPANA'].includes(role);
};

export const canViewReports = (role: User['role'] | undefined): boolean => {
    if (!role) return false;
    return ['SUPERUSUARIO', 'JEFE_CAMPANA', 'SUBJEFE', 'PADRINO'].includes(role);
};