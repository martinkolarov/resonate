export type RecordingRejectedReason =
  | 'RECORDING_NOT_FOUND'
  | 'UNSUPPORTED_CONTENT_TYPE'
  | 'EMPTY_FILE'
  | 'MAX_FILE_SIZE_EXCEEDED'
  | 'MAX_DURATION_EXCEEDED'
  | 'INSPECTION_FAILED'
  | 'TRANSCODING_FAILED';

export class RecordingRejectedError extends Error {
  constructor(public readonly reason: RecordingRejectedReason) {
    super(reason);
  }

  toJSON() {
    return {
      type: 'RECORDING_REJECTED',
      reason: this.reason,
    };
  }
}
