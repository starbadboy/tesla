import React from 'react';
import { cn } from '../../utils/cn';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, label, ...props }, ref) => {
        return (
            <div className="space-y-1">
                {label && (
                    <label className="block text-xs font-medium font-sans uppercase tracking-widest text-muted-foreground">
                        {label}
                    </label>
                )}
                <div className="relative">
                    <select
                        ref={ref}
                        className={cn(
                            "appearance-none w-full bg-background border-b-2 border-foreground rounded-none py-3 px-2 pr-8 text-sm font-serif focus:outline-none focus:border-b-[4px] disabled:opacity-50 transition-all duration-100 placeholder:italic",
                            className
                        )}
                        {...props}
                    >
                        {children}
                    </select>
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-foreground">
                        <ChevronDown size={16} strokeWidth={1.5} />
                    </div>
                </div>
            </div>
        );
    }
);

Select.displayName = "Select";
