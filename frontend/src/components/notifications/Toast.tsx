import { useEffect } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import type { ToastItem, NotificationType } from './NotificationProvider';

interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ICON_MAP: Record<NotificationType, typeof CheckCircle> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLE_MAP: Record<NotificationType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-green-50', border: 'border-green-500', icon: 'text-green-600' },
  error: { bg: 'bg-red-50', border: 'border-red-500', icon: 'text-red-600' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-500', icon: 'text-amber-600' },
  info: { bg: 'bg-blue-50', border: 'border-blue-500', icon: 'text-blue-600' },
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const { id, message, type, duration } = toast;
  const Icon = ICON_MAP[type];
  const styles = STYLE_MAP[type];

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const isError = type === 'error';

  return (
    <div
      className={`${styles.bg} ${styles.border} shadow-xl rounded-lg border-l-4 px-5 py-4 min-w-[380px] max-w-[480px] flex items-start gap-3`}
      role={isError ? 'alert' : undefined}
      aria-live={isError ? 'assertive' : undefined}
    >
      <Icon className={`${styles.icon} h-6 w-6 shrink-0 mt-0.5`} />
      <p className="text-base text-gray-800 flex-1">{message}</p>
      <button
        onClick={() => onDismiss(id)}
        className="text-gray-400 hover:text-gray-600 shrink-0 focus:outline-none focus:ring-2 focus:ring-gray-400 rounded"
        aria-label="Dismiss notification"
        type="button"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
