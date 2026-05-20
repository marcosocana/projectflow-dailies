const EVENT_NAME = 'activity-log-read-state-changed';

export function getActivityLogReadKey(projectId: string, userId?: string | null) {
  return `projectflow:activity-log:last-seen:${projectId}:${userId || 'anonymous'}`;
}

export function getActivityLogLastSeen(projectId: string, userId?: string | null) {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(getActivityLogReadKey(projectId, userId));
}

export function setActivityLogLastSeen(projectId: string, userId?: string | null, value = new Date().toISOString()) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getActivityLogReadKey(projectId, userId), value);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { projectId, userId, value } }));
}

export function subscribeToActivityLogReadState(callback: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleChange = () => callback();
  window.addEventListener(EVENT_NAME, handleChange);
  window.addEventListener('storage', handleChange);

  return () => {
    window.removeEventListener(EVENT_NAME, handleChange);
    window.removeEventListener('storage', handleChange);
  };
}
