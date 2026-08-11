import { useToast } from '@/components/ToastProvider';
import { RecordingList } from '@/features/recordings/components/RecordingList';
import { UploadRecordingDropzone } from '@/features/recordings/components/UploadRecordingDropzone';
import { getRecordings, createRecording } from '@/features/recordings/recordings.api';
import { getErrorMessage } from '@/lib/get-error-message';
import { useMutation, useQuery } from '@tanstack/react-query';

export default function RecordingsPage() {
  const { toast } = useToast();
  const recordingsQuery = useQuery({
    queryKey: ['recordings'],
    queryFn: getRecordings,
  });
  const createRecordingMutation = useMutation({
    mutationFn: createRecording,
  });
  async function handleDropAccepted(file: File) {
    try {
      const { recording, uploadTarget } = await createRecordingMutation.mutateAsync({
        fileName: file.name,
        mimeType: file.type,
      });
      await fetch(uploadTarget.url, {
        method: uploadTarget.method,
        body: file,
      });
      recordingsQuery.refetch();
    } catch (error: unknown) {
      toast(getErrorMessage(error), 'danger', 5000);
    }
  }

  const recordings = recordingsQuery.data ?? [];

  return (
    <>
      <title>Recordings | Resonate</title>

      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 py-12 sm:px-10 lg:px-12">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Recordings</h1>
          <p className="mt-1 text-small text-default-500">
            Add a meeting or lecture to start processing it.
          </p>
        </header>
        <UploadRecordingDropzone onDropAccepted={handleDropAccepted} className="my-8" />
        <RecordingList recordings={recordings} isLoading={recordingsQuery.isPending} />
      </div>
    </>
  );
}
