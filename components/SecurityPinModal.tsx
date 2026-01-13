import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, KeyRound } from 'lucide-react';

interface SecurityPinModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
}

const SecurityPinModal: React.FC<SecurityPinModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    title = "Security Confirmation"
}) => {
    const [pin, setPin] = useState('');
    const [error, setError] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setPin('');
            setError(false);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, validate against a stored hash or API
        // For this mock/preview, we'll accept '1234' as default from App.tsx logic
        if (pin === '1234') {
            onSuccess();
            onClose();
        } else {
            setError(true);
            setPin('');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
                <div className="bg-slate-100 dark:bg-slate-900 p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2 text-slate-800 dark:text-white">
                        <ShieldCheck className="text-blue-600" size={20} />
                        {title}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="text-center mb-6">
                            <div className="inline-block p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
                                <KeyRound size={32} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-sm">
                                Enter your 4-digit security PIN to proceed with this action.
                            </p>
                        </div>

                        <div>
                            <input
                                type="password"
                                maxLength={4}
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                className="w-full text-center text-3xl tracking-[0.5em] font-bold py-3 bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:border-blue-500 outline-none transition-colors text-slate-800 dark:text-white placeholder-slate-300"
                                placeholder="••••"
                                autoFocus
                            />
                            {error && (
                                <p className="text-red-500 text-xs text-center mt-2 font-medium">
                                    Incorrect PIN. Please try again.
                                </p>
                            )}
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:brightness-95 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={pin.length !== 4}
                                className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirm
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default SecurityPinModal;
