import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/environment';
import {
  type InfrastructureCheck,
  measureDuration,
} from '../infrastructure/infrastructure.types';
import {
  emailTemplates,
  type EmailTemplate,
  type EmailTemplateKey,
} from './email-template.registry';

type BrevoRecipient = {
  email: string;
  name?: string;
};

@Injectable()
export class EmailService {
  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  getTemplates(): EmailTemplate[] {
    return Object.values(emailTemplates);
  }

  getTemplate(key: EmailTemplateKey): EmailTemplate {
    return emailTemplates[key];
  }

  isConfigured(): boolean {
    return Boolean(this.configService.get('BREVO_API_KEY', { infer: true }));
  }

  async sendTemplateEmail(
    templateKey: EmailTemplateKey,
    recipient: BrevoRecipient,
    variables?: Record<string, string>,
  ): Promise<void> {
    const apiKey = this.configService.get('BREVO_API_KEY', { infer: true });
    const fromEmail = this.configService.get('BREVO_FROM_EMAIL', {
      infer: true,
    });
    const fromName = this.configService.get('BREVO_FROM_NAME', {
      infer: true,
    });

    if (!apiKey || !fromEmail) {
      throw new Error('Brevo email is not configured');
    }

    const template = this.getTemplate(templateKey);
    let subject = template.subject;
    let text = template.text;
    let html = template.html;

    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, value);
        text = text.replace(regex, value);
        html = html.replace(regex, value);
      }
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: fromEmail, name: fromName },
        to: [recipient],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Brevo send failed with HTTP ${response.status}`);
    }
  }

  async healthCheck(): Promise<InfrastructureCheck> {
    if (!this.isConfigured()) {
      return {
        name: 'Brevo',
        status: 'missing',
        detail: 'BREVO_API_KEY is missing',
      };
    }

    const startedAt = Date.now();

    try {
      const response = await fetch('https://api.brevo.com/v3/account', {
        headers: {
          accept: 'application/json',
          'api-key':
            this.configService.get('BREVO_API_KEY', { infer: true }) ?? '',
        },
      });

      return {
        name: 'Brevo',
        status: response.ok ? 'ready' : 'error',
        detail: `account endpoint HTTP ${response.status}; templates: ${this.getTemplates()
          .map((template) => template.key)
          .join(', ')}`,
        latencyMs: measureDuration(startedAt),
      };
    } catch (error) {
      return {
        name: 'Brevo',
        status: 'error',
        detail:
          error instanceof Error ? error.message : 'Brevo health check failed',
        latencyMs: measureDuration(startedAt),
      };
    }
  }
}
