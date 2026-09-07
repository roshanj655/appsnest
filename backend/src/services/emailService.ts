import nodemailer from 'nodemailer';

interface EmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user?: string;
    pass?: string;
  };
}

interface SendEmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: {
    filename: string;
    content: Buffer;
  }[];
  config?: Partial<EmailConfig>;
}

const isUsableSecret = (value?: string) => {
  const text = String(value || '').trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  return !lower.includes('your-email') && !lower.includes('your-app-password') && lower !== 'changeme';
};

export const mailerConfigFromSettings = (settings?: {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
} | null): EmailConfig => {
  const host = String(settings?.smtpHost || process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const user = String(settings?.smtpUser || process.env.SMTP_USER || '').trim();
  const pass = String(settings?.smtpPass || process.env.SMTP_PASS || '').trim();
  const port = Number(settings?.smtpPort || process.env.SMTP_PORT || 587);
  const secure = Boolean(settings?.smtpSecure ?? (process.env.SMTP_SECURE === 'true' || port === 465));
  return {
    host,
    port,
    secure,
    auth: { user, pass }
  };
};

export const assertMailerReady = (config: EmailConfig) => {
  if (!isUsableSecret(config.auth?.user) || !isUsableSecret(config.auth?.pass)) {
    const error: any = new Error(
      'Email is not configured. In Settings, add SMTP user and a Gmail App Password (16 characters), or set SMTP_USER and SMTP_PASS in backend/.env. A normal Gmail password will be rejected.'
    );
    error.status = 400;
    throw error;
  }
};

export const describeMailError = (error: any) => {
  if (error?.status === 400 && error?.message) return error.message;
  if (error?.code === 'EAUTH' || error?.responseCode === 535) {
    return 'Gmail rejected the SMTP login. Use the full Gmail address and a Google App Password, not the account password. Enable 2-Step Verification, then create an App Password at Google Account → Security.';
  }
  if (error?.code === 'ESOCKET' || error?.code === 'ETIMEDOUT' || error?.code === 'ECONNECTION') {
    return 'Could not connect to the mail server. Check SMTP host and port (Gmail: smtp.gmail.com, 587).';
  }
  return error?.message || 'Unable to send email.';
};

export const sendEmail = async (params: SendEmailParams) => {
  const resolved = params.config && params.config.auth
    ? { ...mailerConfigFromSettings(null), ...params.config, auth: { ...mailerConfigFromSettings(null).auth, ...params.config.auth } }
    : mailerConfigFromSettings(null);
  const auth = {
    user: String(resolved.auth?.user || '').trim(),
    pass: String(resolved.auth?.pass || '').trim()
  };
  assertMailerReady({ ...resolved, auth });

  const transporter = nodemailer.createTransport({
    host: resolved.host,
    port: resolved.port,
    secure: Boolean(resolved.secure),
    requireTLS: Number(resolved.port) === 587,
    auth
  });

  return transporter.sendMail({
    from: auth.user,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments
  });
};
