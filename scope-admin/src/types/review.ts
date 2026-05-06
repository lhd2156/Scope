export type ReviewStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export interface ReviewSummary {
  id: string;
  user?: string;
  userId?: string;
  spot?: string;
  spotId?: string;
  rating: number;
  text?: string;
  comment?: string;
  status?: ReviewStatus | string;
  flagged?: boolean;
  created_at?: string;
  createdAt?: string;
}
