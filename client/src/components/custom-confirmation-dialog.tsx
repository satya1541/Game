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
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in-0 duration-300"
      onClick={onClose}
    >
      <div 
        className="p-6 max-w-md w-full mx-4 animate-in zoom-in-95 duration-300 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border border-white/30 dark:border-gray-700/50 shadow-2xl rounded-2xl"
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
            className="hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
            data-testid="button-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-gray-800 dark:text-gray-200 mb-6 leading-relaxed">
          {message}
        </p>
        {fileName && (
          <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              File: <span className="text-red-600 dark:text-red-400">{fileName}</span>
            </p>
          </div>
        )}
        <div className="flex justify-end space-x-3">
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel"
          >
            {cancelText}
          </Button>
          <Button 
            onClick={handleConfirm}
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            data-testid="button-confirm"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}