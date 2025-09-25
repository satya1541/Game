import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomPopupProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'success' | 'error' | 'info' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function CustomPopup({ 
  isOpen, 
  onClose, 
  type, 
  title, 
  message,
  onConfirm,
  onCancel
}: CustomPopupProps) {
  if (!isOpen) return null;

  const getTypeColor = () => {
    switch (type) {
      case 'success': return 'text-green-400 border-green-400 bg-green-400/10';
      case 'error': return 'text-red-400 border-red-400 bg-red-400/10';
      case 'info': return 'text-cyan-400 border-cyan-400 bg-cyan-400/10';
      case 'confirm': return 'text-yellow-400 border-yellow-400 bg-yellow-400/10';
      default: return 'text-primary border-primary bg-primary/10';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      case 'confirm': return '❓';
      default: return '🎮';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`glow-border rounded-xl shadow-2xl max-w-md w-full mx-4 animate-in fade-in-0 zoom-in-95 duration-200 ${getTypeColor()}`}>
        <div className="bg-background border border-border rounded-xl overflow-hidden">
          <div className={`flex items-center gap-3 p-6 border-b border-border ${getTypeColor()}`}>
            <div className="text-2xl">{getIcon()}</div>
            <h3 className={`text-lg font-gaming font-semibold flex-1 ${getTypeColor().split(' ')[0]}`}>
              {title}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-8 h-8 hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-6">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>
          <div className="flex justify-end gap-3 p-6 pt-0">
            {type === 'confirm' ? (
              <>
                <Button
                  onClick={() => {
                    onCancel ? onCancel() : onClose();
                  }}
                  variant="outline"
                  className="min-w-20"
                  data-testid="popup-no-button"
                >
                  No
                </Button>
                <Button
                  onClick={() => {
                    onConfirm && onConfirm();
                    onClose();
                  }}
                  className="min-w-20 bg-primary hover:bg-primary/90"
                  data-testid="popup-yes-button"
                >
                  Yes
                </Button>
              </>
            ) : (
              <Button
                onClick={onClose}
                className={`min-w-20 ${
                  type === 'error' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : type === 'success'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-primary hover:bg-primary/90'
                }`}
              >
                OK
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}