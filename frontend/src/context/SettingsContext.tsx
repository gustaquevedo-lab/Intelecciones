import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

interface Settings {
  election_date: string;
  election_end_time: string;
  app_name: string;
  app_logo_url: string;
  campaign_slogan?: string;
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

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  console.log('Rendering SettingsProvider');
  const [settings, setSettings] = useState<Settings>({
    election_date: '2026-06-07T07:00:00',
    election_end_time: '17:00',
    app_name: 'INTELECCIONES 2026',
    app_logo_url: '',
    campaign_slogan: '¡Hacia la Victoria!',
    global_goal: '10000',
    master_key: '',
    share_message: 'Hola! Te comparto los datos de este elector consultado en la plataforma Intellecciones PLRA:',
    share_message_footer: '#Intelecciones #PLRA #DíaD'
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
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
      await api.post('/settings', newSettings);
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
