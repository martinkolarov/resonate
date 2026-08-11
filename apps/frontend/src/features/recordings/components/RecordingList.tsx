import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell } from '@heroui/table';
import type { RecordingSummary } from '@resonate/contracts';
import { Spinner } from '@heroui/react';

type RecordingListProps = {
  recordings: readonly RecordingSummary[];
  isLoading: boolean;
};

export function RecordingList({ recordings, isLoading }: RecordingListProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-40 items-center justify-center" aria-busy="true">
        <Spinner label="Loading recordings" size="sm" />
      </div>
    );
  }

  return (
    <Table aria-label="Recordings">
      <TableHeader>
        <TableColumn>File name</TableColumn>
        <TableColumn>Status</TableColumn>
        <TableColumn>Date</TableColumn>
      </TableHeader>
      <TableBody>
        {recordings.map(recording => (
          <TableRow key={recording.id}>
            <TableCell>{recording.fileName}</TableCell>
            <TableCell>{recording.status}</TableCell>
            <TableCell>{new Date(recording.createdAt).toDateString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
