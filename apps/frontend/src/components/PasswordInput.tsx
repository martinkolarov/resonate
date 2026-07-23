import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Input, type InputProps } from '@/components/Input';

type PasswordInputProps = Omit<InputProps, 'endContent' | 'type'>;

export function PasswordInput({ label, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputName = typeof label === 'string' ? label.toLowerCase() : 'password';

  return (
    <Input
      {...props}
      endContent={
        <button
          aria-label={isVisible ? `Hide ${inputName}` : `Show ${inputName}`}
          type="button"
          onClick={() => setIsVisible(isCurrentlyVisible => !isCurrentlyVisible)}
        >
          <Icon
            className="text-default-400 pointer-events-none text-2xl"
            icon={isVisible ? 'solar:eye-closed-linear' : 'solar:eye-bold'}
          />
        </button>
      }
      label={label}
      type={isVisible ? 'text' : 'password'}
    />
  );
}
