import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import '../../styles/option-menu.css';

export interface Option {
    value: string;
    label: string;
}

export interface OptionMenuProps {
    value: string;
    options: Option[];
    onChange: (value: string) => void;
    /** Applied to the trigger so each surface can keep its own look. */
    className?: string;
    ariaLabel?: string;
    /** Rendered before the label, e.g. a sort icon. */
    icon?: React.ReactNode;
    /** Which edge to line the list up with. */
    align?: 'left' | 'right' | 'center';
}

/**
 * A dropdown whose list we can actually style — a native <select> hands the option list
 * to the OS, which looks nothing like the rest of the studio. The list is portalled to
 * the document root: the studio and gallery shells reset padding on every descendant,
 * which would flatten it.
 */
export function OptionMenu({
    value, options, onChange, className, ariaLabel, icon, align = 'left',
}: OptionMenuProps) {
    const [open, setOpen] = useState(false);
    const [box, setBox] = useState<{ top: number; left: number; minWidth: number } | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const popRef = useRef<HTMLDivElement>(null);

    const current = options.find(option => option.value === value);

    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            const rect = trigger.getBoundingClientRect();
            const width = Math.max(rect.width, 200);
            let left = rect.left;
            if (align === 'right') left = rect.right - width;
            if (align === 'center') left = rect.left + rect.width / 2 - width / 2;
            const margin = 8;
            left = Math.min(Math.max(margin, left), window.innerWidth - width - margin);
            setBox({ top: rect.bottom + 8, left, minWidth: width });
        };
        place();
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => {
            window.removeEventListener('resize', place);
            window.removeEventListener('scroll', place, true);
        };
    }, [open, align]);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            if (popRef.current?.contains(e.target as Node)) return;
            if (triggerRef.current?.contains(e.target as Node)) return;
            setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                className={className}
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen(v => !v)}
            >
                {icon}
                <span className="om-value">{current?.label ?? value}</span>
                <ChevronDown className="om-caret" size={14} />
            </button>

            {open && box && createPortal(
                <div
                    ref={popRef}
                    className="om-pop"
                    role="listbox"
                    style={{ top: box.top, left: box.left, minWidth: box.minWidth }}
                >
                    {options.map(option => (
                        <button
                            key={option.value}
                            type="button"
                            role="option"
                            aria-selected={option.value === value}
                            className={`om-item ${option.value === value ? 'is-active' : ''}`}
                            onClick={() => { onChange(option.value); setOpen(false); }}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>,
                document.body,
            )}
        </>
    );
}
