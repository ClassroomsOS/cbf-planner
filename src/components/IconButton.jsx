// ── IconButton.jsx ───────────────────────────────────────────────────────────
// Accessible icon button component with required aria-label

import { forwardRef } from 'react'

/**
 * Accessible icon button component
 * @param {Object} props
 * @param {string} props.label - Accessible label (REQUIRED)
 * @param {string} props.icon - Icon/emoji to display
 * @param {Function} props.onClick - Click handler
 * @param {boolean} props.disabled - Disabled state
 * @param {string} props.variant - 'primary' | 'secondary' | 'danger' | 'ghost'
 * @param {string} props.size - 'sm' | 'md' | 'lg'
 * @param {Object} props.style - Additional inline styles
 */
const IconButton = forwardRef(function IconButton(
  {
    label,
    icon,
    onClick,
    disabled = false,
    variant = 'ghost',
    size = 'md',
    className = '',
    style = {},
    type = 'button',
    ...rest
  },
  ref
) {
  // Ensure label is provided for accessibility
  if (!label && process.env.NODE_ENV !== 'production') {
    console.warn('IconButton: "label" prop is required for accessibility')
  }

  const variantStyles = {
    primary: {
      background: '#2E5598',
      color: '#fff',
      border: 'none',
    },
    secondary: {
      background: '#4BACC6',
      color: '#fff',
      border: 'none',
    },
    danger: {
      background: '#C0504D',
      color: '#fff',
      border: 'none',
    },
    ghost: {
      background: 'transparent',
      color: 'inherit',
      border: 'none',
    },
    outline: {
      background: 'transparent',
      color: '#2E5598',
      border: '1px solid currentColor',
    },
  }

  const sizeStyles = {
    sm: {
      padding: '4px',
      fontSize: '12px',
      minWidth: '24px',
      minHeight: '24px',
    },
    md: {
      padding: '6px',
      fontSize: '14px',
      minWidth: '32px',
      minHeight: '32px',
    },
    lg: {
      padding: '8px',
      fontSize: '16px',
      minWidth: '40px',
      minHeight: '40px',
    },
  }

  const baseStyle = {
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease',
    fontFamily: 'inherit',
    opacity: disabled ? 0.5 : 1,
    ...variantStyles[variant],
    ...sizeStyles[size],
  }

  const hoverStyle = !disabled
    ? {
        ':hover': {
          opacity: 0.8,
          transform: 'scale(1.05)',
        },
        ':focus': {
          outline: '2px solid #4BACC6',
          outlineOffset: '2px',
        },
        ':active': {
          transform: 'scale(0.95)',
        },
      }
    : {}

  return (
    <button
      ref={ref}
      type={type}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      className={className}
      style={{
        ...baseStyle,
        ...style,
      }}
      {...rest}
    >
      {icon}
    </button>
  )
})

export default IconButton
