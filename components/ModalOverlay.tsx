
import React, { useEffect } from 'react';

interface ModalOverlayProps {
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * Common modal overlay with ESC key + backdrop click to close.
 * Wraps modal content with consistent close behavior.
 */
export const ModalOverlay: React.FC<ModalOverlayProps> = ({ onClose, children, className = '' }) => {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 backdrop-blur-sm animate-fade-in ${className}`}
      onClick={onClose}
    >
      <div onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
};
