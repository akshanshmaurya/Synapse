/**
 * SYNAPSE LOGO COMPONENT
 * 
 * Brand Guidelines:
 * - Logo is the wordmark "Synapse"
 * - Uses Playfair Display (elegant serif)
 * - Color: Deep olive (#5C6B4A) only
 * - No gradients, shadows, or effects
 * - Must have adequate whitespace
 * - Never animate the logo
 * - Never place inside buttons
 * 
 * This font must NOT be used anywhere else in the UI.
 */

import { Link } from 'react-router-dom';

interface LogoProps {
    /** Size variant */
    size?: 'sm' | 'md' | 'lg' | 'xl';
    /** Whether to link to home */
    linkToHome?: boolean;
    /** Additional class names */
    className?: string;
    /** Color variant (default uses brand olive) */
    variant?: 'default' | 'light';
}

const sizeClasses = {
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl',
};

/**
 * Synapse Logo Wordmark
 * 
 * Uses Playfair Display for an elegant, calm wordmark.
 * This is the ONLY place this font should be used.
 */
export default function Logo({
    size = 'md',
    linkToHome = true,
    className = '',
    variant = 'default',
}: LogoProps) {
    const logoStyles: React.CSSProperties = {
        fontFamily: "'Playfair Display', Georgia, serif",
        fontWeight: 500,
        letterSpacing: '0.02em',
        color: variant === 'light' ? '#FDF8F3' : '#5C6B4A',
        textDecoration: 'none',
        textShadow: 'none', // No effects
        // Ensure whitespace around logo
        padding: '0.25rem 0',
    };

    const wordmark = (
        <span
            style={logoStyles}
            className={`${sizeClasses[size]} ${className}`}
        >
            Synapse
        </span>
    );

    if (linkToHome) {
        return (
            <Link
                to="/"
                className="inline-block hover:opacity-90 transition-opacity duration-300"
                style={{ textDecoration: 'none' }}
            >
                {wordmark}
            </Link>
        );
    }

    return wordmark;
}
