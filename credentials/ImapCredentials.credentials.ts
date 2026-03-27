import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class ImapCredentials implements ICredentialType {
	name = 'imapCredentials';

	displayName = 'IMAP Credentials';

	documentationUrl = 'https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/';

	properties: INodeProperties[] = [
		{
			displayName: 'Host',
			name: 'host',
			type: 'string',
			default: '',
			placeholder: 'imap.gmail.com',
			description: 'IMAP server hostname',
			required: true,
		},
		{
			displayName: 'Port',
			name: 'port',
			type: 'number',
			default: 993,
			description: 'IMAP server port. Usually 993 for SSL/TLS, 143 for STARTTLS or unencrypted.',
			required: true,
		},
		{
			displayName: 'Username',
			name: 'user',
			type: 'string',
			default: '',
			placeholder: 'user@example.com',
			description: 'IMAP account username (usually the email address)',
			required: true,
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'IMAP account password or app password',
			required: true,
		},
		{
			displayName: 'SSL/TLS',
			name: 'secure',
			type: 'boolean',
			default: true,
			description: 'Whether to use SSL/TLS for the connection (recommended). Use port 993.',
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
