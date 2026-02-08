import React, { createContext, useContext, useState, ReactNode } from 'react';
import { ConfirmDialog, ConfirmDialogOptions } from '../components/ConfirmDialog';

interface DialogContextType {
    showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmDialogOptions>({
        title: '',
        message: ''
    });
    const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

    const showConfirm = (opts: ConfirmDialogOptions): Promise<boolean> => {
        setOptions(opts);
        setIsOpen(true);

        return new Promise<boolean>((resolve) => {
            setResolvePromise(() => resolve);
        });
    };

    const handleConfirm = () => {
        setIsOpen(false);
        if (resolvePromise) {
            resolvePromise(true);
            setResolvePromise(null);
        }
    };

    const handleCancel = () => {
        setIsOpen(false);
        if (resolvePromise) {
            resolvePromise(false);
            setResolvePromise(null);
        }
    };

    return (
        <DialogContext.Provider value={{ showConfirm }}>
            {children}
            <ConfirmDialog
                isOpen={isOpen}
                options={options}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </DialogContext.Provider>
    );
};

export const useDialog = (): DialogContextType => {
    const context = useContext(DialogContext);
    if (!context) {
        throw new Error('useDialog must be used within DialogProvider');
    }
    return context;
};
