import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';

interface ConfirmRevealDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmRevealDialog({ isOpen, onCancel, onConfirm }: ConfirmRevealDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
        <h2 className="text-3xl font-bold mb-4" style={{ color: UI_COLORS.text.heading }}>
          Confirm Reveal
        </h2>
        
        <p className="text-lg mb-8" style={{ color: UI_COLORS.text.body }}>
          Are you sure you want to reveal the Patient's Diagnosis? This action will show the entire answer.
        </p>
        
        <div className="flex justify-end gap-4">
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: UI_COLORS.button.primary,
              color: UI_COLORS.button.text,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = UI_COLORS.button.primaryHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = UI_COLORS.button.primary;
            }}
          >
            Cancel
          </button>
          
          <button
            onClick={onConfirm}
            className="px-6 py-3 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[5],
              color: UI_COLORS.button.text,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmRevealDialog;
