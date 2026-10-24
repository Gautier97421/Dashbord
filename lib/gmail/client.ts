/**
 * Gmail API client
 * Handles all Gmail API operations
 */

import { google } from 'googleapis';
import { GmailEmail, GmailLabel, GmailListResponse, GmailSearchQuery } from './types';

export interface GmailAttachmentRef {
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

// Gmail limite les requêtes par minute et par utilisateur : sur "trop de requêtes", on réessaie
// avec une attente croissante au lieu de perdre le mail (scan de plusieurs centaines de mails)
const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

function isRateLimited(error: any): boolean {
  const status = error?.code ?? error?.status ?? error?.response?.status;
  const message = String(error?.message || '');
  return status === 429 || (status === 403 && /rate ?limit|quota/i.test(message)) || /quota exceeded|rate limit/i.test(message);
}

async function withRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      if (attempt >= RETRY_DELAYS_MS.length || !isRateLimited(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt] + Math.random() * 500));
    }
  }
}

/** Plain text from an email body or attachment (HTML tags and entities removed). */
export function htmlToText(content: string): string {
  return content
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&euro;/gi, '€')
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/**
 * Gmail client for interacting with Gmail API
 */
export class GmailClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Create authenticated Gmail API instance
   */
  private getGmailInstance() {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: this.accessToken,
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Get all labels for the user
   */
  async getLabels(): Promise<GmailLabel[]> {
    const gmail = this.getGmailInstance();
    const response = await gmail.users.labels.list({ userId: 'me' });
    return (response.data.labels || []) as GmailLabel[];
  }

  /**
   * Get a label by name
   */
  async getLabelByName(name: string): Promise<GmailLabel | null> {
    const labels = await this.getLabels();
    return labels.find(l => l.name === name) || null;
  }

  /**
   * Create a new label
   */
  async createLabel(name: string): Promise<GmailLabel> {
    const gmail = this.getGmailInstance();
    const response = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name,
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show',
      },
    });
    return response.data as GmailLabel;
  }

  /**
   * Search for emails
   * Uses Gmail search query language: https://support.google.com/mail/answer/7190?hl=en
   */
  async searchEmails(query: GmailSearchQuery): Promise<GmailListResponse> {
    const gmail = this.getGmailInstance();
    const response = await withRetry(() => gmail.users.messages.list({
      userId: 'me',
      q: query.q,
      maxResults: query.maxResults || 10,
      pageToken: query.pageToken,
    }));
    return response.data as GmailListResponse;
  }

  /**
   * Get email details
   */
  async getEmail(messageId: string): Promise<GmailEmail> {
    const gmail = this.getGmailInstance();
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    return response.data as GmailEmail;
  }

  /**
   * Get the readable text of an email (text/plain part, or text/html with tags stripped),
   * truncated to maxLength characters, plus the list of its attachments (not downloaded).
   * Used to extract prices and billing dates from invoices.
   */
  async getEmailContent(messageId: string, maxLength = 20000): Promise<{ text: string; attachments: GmailAttachmentRef[] }> {
    const gmail = this.getGmailInstance();
    const response = await withRetry(() => gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' }));

    const decode = (data?: string | null) =>
      data ? Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8') : '';
    let plain = '';
    let html = '';
    const attachments: GmailAttachmentRef[] = [];
    const walk = (part: any) => {
      if (!part) return;
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          attachmentId: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || '',
          size: part.body.size || 0,
        });
      } else if (part.mimeType === 'text/plain' && !plain) plain = decode(part.body?.data);
      else if (part.mimeType === 'text/html' && !html) html = decode(part.body?.data);
      (part.parts || []).forEach(walk);
    };
    walk(response.data.payload);

    return { text: htmlToText(plain || html).slice(0, maxLength), attachments };
  }

  /** Conversation (thread) of a message : c'est cet identifiant qu'attendent les liens Gmail. */
  async getThreadId(messageId: string): Promise<string> {
    const gmail = this.getGmailInstance();
    const response = await withRetry(() => gmail.users.messages.get({ userId: 'me', id: messageId, format: 'minimal' }));
    return response.data.threadId || messageId;
  }

  /** Download one attachment's raw bytes. */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    const gmail = this.getGmailInstance();
    const response = await withRetry(() => gmail.users.messages.attachments.get({ userId: 'me', messageId, id: attachmentId }));
    const data = response.data.data || '';
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  }

  /**
   * Get lightweight metadata for an email (from, subject, snippet, date).
   * Cheaper than getEmail (metadata format, only the headers we need).
   */
  async getEmailMetadata(messageId: string): Promise<{
    id: string;
    from: string;
    subject: string;
    snippet: string;
    date: string;
    labelIds: string[];
    hasListUnsubscribe: boolean;
  }> {
    const gmail = this.getGmailInstance();
    const response = await withRetry(() => gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date', 'List-Unsubscribe'],
    }));

    const headers = response.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

    return {
      id: response.data.id || messageId,
      from: getHeader('From'),
      subject: getHeader('Subject'),
      snippet: response.data.snippet || '',
      date: getHeader('Date'),
      // CATEGORY_PROMOTIONS = onglet "Promotions" de Gmail
      labelIds: response.data.labelIds || [],
      // En-tête présent sur les envois de masse (newsletters, marketing)
      hasListUnsubscribe: !!getHeader('List-Unsubscribe'),
    };
  }

  /**
   * Send an email on behalf of the authenticated user.
   * Builds a minimal RFC 2822 message and submits it via the Gmail API.
   */
  async sendEmail(params: { to: string; subject: string; body: string }): Promise<{ id: string; threadId: string }> {
    const gmail = this.getGmailInstance();

    const subjectEncoded = `=?utf-8?B?${Buffer.from(params.subject, 'utf8').toString('base64')}?=`;
    const messageLines = [
      `To: ${params.to}`,
      `Subject: ${subjectEncoded}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      params.body,
    ];

    const rawMessage = Buffer.from(messageLines.join('\r\n'), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: rawMessage },
    });

    return {
      id: response.data.id || '',
      threadId: response.data.threadId || '',
    };
  }

  /**
   * Create a DRAFT instead of sending — the safe, reversible equivalent of
   * sendEmail. The user reviews and sends it manually from Gmail.
   */
  async createDraft(params: { to: string; subject: string; body: string }): Promise<{ id: string }> {
    const gmail = this.getGmailInstance();

    const subjectEncoded = `=?utf-8?B?${Buffer.from(params.subject, 'utf8').toString('base64')}?=`;
    const messageLines = [
      `To: ${params.to}`,
      `Subject: ${subjectEncoded}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      params.body,
    ];
    const rawMessage = Buffer.from(messageLines.join('\r\n'), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const response = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw: rawMessage } },
    });

    return { id: response.data.id || '' };
  }

  /**
   * Apply a label to emails
   */
  async applyLabel(messageIds: string[], labelId: string): Promise<void> {
    const gmail = this.getGmailInstance();

    // Batch apply label to all messages
    for (const messageId of messageIds) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: [labelId],
        },
      });
    }
  }

  /**
   * Remove a label from emails
   */
  async removeLabel(messageIds: string[], labelId: string): Promise<void> {
    const gmail = this.getGmailInstance();

    for (const messageId of messageIds) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: [labelId],
        },
      });
    }
  }

  /**
   * Move emails to a label (folder)
   * In Gmail, folders are implemented as labels
   */
  async moveEmails(messageIds: string[], labelId: string): Promise<void> {
    const gmail = this.getGmailInstance();

    for (const messageId of messageIds) {
      // Remove from Inbox, add to target label
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['INBOX'],
          addLabelIds: [labelId],
        },
      });
    }
  }

  /**
   * Delete emails (move to trash). Reversible from Gmail's Trash.
   */
  async deleteEmails(messageIds: string[]): Promise<void> {
    const gmail = this.getGmailInstance();

    for (const messageId of messageIds) {
      await gmail.users.messages.trash({
        userId: 'me',
        id: messageId,
      });
    }
  }

  /**
   * Permanently delete emails (cannot be undone).
   * Requires the gmail.modify scope.
   */
  async deleteEmailsPermanently(messageIds: string[]): Promise<void> {
    const gmail = this.getGmailInstance();

    for (const messageId of messageIds) {
      await gmail.users.messages.delete({
        userId: 'me',
        id: messageId,
      });
    }
  }

  /**
   * Mark emails as read
   */
  async markAsRead(messageIds: string[]): Promise<void> {
    const gmail = this.getGmailInstance();

    for (const messageId of messageIds) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    }
  }

  /**
   * Mark emails as unread
   */
  async markAsUnread(messageIds: string[]): Promise<void> {
    const gmail = this.getGmailInstance();

    for (const messageId of messageIds) {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['UNREAD'],
        },
      });
    }
  }

  /**
   * Start watching the mailbox for changes (Gmail push notifications).
   * Requires a Google Cloud Pub/Sub topic that Gmail is allowed to publish to.
   * Returns the historyId baseline and the watch expiration timestamp.
   */
  async watch(topicName: string): Promise<{ historyId: string; expiration: string }> {
    const gmail = this.getGmailInstance();
    const response = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'include',
      },
    });
    return {
      historyId: response.data.historyId || '',
      expiration: response.data.expiration || '',
    };
  }

  /**
   * Stop receiving push notifications for this mailbox.
   */
  async stopWatch(): Promise<void> {
    const gmail = this.getGmailInstance();
    await gmail.users.stop({ userId: 'me' });
  }

  /**
   * Return the IDs of messages added since a given historyId.
   * Used by the push webhook to find what's new without a full re-scan.
   */
  async getNewMessageIds(startHistoryId: string): Promise<string[]> {
    const gmail = this.getGmailInstance();
    const ids = new Set<string>();
    let pageToken: string | undefined;

    do {
      const response = await gmail.users.history.list({
        userId: 'me',
        startHistoryId,
        historyTypes: ['messageAdded'],
        pageToken,
      });

      for (const h of response.data.history || []) {
        for (const added of h.messagesAdded || []) {
          if (added.message?.id) ids.add(added.message.id);
        }
      }
      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return Array.from(ids);
  }

  /** Current mailbox profile, including the latest historyId. */
  async getProfileHistoryId(): Promise<string> {
    const gmail = this.getGmailInstance();
    const profile = await gmail.users.getProfile({ userId: 'me' });
    return profile.data.historyId || '';
  }
}
