import { useEffect } from 'react';

interface KeyboardOptions {
    onEscape: () => void;
    onColon: () => void;
    onSlash: () => void;
    onQuestionMark: () => void;
    onKey: (key: string, ctrlKey: boolean, shiftKey: boolean) => void;
    disabledKeyboard: boolean;
}

export function useKeyboard(options: KeyboardOptions) {
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            const isInputFocused = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA';

            if (e.key === 'Escape') {
                e.preventDefault();
                options.onEscape();
                return;
            }

            if (e.key === ':' && !isInputFocused) {
                e.preventDefault();
                options.onColon();
                return;
            }

            if (e.key === '/' && !isInputFocused) {
                e.preventDefault();
                options.onSlash();
                return;
            }

            if (options.disabledKeyboard) return;
            if (isInputFocused && e.key !== 'Escape') return;

            if (e.key === '?') {
                options.onQuestionMark();
            } else {
                options.onKey(e.key, e.ctrlKey, e.shiftKey);
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [options]);
}
