export type EmailTemplateKey =
  | 'welcome'
  | 'otp'
  | 'password-reset'
  | 'transfer-alert'
  | 'card-alert'
  | 'support-alert';

export type EmailTemplate = {
  key: EmailTemplateKey;
  subject: string;
  text: string;
  html: string;
};

export const emailTemplates: Record<EmailTemplateKey, EmailTemplate> = {
  welcome: {
    key: 'welcome',
    subject: 'Welcome to Nexus Banking',
    text: 'Welcome to Nexus Banking. Your demo banking profile is ready.',
    html: '<strong>Welcome to Nexus Banking.</strong><p>Your demo banking profile is ready.</p>',
  },
  otp: {
    key: 'otp',
    subject: 'Your Nexus Banking OTP',
    text: 'Use the one-time password to continue your secure banking session: {{code}}',
    html: '<strong>Your OTP is ready.</strong><p>Use the following one-time password to continue your secure banking session: <strong style="font-size: 24px; letter-spacing: 2px;">{{code}}</strong></p>',
  },
  'password-reset': {
    key: 'password-reset',
    subject: 'Reset your Nexus Banking password',
    text: 'Use the code to reset your password: {{code}}',
    html: '<strong>Password reset requested.</strong><p>Use the following code to reset your password: <strong style="font-size: 20px;">{{code}}</strong></p>',
  },
  'transfer-alert': {
    key: 'transfer-alert',
    subject: 'Nexus Banking transfer alert',
    text: 'A simulated transfer event was recorded on your account.',
    html: '<strong>Transfer alert.</strong><p>A simulated transfer event was recorded on your account.</p>',
  },
  'card-alert': {
    key: 'card-alert',
    subject: 'Nexus Banking card alert',
    text: 'A simulated card event was recorded on your account.',
    html: '<strong>Card alert.</strong><p>A simulated card event was recorded on your account.</p>',
  },
  'support-alert': {
    key: 'support-alert',
    subject: 'Nexus Banking support alert',
    text: 'A support case update is available.',
    html: '<strong>Support alert.</strong><p>A support case update is available.</p>',
  },
};
