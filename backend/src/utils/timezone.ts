// Helper functions for Paraguay timezone (GMT-3)

export const getParaguayTime = (): Date => {
  const now = new Date();
  // Convert to Paraguay time (GMT-3, which is -3 hours from UTC)
  return new Date(now.getTime() - (now.getTimezoneOffset() * 60000) - (3 * 60 * 60 * 1000));
};

export const getParaguayTimestamp = (): string => {
  const dt = getParaguayTime();
  // Format: YYYY-MM-DD HH:MM:SS
  return dt.toISOString().replace('T', ' ').substring(0, 19);
};

export const getParaguayDateTime = (): string => {
  const dt = getParaguayTime();
  // Format for display: YYYY-MM-DD HH:MM:SS GMT-3
  return dt.toISOString().replace('T', ' ').substring(0, 19) + ' GMT-3';
};

export const formatParaguayTime = (date: Date): string => {
  // Format a date to Paraguay time string
  const offset = date.getTimezoneOffset();
  const paraguayDate = new Date(date.getTime() - (offset * 60000) - (3 * 60 * 60 * 1000));
  return paraguayDate.toISOString().replace('T', ' ').substring(0, 19);
};
