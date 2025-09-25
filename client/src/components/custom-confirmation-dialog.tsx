import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CustomConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type?: 'delete' | 'confirm' | 'warning';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  fileName?: string;
}

export default function CustomConfirmationDialog({ 
  isOpen, 
  onClose, 
  onConfirm,
  type,
  title, 
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  fileName
}: CustomConfirmationDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in-0 duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-900 border-2 border-blue-500/30 dark:border-cyan-400/30 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl backdrop-blur-md animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
        data-testid="confirmation-dialog"
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h3>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose}
            className="hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            data-testid="button-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex justify-end space-x-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 opacity-90 hover:opacity-100"
            data-testid="button-cancel"
          >
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
            className={variant === 'destructive' 
              ? "bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600 opacity-90 hover:opacity-100" 
              : "bg-[#de5c5c] hover:bg-[#c54848] text-white dark:bg-[#de5c5c] dark:hover:bg-[#c54848] opacity-90 hover:opacity-100"
            }
            data-testid="button-confirm"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}