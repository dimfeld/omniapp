export type PackageTrackingLocation = {
  city: string;
  stateOrProvinceCode: string;
  postalCode: string;
  countryCode: string;
};

export type PackageTrackingEvent = {
  id: string;
  occurredAt: string;
  code: string;
  description: string;
  location: PackageTrackingLocation | null;
};

export type PackageTrackingDetails = {
  service: string;
  packageType: string;
  origin: PackageTrackingLocation | null;
  destination: PackageTrackingLocation | null;
  signedBy: string;
};

export type PackageTracking = {
  statusCode: string;
  status: string;
  description: string;
  estimatedDeliveryStart: string | null;
  estimatedDeliveryEnd: string | null;
  lastUpdatedAt: string | null;
  lastCheckedAt: number;
  complete: boolean;
  error: string | null;
  details: PackageTrackingDetails;
  events: PackageTrackingEvent[];
};

export type PackageRecord = {
  id: string;
  name: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  expectedDeliveryDate: string | null;
  delivered: boolean;
  addedAt: number;
  tracking: PackageTracking | null;
};
