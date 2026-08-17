import { useParams } from 'react-router';

export function RecordingPage() {
  const { recordingId } = useParams();
  return <div className="text-red-500">This is recording {recordingId}</div>;
}
