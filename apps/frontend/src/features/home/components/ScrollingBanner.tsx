'use client';

import type { ScrollShadowProps } from '@heroui/react';

import React from 'react';
import { ScrollShadow } from '@heroui/react';
import { cn } from '@heroui/react';

interface ScrollingBannerProps extends ScrollShadowProps {
  isReverse?: boolean;
  showShadow?: boolean;
  shouldPauseOnHover?: boolean;
  isVertical?: boolean;
  gap?: string;
  duration?: number;
}
const ScrollingBanner = React.forwardRef<HTMLDivElement, ScrollingBannerProps>(
  (
    {
      className,
      isReverse,
      isVertical = false,
      gap = '1rem',
      showShadow = true,
      shouldPauseOnHover = true,
      duration = 40,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const shadowProps: ScrollShadowProps = {
      isEnabled: showShadow,
      offset: -20,
      size: 300,
      orientation: isVertical ? 'vertical' : 'horizontal',
      visibility: 'both',
      ...props,
    };

    return (
      <ScrollShadow
        {...shadowProps}
        ref={ref}
        className={cn(
          'flex',
          {
            'w-full': !isVertical,
            'overflow-y-hidden': isVertical,
            'overflow-x-hidden': !isVertical,
            'max-h-[calc(100vh-200px)]': isVertical,
          },
          className
        )}
        style={{
          // @ts-expect-error --gap exists as a property
          '--gap': gap,
          '--duration': `${duration}s`,
          ...style,
        }}
      >
        <div
          className={cn('flex w-max items-stretch gap-(--gap)', {
            'flex-col': isVertical,
            'h-full': isVertical,
            'scrolling-banner-animation': !isVertical,
            'scrolling-banner-animation-vertical': isVertical,
            '[animation-direction:reverse]': isReverse,
            'hover:[animation-play-state:paused]': shouldPauseOnHover,
          })}
        >
          <div
            className={cn('flex shrink-0 items-stretch gap-(--gap)', {
              'flex-col': isVertical,
            })}
          >
            {children}
          </div>
          <div
            aria-hidden="true"
            className={cn('flex shrink-0 items-stretch gap-(--gap)', {
              'flex-col': isVertical,
            })}
          >
            {children}
          </div>
        </div>
      </ScrollShadow>
    );
  }
);

ScrollingBanner.displayName = 'ScrollingBanner';

export default ScrollingBanner;
