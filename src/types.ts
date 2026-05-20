export interface Note {
  id: string;
  title?: string;
  content: string;
  categories?: string[];
  summary?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  isConfidential?: boolean;
  color?: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  folder?: string;
  keywords?: string[];
}
