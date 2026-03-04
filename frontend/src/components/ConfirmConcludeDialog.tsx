import { useState } from 'react';
import { UI_COLORS, SIMULATION_GROUP_COLOR_PALETTE } from '@/lib/colors';

interface ConfirmConcludeDialogProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: (recommendations: string) => void;
}

function ConfirmConcludeDialog({ isOpen, onCancel, onConfirm }: ConfirmConcludeDialogProps) {
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState('');

  if (!isOpen) return null;

  const handleConfirmClick = () => {
    setShowRecommendations(true);
  };

  const handleSubmit = () => {
    onConfirm(recommendations);
    setShowRecommendations(false);
    setRecommendations('');
  };

  const handleCancel = () => {
    setShowRecommendations(false);
    setRecommendations('');
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full mx-4">
        <h2 className="text-3xl font-bold mb-4" style={{ color: UI_COLORS.text.heading }}>
          {showRecommendations ? 'Your Recommendations' : 'Confirm Conclusion'}
        </h2>
        
        {showRecommendations ? (
          <>
            <div className="mb-8">
              <div 
                className="border rounded-lg overflow-hidden"
                style={{ borderColor: UI_COLORS.border.default }}
              >
                <div 
                  className="flex items-center gap-2 px-4 py-2 border-b"
                  style={{ 
                    backgroundColor: '#f8f9fa',
                    borderColor: UI_COLORS.border.default 
                  }}
                >
                  <span className="text-sm" style={{ color: UI_COLORS.text.body }}>12pt</span>
                  <span className="text-sm" style={{ color: UI_COLORS.text.body }}>Paragraph</span>
                </div>
                <textarea
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  placeholder="Enter your recommendations here..."
                  className="w-full p-4 min-h-[400px] resize-none focus:outline-none"
                  style={{ 
                    color: UI_COLORS.text.body,
                    fontSize: '12pt',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                className="px-8 py-3 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[1],
                  color: UI_COLORS.button.text,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1';
                }}
              >
                Submit
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-lg mb-8" style={{ color: UI_COLORS.text.body }}>
              Are you sure you want to conclude? You will not be able to continue this interaction any further.
            </p>
            
            <div className="flex justify-end gap-4">
              <button
                onClick={handleCancel}
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
                onClick={handleConfirmClick}
                className="px-6 py-3 rounded-lg font-medium transition-colors"
                style={{
                  backgroundColor: SIMULATION_GROUP_COLOR_PALETTE[1],
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
          </>
        )}
      </div>
    </div>
  );
}

export default ConfirmConcludeDialog;
