import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

const gmail = google.gmail("v1");

interface GmailConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface SendEmailParams {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string;
  bcc?: string;
}

export class GmailService {
  private oauth2Client: OAuth2Client;

  constructor(config: GmailConfig) {
    this.oauth2Client = new google.auth.OAuth2(
      config.clientId,
      config.clientSecret,
      config.redirectUri
    );
  }

  /**
   * Generate OAuth URL for user to authorize Gmail access
   * Forces account selection so users can choose any Gmail account,
   * not just the one used to authenticate on the app
   */
  getAuthUrl(state: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email",
      ],
      state,
      prompt: "select_account consent", // Force account selection AND consent
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresAt: Date;
    email: string;
  }> {
    const { tokens } = await this.oauth2Client.getToken(code);

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error("Failed to get tokens from Gmail");
    }

    // Get user email
    this.oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
    const { data } = await oauth2.userinfo.get();

    if (!data.email) {
      throw new Error("Failed to get user email from Gmail");
    }

    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000); // Default 1 hour

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt,
      email: data.email,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresAt: Date;
  }> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const { credentials } = await this.oauth2Client.refreshAccessToken();

    if (!credentials.access_token) {
      throw new Error("Failed to refresh access token");
    }

    const expiresAt = credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    return {
      accessToken: credentials.access_token,
      expiresAt,
    };
  }

  /**
   * Send email using Gmail API
   */
  async sendEmail(
    accessToken: string,
    refreshToken: string | null,
    params: SendEmailParams
  ): Promise<{ messageId: string }> {
    return this.sendEmailWithAttachments(accessToken, refreshToken, {
      ...params,
      attachments: [],
    });
  }

  /**
   * Send email with attachments using Gmail API
   */
  async sendEmailWithAttachments(
    accessToken: string,
    refreshToken: string | null,
    params: SendEmailParams & {
      attachments?: Array<{
        filename: string;
        mimeType: string;
        content: Buffer;
      }>;
    }
  ): Promise<{ messageId: string }> {
    // Set credentials
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
    });

    // Check if token is expired and refresh if needed
    const tokenInfo = await this.oauth2Client.getAccessToken();
    if (!tokenInfo.token) {
      throw new Error("Failed to get valid access token");
    }

    // Create email message
    const boundary = `boundary_${Date.now()}_${Math.random().toString(36)}`;
    
    // Encode subject in UTF-8 (RFC 2047)
    const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject).toString('base64')}?=`;
    
    const messageParts = [
      `From: ${params.from}`,
      `To: ${params.to}`,
      `Subject: ${encodedSubject}`,
    ];

    if (params.replyTo) {
      messageParts.push(`Reply-To: ${params.replyTo}`);
    }

    if (params.cc) {
      messageParts.push(`Cc: ${params.cc}`);
    }

    if (params.bcc) {
      messageParts.push(`Bcc: ${params.bcc}`);
    }

    messageParts.push("MIME-Version: 1.0");
    messageParts.push(
      `Content-Type: multipart/mixed; boundary="${boundary}"`
    );
    messageParts.push("");
    messageParts.push(`--${boundary}`);
    messageParts.push('Content-Type: multipart/alternative; boundary="alt_boundary"');
    messageParts.push("");
    messageParts.push("--alt_boundary");
    messageParts.push("Content-Type: text/plain; charset=UTF-8");
    messageParts.push("");
    messageParts.push(params.text || this.htmlToText(params.html));
    messageParts.push("");
    messageParts.push("--alt_boundary");
    messageParts.push("Content-Type: text/html; charset=UTF-8");
    messageParts.push("");
    messageParts.push(params.html);
    messageParts.push("");
    messageParts.push("--alt_boundary--");

    // Add attachments
    if (params.attachments && params.attachments.length > 0) {
      for (const attachment of params.attachments) {
        messageParts.push(`--${boundary}`);
        messageParts.push(
          `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`
        );
        messageParts.push("Content-Transfer-Encoding: base64");
        messageParts.push(
          `Content-Disposition: attachment; filename="${attachment.filename}"`
        );
        messageParts.push("");
        messageParts.push(attachment.content.toString("base64"));
      }
    }

    messageParts.push(`--${boundary}--`);

    const message = messageParts.join("\r\n");

    // Encode message in base64url
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send via Gmail API
    const response = await gmail.users.messages.send({
      auth: this.oauth2Client,
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    if (!response.data.id) {
      throw new Error("Failed to send email via Gmail");
    }

    return {
      messageId: response.data.id,
    };
  }

  /**
   * Verify mailbox connection
   */
  async verifyConnection(
    accessToken: string,
    refreshToken: string | null
  ): Promise<{ email: string; valid: boolean }> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken || undefined,
      });

      const oauth2 = google.oauth2({ version: "v2", auth: this.oauth2Client });
      const { data } = await oauth2.userinfo.get();

      return {
        email: data.email || "",
        valid: !!data.email,
      };
    } catch (error) {
      return {
        email: "",
        valid: false,
      };
    }
  }

  /**
   * Simple HTML to text converter
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gi, "")
      .replace(/<script[^>]*>.*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}

// Singleton instance
let gmailServiceInstance: GmailService | null = null;

export function getGmailService(): GmailService {
  if (!gmailServiceInstance) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.BETTER_AUTH_URL}/mailboxes/gmail/callback`;

    if (!clientId || !clientSecret) {
      throw new Error("Gmail OAuth credentials not configured");
    }

    gmailServiceInstance = new GmailService({
      clientId,
      clientSecret,
      redirectUri,
    });
  }

  return gmailServiceInstance;
}
