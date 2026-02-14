'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { ActionButton } from './ActionButton';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const variantConfig = {
  danger: {
    icon: 'text-red-400',
    iconBg: 'bg-red-500/10',
    button: 'danger' as const,
  },
  warning: {
    icon: 'text-yellow-400',
    iconBg: 'bg-yellow-500/10',
    button: 'primary' as const,
  },
  info: {
    icon: 'text-blue-400',
    iconBg: 'bg-blue-500/10',
    button: 'primary' as const,
  },
};

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  const config = variantConfig[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${config.iconBg}`}>
                    <ExclamationTriangleIcon className={`w-5 h-5 ${config.icon}`} />
                  </div>
                  <h3 className="text-lg font-bold text-white">{title}</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                <p className="text-gray-300">{message}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-800">
                <ActionButton
                  variant="ghost"
                  onClick={onClose}
                  disabled={loading}
                >
                  {cancelText}
                </ActionButton>
                <ActionButton
                  variant={config.button}
                  onClick={onConfirm}
                  loading={loading}
                >
                  {confirmText}
                </ActionButton>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
