export interface TechnicalPlan {
  id: string;
  projectId: string;
  title: string;
  fileOriginalName: string;
  fileStorageKey: string;
  fileMimeType: string | null;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type TechnicalPlanCreateInput = {
  id?: string;
  projectId: string;
  title: string;
  fileOriginalName: string;
  fileStorageKey: string;
  fileMimeType: string | null;
  uploadedByUserId: string | null;
};

export type TechnicalPlanWithProjectName = TechnicalPlan & { projectName: string };
