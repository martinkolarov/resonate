import { cn } from '@heroui/react';
import { Icon } from '@iconify/react';
import { useDropzone, type DropzoneOptions } from 'react-dropzone';

const recordingFileTypes: DropzoneOptions['accept'] = {
  'audio/*': [],
  'video/*': [],
};

export type DropzoneProps = Omit<DropzoneOptions, 'multiple' | 'onDropAccepted'> & {
  className?: string;
  onDropAccepted?: (file: File) => void;
};

export function UploadRecordingDropzone({
  className,
  accept = recordingFileTypes,
  onDropAccepted,
  ...options
}: DropzoneProps) {
  const { fileRejections, getInputProps, getRootProps, isDragActive, isDragReject } = useDropzone({
    accept,
    ...options,
    multiple: false,
    onDropAccepted: files => {
      const [file] = files;
      if (file) onDropAccepted?.(file);
    },
  });

  const prompt = isDragReject
    ? 'This file type is not supported'
    : isDragActive
      ? 'Drop to add your recording'
      : 'Drop a recording here';

  return (
    <div className={className}>
      <div
        {...getRootProps({
          className: cn(
            'group flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-large border-2 border-dashed border-default-300 bg-default-50/50 px-6 py-10 text-center outline-none transition-colors',
            'hover:border-default-400 hover:bg-default-100/60',
            'focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20',
            isDragActive && !isDragReject && 'border-primary bg-primary-50/50',
            isDragReject && 'border-danger bg-danger-50/50'
          ),
        })}
      >
        <input {...getInputProps()} />
        <span
          className={cn(
            'mb-4 flex size-11 items-center justify-center rounded-full bg-default-100 text-default-500 transition-colors group-hover:text-foreground',
            isDragActive && !isDragReject && 'bg-primary-100 text-primary',
            isDragReject && 'bg-danger-100 text-danger'
          )}
        >
          <Icon
            aria-hidden="true"
            icon={isDragReject ? 'solar:close-circle-linear' : 'solar:upload-minimalistic-linear'}
            width={22}
          />
        </span>

        <p className="text-small font-semibold text-foreground">{prompt}</p>
        <p className="mt-1 text-tiny text-default-500">or click to choose an audio or video file</p>
      </div>

      {fileRejections.length > 0 ? (
        <p className="mt-3 text-small text-danger" role="alert">
          Choose one audio or video file at a time.
        </p>
      ) : null}
    </div>
  );
}
