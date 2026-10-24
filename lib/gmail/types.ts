/**
 * Gmail API type definitions
 */

export interface GmailEmailHeader {
  name: string;
  value: string;
}

export interface GmailEmail {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload?: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: GmailEmailHeader[];
    body?: {
      size: number;
      data?: string;
    };
    parts?: any[];
  };
  sizeEstimate: number;
  raw?: string;
}

export interface GmailLabel {
  id: string;
  name: string;
  messageListVisibility: string;
  labelListVisibility: string;
  type: string;
}

export interface GmailListResponse {
  resultSizeEstimate: number;
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
}

export interface GmailSearchQuery {
  q: string; // Gmail search query (e.g., "is:unread from:sender@example.com")
  maxResults?: number; // Default 10, max 100
  pageToken?: string;
}

/**
 * OAuth token info
 */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}
