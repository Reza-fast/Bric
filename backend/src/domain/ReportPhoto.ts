export interface ReportPhoto {
  id: string;
  reportId: string;
  fileOriginalName: string;
  fileStorageKey: string;
  fileMimeType: string | null;
  sortOrder: number;
  createdAt: Date;
}
