import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

interface Settings {
  election_date: string;
  election_end_time: string;
  app_name: string;
  app_logo_url: string;
  global_goal: string;
  master_key: string;
  share_message: string;
  share_message_footer: string;
}

interface SettingsContextType {
  settings: Settings;
  loading: boolean;
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  refreshSettings: () => Promise<void>;
}

const API_BASE = 'http://localhost:5000/api';

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>({
    election_date: '2026-06-07T07:00:00',
    election_end_time: '17:00',
    app_name: 'INTELECCIONES 2026',
    app_logo_url: '',
    global_goal: '10000',
    master_key: '',
    share_message: 'Hola! Te comparto los datos de este elector consultado en la plataforma Intellecciones PLRA:',
    share_message_footer: '#Intelecciones #PLRA #DíaD'
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      let apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      if (!apiBase.startsWith('http')) apiBase = `https://${apiBase}`;
      apiBase = apiBase.replace(/\/$/, '');
      const res = await axios.get(`${apiBase}/api/settings`);
      setSettings(prev => ({ ...prev, ...res.data }));
      if (res.data.app_name) {
        document.title = res.data.app_name;
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings.app_name) {
      document.title = settings.app_name;
    }
  }, [settings.app_name]);

  const updateSettings = async (newSettings: Partial<Settings>) => {
    try {
      let apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      if (!apiBase.startsWith('http')) apiBase = `https://${apiBase}`;
      apiBase = apiBase.replace(/\/$/, '');
      await axios.post(`${apiBase}/api/settings`, newSettings);
      setSettings(prev => ({ ...prev, ...newSettings }));
    } catch (err) {
      console.error("Error updating settings:", err);
      throw err;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
