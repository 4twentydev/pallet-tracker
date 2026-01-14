export interface PalletTask {
  id: string; // Unique identifier: `${jobNumber}-${releaseNumber}-${palletNumber}`
  jobNumber: string;
  releaseNumber: string;
  palletNumber: string;
  size: string; // e.g., "57x61", "48x96"
  elevation: string;
  made: boolean; // true if "X", false if empty
  accList: string; // Accessories list
  shippedDate: string; // Date string or empty
  notes: string;
  status: 'pending' | 'completed'; // Derived from `made`
}

export interface JobGroup {
  jobNumber: string;
  releaseNumber: string;
  pallets: PalletTask[];
  totalCount: number;
  completedCount: number;
  completionPercentage: number;
}

export interface FileMetadata {
  mtime: number; // File modification timestamp (milliseconds)
  version: string; // SHA-256 content hash for optimistic locking (reliable with cloud sync)
  readOnly: boolean; // True if file is locked by Excel - edits disabled
}

export interface PalletData {
  pallets: PalletTask[];
  metadata: FileMetadata;
}

export interface FilterOptions {
  searchQuery: string;
  statusFilter: 'all' | 'pending' | 'completed';
  jobFilter: string[];
  sizeFilter: string[];
}

export interface ServerActionResult<T = PalletData> {
  success: boolean;
  data?: T;
  error?: 'conflict' | 'unknown' | 'not_found';
  message?: string;
}
