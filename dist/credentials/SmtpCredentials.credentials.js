"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmtpCredentials = void 0;
class SmtpCredentials {
    constructor() {
        this.name = 'smtpCredentials';
        this.displayName = 'SMTP Credentials';
        this.documentationUrl = 'https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/';
        this.properties = [
            {
                displayName: 'Host',
                name: 'host',
                type: 'string',
                default: '',
                placeholder: 'smtp.gmail.com',
                description: 'SMTP server hostname',
                required: true,
            },
            {
                displayName: 'Port',
                name: 'port',
                type: 'number',
                default: 587,
                description: 'SMTP server port. Usually 587 for STARTTLS, 465 for SSL, 25 for unencrypted.',
                required: true,
            },
            {
                displayName: 'Username',
                name: 'user',
                type: 'string',
                default: '',
                placeholder: 'user@example.com',
                description: 'SMTP account username (usually the email address)',
                required: true,
            },
            {
                displayName: 'Password',
                name: 'password',
                type: 'string',
                typeOptions: { password: true },
                default: '',
                description: 'SMTP account password or app password',
                required: true,
            },
            {
                displayName: 'SSL/TLS',
                name: 'secure',
                type: 'boolean',
                default: false,
                description: 'Whether to use SSL/TLS directly (port 465). Set to false to use STARTTLS on port 587.',
            },
            {
                displayName: 'Require TLS (STARTTLS)',
                name: 'requireTLS',
                type: 'boolean',
                default: true,
                description: 'Whether to require STARTTLS upgrade. Recommended when SSL/TLS is disabled.',
            },
            {
                displayName: 'Allow Unauthorized Certificates',
                name: 'allowUnauthorizedCerts',
                type: 'boolean',
                default: false,
                description: 'Whether to allow self-signed or invalid TLS certificates. Enable only for testing.',
            },
        ];
    }
}
exports.SmtpCredentials = SmtpCredentials;
//# sourceMappingURL=SmtpCredentials.credentials.js.map