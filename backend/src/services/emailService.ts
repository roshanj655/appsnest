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

const defaultConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
} as const;

export const sendEmail = async (params: SendEmailParams) => {
  const config = { ...defaultConfig, ...params.config };
  // Ensure auth object exists
  const auth = config.auth || defaultConfig.auth || { user: '', pass: '' };
  const transporter = nodemailer.createTransport({
    ...config,
    auth
  });

  const mailOptions = {
    from: auth.user || defaultConfig.auth.user,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    attachments: params.attachments,
  };

  return transporter.sendMail(mailOptions);
};
