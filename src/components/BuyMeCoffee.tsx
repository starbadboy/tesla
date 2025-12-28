import { Coffee } from 'lucide-react';
import { cn } from '../utils/cn';

export const BuyMeCoffee = () => {
    return (
        <a
            href="https://buymeacoffee.com/starbadboy"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
                "absolute bottom-4 left-4 md:bottom-6 md:left-6 z-50",
                "flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3",
                "bg-[#FFDD00] text-black font-sans font-bold uppercase tracking-widest text-xs",
                "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
                "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
                "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
                "transition-all duration-200"
            )}
            title="Support the developer"
        >
            <Coffee size={18} strokeWidth={2.5} />
            <span className="hidden md:inline">Buy me a coffee</span>
        </a>
    );
};
