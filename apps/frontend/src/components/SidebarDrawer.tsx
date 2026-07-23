import { cn, Drawer, DrawerBody, DrawerContent, type DrawerProps } from '@heroui/react';
import React from 'react';

type SidebarDrawerProps = DrawerProps & {
  sidebarWidth?: number;
  sidebarPlacement?: 'left' | 'right';
};

const easeOut = [0, 0, 0.2, 1] as const;

const SidebarDrawer = React.forwardRef<HTMLDivElement, SidebarDrawerProps>(
  (
    {
      children,
      className,
      onOpenChange,
      isOpen,
      sidebarWidth = 288,
      classNames = {},
      sidebarPlacement = 'left',
      motionProps: drawerMotionProps,
      ...props
    },
    ref
  ) => {
    const motionProps = React.useMemo(() => {
      if (drawerMotionProps && typeof drawerMotionProps === 'object') {
        return drawerMotionProps;
      }

      return {
        variants: {
          enter: {
            x: 0,
            transition: {
              x: {
                duration: 0.3,
                ease: easeOut,
              },
            },
          },
          exit: {
            x: sidebarPlacement === 'left' ? -sidebarWidth : sidebarWidth,
            transition: {
              x: {
                duration: 0.2,
                ease: easeOut,
              },
            },
          },
        },
      };
    }, [drawerMotionProps, sidebarPlacement, sidebarWidth]);

    const sidebarStyle = {
      '--sidebar-width': `${sidebarWidth}px`,
    } as React.CSSProperties;

    return (
      <>
        <Drawer
          ref={ref}
          {...props}
          classNames={{
            ...classNames,
            wrapper: cn('w-(--sidebar-width)!', classNames.wrapper, {
              'items-start! justify-start!': sidebarPlacement === 'left',
              'items-end! justify-end!': sidebarPlacement === 'right',
            }),
            base: cn(
              'm-0! h-full max-h-full w-(--sidebar-width) p-0!',
              classNames.base,
              className,
              {
                'inset-y-0 left-0 max-h-none justify-start! rounded-l-none':
                  sidebarPlacement === 'left',
                'inset-y-0 right-0 max-h-none justify-end! rounded-r-none':
                  sidebarPlacement === 'right',
              }
            ),
            body: cn('p-0', classNames.body),
            closeButton: cn('z-50', classNames.closeButton),
          }}
          isOpen={isOpen}
          motionProps={motionProps}
          radius="none"
          scrollBehavior="inside"
          style={sidebarStyle}
          onOpenChange={onOpenChange}
        >
          <DrawerContent>
            <DrawerBody>{children}</DrawerBody>
          </DrawerContent>
        </Drawer>

        <div
          className={cn('hidden h-full max-w-(--sidebar-width) overflow-hidden sm:flex', className)}
          style={sidebarStyle}
        >
          {children}
        </div>
      </>
    );
  }
);

SidebarDrawer.displayName = 'SidebarDrawer';

export default SidebarDrawer;
