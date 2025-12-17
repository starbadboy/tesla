import React from 'react';
import { cn } from '../../utils/cn';

interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'label' | 'display';
    component?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'label';
}

export const Typography = React.forwardRef<HTMLElement, TypographyProps>(
    ({ className, variant = 'body', component, children, ...props }, ref) => {

        // Default component mapping
        const Component = component || (variant === 'body' || variant === 'label' ? 'p' : 'h1');

        const variants = {
            display: "font-display text-7xl md:text-8xl lg:text-9xl leading-none tracking-tighter",
            h1: "font-display text-4xl md:text-5xl font-bold tracking-tight",
            h2: "font-display text-2xl md:text-3xl font-semibold tracking-tight",
            h3: "font-serif text-xl font-medium",
            body: "font-serif text-base leading-relaxed text-foreground",
            label: "font-sans text-xs font-bold uppercase tracking-widest text-muted-foreground",
        };

        return React.createElement(
            Component,
            {
                ref,
                className: cn(variants[variant], className),
                ...props
            },
            children
        );
    }
);

Typography.displayName = "Typography";
