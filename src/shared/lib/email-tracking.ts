import jwt from 'jsonwebtoken';

const TRACKING_SECRET = process.env.TRACKING_JWT_SECRET || 'change-this-secret-in-production';

export interface TrackingData {
  organizationId: string;
  emailHistoryId?: string;
  campaignId?: string;
  leadId?: string;
  recipient: string;
  sentAt: string;
}

/**
 * Generate a JWT token for email tracking
 */
export function generateTrackingToken(data: TrackingData): string {
  return jwt.sign(data, TRACKING_SECRET, {
    expiresIn: '90d', // Token valid for 90 days
    algorithm: 'HS256',
  });
}

/**
 * Verify and decode a tracking token
 */
export function verifyTrackingToken(token: string): TrackingData | null {
  try {
    const decoded = jwt.verify(token, TRACKING_SECRET, {
      algorithms: ['HS256'],
    }) as TrackingData;
    
    return decoded;
  } catch (error) {
    console.error('Failed to verify tracking token:', error);
    return null;
  }
}

/**
 * Inject tracking pixel into HTML email content
 */
export function injectTrackingPixel(htmlContent: string, trackingToken: string): string {
  const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3001';
  const trackingUrl = `${baseUrl}/api/success/${trackingToken}`;
  
  // Tracking pixel: 1x1 transparent GIF
  const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none !important; border:0; height:1px !important; width:1px !important; padding:0 !important; margin:0 !important;" alt="" />`;
  
  // Try to inject before </body>, fallback to end of content
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${trackingPixel}</body>`);
  } else {
    return `${htmlContent}${trackingPixel}`;
  }
}

/**
 * Generate a 1x1 transparent GIF pixel
 */
export function generateTransparentPixel(): Buffer {
  // Base64 encoded 1x1 transparent GIF
  const gifBase64 = 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  return Buffer.from(gifBase64, 'base64');
}
