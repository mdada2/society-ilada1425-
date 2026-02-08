import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export interface ConfirmDialogOptions {
    title: string;
    titleMr?: string;
    message: string;
    messageMr?: string;
    icon?: string;
    confirmText?: string;
    confirmTextMr?: string;
    cancelText?: string;
    cancelTextMr?: string;
    confirmColor?: 'red' | 'blue' | 'green' | 'amber';
}

interface ConfirmDialogProps {
    isOpen: boolean;
    options: ConfirmDialogOptions;
    onConfirm: () => void;
    onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ isOpen, options, onConfirm, onCancel }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setShow(true), 10);
        } else {
            setShow(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const {
        title,
        titleMr,
        message,
        messageMr,
        icon = '⚠️',
        confirmText = 'Confirm',
        confirmTextMr = 'होय',
        cancelText = 'Cancel',
        cancelTextMr = 'रद्द करा',
        confirmColor = 'blue'
    } = options;

    const colorClasses = {
        red: 'bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800',
        blue: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800',
        green: 'bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800',
        amber: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-800'
    };

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-200 ${show ? 'opacity-100' : 'opacity-0'
                }`}
            onClick={onCancel}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />

            {/* Dialog */}
            <div
                className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full transform transition-all duration-200 ${show ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <X size={20} />
                </button>

                {/* Content */}
                <div className="p-6">
                    {/* Icon */}
                    <div className="flex justify-center mb-4">
                        <span className="text-5xl">{icon}</span>
                    </div>

                    {/* Title */}
                    <div className="text-center mb-3">
                        {titleMr && (
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                                {titleMr}
                            </h2>
                        )}
                        <h3 className={`${titleMr ? 'text-sm' : 'text-xl font-bold'} text-slate-600 dark:text-slate-300`}>
                            {title}
                        </h3>
                    </div>

                    {/* Message */}
                    <div className="text-center mb-6">
                        {messageMr && (
                            <p className="text-slate-700 dark:text-slate-300 mb-1">
                                {messageMr}
                            </p>
                        )}
                        <p className={`${messageMr ? 'text-sm' : ''} text-slate-600 dark:text-slate-400`}>
                            {message}
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-3 rounded-lg font-semibold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white transition-colors"
                        >
                            <div className="text-sm">{cancelTextMr}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">{cancelText}</div>
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-4 py-3 rounded-lg font-semibold text-white transition-colors ${colorClasses[confirmColor]}`}
                        >
                            <div className="text-sm">{confirmTextMr}</div>
                            <div className="text-xs opacity-90">{confirmText}</div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
