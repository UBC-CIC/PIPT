import { createContext, useReducer, useCallback, type ReactNode } from 'react';
import { ToastContainer } from './ToastContainer';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: NotificationType;
  duration: number;
  createdAt: number;
}

export interface ShowNotificationOptions {
  message: string;
  type?: NotificationType;
  duration?: number;
}

export interface NotificationContextValue {
  showNotification: (options: ShowNotificationOptions) => string;
  dismissNotification: (id: string) => void;
}

type NotificationAction =
  | { type: 'ADD_TOAST'; payload: ToastItem }
  | { type: 'REMOVE_TOAST'; payload: { id: string } };

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  success: 5000,
  error: 8000,
  warning: 5000,
  info: 5000,
};

function notificationReducer(state: ToastItem[], action: NotificationAction): ToastItem[] {
  switch (action.type) {
    case 'ADD_TOAST':
      return [...state, action.payload];
    case 'REMOVE_TOAST':
      return state.filter((toast) => toast.id !== action.payload.id);
    default:
      return state;
  }
}

export const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(notificationReducer, []);

  const dismissNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_TOAST', payload: { id } });
  }, []);

  const showNotification = useCallback((options: ShowNotificationOptions): string => {
    const type = options.type ?? 'info';
    const duration = options.duration ?? DEFAULT_DURATIONS[type];
    const id = crypto.randomUUID();

    const toast: ToastItem = {
      id,
      message: options.message,
      type,
      duration,
      createdAt: Date.now(),
    };

    dispatch({ type: 'ADD_TOAST', payload: toast });
    return id;
  }, []);

  return (
    <NotificationContext.Provider value={{ showNotification, dismissNotification }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissNotification} />
    </NotificationContext.Provider>
  );
}
