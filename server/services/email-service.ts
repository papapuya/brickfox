import nodemailer from 'nodemailer';

/**
 * Email Service for sending emails via SMTP (Greyhound)
 */
class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  /**
   * Initialize SMTP transporter with Greyhound credentials
   */
  private initializeTransporter() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM;

    if (!smtpHost || !smtpUser || !smtpPass || !smtpFrom) {
      console.warn('⚠️ SMTP credentials not configured. Email sending will be disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    console.log(`✅ Email Service initialized: ${smtpHost}:${smtpPort}`);
  }

  /**
   * Send email for requesting product URLs from supplier
   */
  async sendSupplierUrlRequest(params: {
    to: string;
    subject: string;
    message: string;
    eanCodes: string[];
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP transporter not configured. Please check SMTP environment variables.',
      };
    }

    const { to, subject, message, eanCodes } = params;
    const smtpFrom = process.env.SMTP_FROM!;

    // Build EAN list for email body
    const eanList = eanCodes.map((ean, index) => `${index + 1}. ${ean}`).join('\n');

    // Construct email body
    const emailBody = `${message}

──────────────────────────────
EAN-Codes (${eanCodes.length} Produkte):
──────────────────────────────

${eanList}

──────────────────────────────

Mit freundlichen Grüßen
${smtpFrom}
`;

    try {
      const info = await this.transporter.sendMail({
        from: smtpFrom,
        to: to,
        subject: subject,
        text: emailBody,
      });

      console.log('✅ Email sent successfully:', info.messageId);
      return { success: true };
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test SMTP connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP transporter not configured',
      };
    }

    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection test successful');
      return { success: true };
    } catch (error) {
      console.error('❌ SMTP connection test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const emailService = new EmailService();
