import { debug } from '../utils/debug';

export interface GeoLocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export type GeolocationCallback = (coords: GeoLocationCoords) => void;

let webWatchId: number | null = null;
let capacitorWatcherId: string | null = null;

export const LocationService = {
  /**
   * Start tracking coordinates. Works in both Capacitor native apps and standard web browsers.
   */
  startTracking: async (onUpdate: GeolocationCallback, onError?: (err: any) => void) => {
    debug.log('[LOCATION_SERVICE] Starting location tracking...');

    // Dynamic import via string query to prevent Rollup static analysis resolution checks
    let BackgroundGeolocation: any = null;
    try {
      const pluginName = '@capacitor-community/background-geolocation';
      // @ts-ignore
      const capModule = await import(/* @vite-ignore */ pluginName);
      BackgroundGeolocation = capModule.BackgroundGeolocation;
    } catch (e) {
      debug.warn('[LOCATION_SERVICE] Background Geolocation plugin not available. Falling back to browser geolocation.');
    }

    if (BackgroundGeolocation) {
      try {
        capacitorWatcherId = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Transmitiendo ubicación del chofer...',
            backgroundTitle: 'Rastreo de Vehículo "Día D"',
            requestPermissions: true,
            stale: false,
            distanceFilter: 10 // Update every 10 meters
          },
          (location: any, error: any) => {
            if (error) {
              debug.error('[LOCATION_SERVICE] Capacitor Geolocation Error:', error);
              if (onError) onError(error);
              return;
            }
            if (location) {
              onUpdate({
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy
              });
            }
          }
        );
        debug.log(`[LOCATION_SERVICE] Capacitor background watcher registered with ID: ${capacitorWatcherId}`);
        return;
      } catch (err) {
        debug.error('[LOCATION_SERVICE] Failed to initialize Capacitor background plugin, using web fallback.', err);
      }
    }

    // Fallback: Web navigator.geolocation
    if (typeof window !== 'undefined' && navigator.geolocation) {
      webWatchId = navigator.geolocation.watchPosition(
        (position) => {
          onUpdate({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (err) => {
          debug.error('[LOCATION_SERVICE] Web Geolocation Error:', err);
          if (onError) onError(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
      debug.log(`[LOCATION_SERVICE] Browser location watcher registered with ID: ${webWatchId}`);
    } else {
      debug.error('[LOCATION_SERVICE] Geolocation APIs are not supported by this browser/platform.');
    }
  },

  /**
   * Stop geolocation tracking
   */
  stopTracking: async () => {
    debug.log('[LOCATION_SERVICE] Stopping tracking...');
    
    // Stop Web Watcher
    if (webWatchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(webWatchId);
      webWatchId = null;
    }

    // Stop Capacitor Watcher
    if (capacitorWatcherId) {
      try {
        const pluginName = '@capacitor-community/background-geolocation';
        // @ts-ignore
        const capModule = await import(/* @vite-ignore */ pluginName);
        const BackgroundGeolocation = capModule.BackgroundGeolocation;
        await BackgroundGeolocation.removeWatcher({ id: capacitorWatcherId });
      } catch (err) {
        debug.error('[LOCATION_SERVICE] Error removing Capacitor background watcher:', err);
      } finally {
        capacitorWatcherId = null;
      }
    }
  }
};
