export interface MetricPoint {
  label: string;
  users?: number;
  spots?: number;
  reviews?: number;
  likes?: number;
  photos?: number;
}

export interface DashboardStats {
  totalUsers: number;
  totalSpots: number;
  totalTrips: number;
  totalReviews: number;
  activeSessions: number;
}

export interface ActivityItem {
  id: string;
  type: 'registration' | 'spot' | 'review' | 'trip' | 'system';
  label: string;
  timestamp: string;
}

export interface GeoMetric {
  name: string;
  value: number;
}
