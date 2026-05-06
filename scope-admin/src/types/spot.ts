export interface SpotSummary {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  city?: string;
  country?: string;
  creator?: string;
  creatorId?: string;
  created_at?: string;
  createdAt?: string;
  review_count?: number;
  reviewCount?: number;
  flagged?: boolean;
  featured?: boolean;
  photoUrl?: string;
  photos?: AdminPhoto[];
  rating?: number;
}

export type PhotoStatus = 'pending' | 'approved' | 'rejected';

export interface AdminPhoto {
  id: string;
  spotId?: string;
  spotName?: string;
  userId?: string;
  userName?: string;
  url: string;
  caption?: string;
  status?: PhotoStatus | string;
  created_at?: string;
  createdAt?: string;
  selected?: boolean;
}
