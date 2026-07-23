import { Input as HeroUIInput, type InputProps as HeroUIInputProps } from '@heroui/react';

export type InputProps = HeroUIInputProps;

export function Input({ variant = 'bordered', ...props }: InputProps) {
  return <HeroUIInput variant={variant} {...props} />;
}
