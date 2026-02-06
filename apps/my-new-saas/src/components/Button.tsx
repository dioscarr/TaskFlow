import React from 'react';

/**
 * Button Component Template
 * A reusable button component following design system patterns
 */

export interface ButtonProps {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
    size?: 'small' | 'medium' | 'large';
    onClick?: () => void;
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
    className?: string;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'medium',
    onClick,
    disabled = false,
    type = 'button',
    className = '',
}) => {
    const baseStyles = 'btn';
    const variantStyles = variant === 'primary' ? 'btn-primary' : 'btn-secondary';

    const sizeStyles = {
        small: 'text-sm px-3 py-1.5',
        medium: 'text-base px-4 py-2',
        large: 'text-lg px-6 py-3',
    };

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyles} ${variantStyles} ${sizeStyles[size]} ${className}`}
            aria-disabled={disabled}
        >
            {children}
        </button>
    );
};

export default Button;

/**
 * Usage Example:
 * 
 * import Button from './components/Button';
 * 
 * <Button variant="primary" size="medium" onClick={() => alert('Clicked!')}>
 *   Click Me
 * </Button>
 */
