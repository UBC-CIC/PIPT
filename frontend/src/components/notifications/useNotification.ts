import { useContext } from 'react';
import { NotificationContext, type NotificationContextValue } from './NotificationProvider';

export function useNotification(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotification must be used within a NotificationProvider. ' +
      'Wrap your application with <NotificationProvider>.'
    );
  }
  return context;
}
