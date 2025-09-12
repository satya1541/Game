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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-muted-foreground mb-6">{message}</p>
        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'destructive' ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}