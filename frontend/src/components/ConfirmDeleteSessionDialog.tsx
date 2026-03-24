import { UI_COLORS } from '@/lib/colors';

interface ConfirmDeleteSessionDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDeleteSessionDialog({ isOpen, onCancel, onConfirm }: ConfirmDeleteSessionDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: UI_COLORS.background.overlay }}>
      <div className="rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4" style={{ backgroundColor: UI_COLORS.background.white }}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: UI_COLORS.text.heading }}>
          Delete Session
        </h2>
        <p className="text-base mb-8" style={{ color: UI_COLORS.text.body }}>
          Are you sure you want to delete this session? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: UI_COLORS.button.primary, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = UI_COLORS.button.primary}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-6 py-3 rounded-lg font-medium transition-colors"
            style={{ backgroundColor: UI_COLORS.status.error, color: UI_COLORS.button.text }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteSessionDialog;
