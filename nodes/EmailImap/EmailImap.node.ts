import type {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	IExecuteFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import { ImapFlow } from 'imapflow';
import * as nodemailer from 'nodemailer';
import { simpleParser } from 'mailparser';

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildImapClient(credentials: Record<string, unknown>): ImapFlow {
	return new ImapFlow({
		host: credentials.host as string,
		port: credentials.port as number,
		secure: credentials.secure as boolean,
		auth: {
			user: credentials.user as string,
			pass: credentials.password as string,
		},
		tls: {
			rejectUnauthorized: !(credentials.allowUnauthorizedCerts as boolean),
		},
		logger: false,
	});
}

function buildSmtpTransport(credentials: Record<string, unknown>): nodemailer.Transporter {
	return nodemailer.createTransport({
		host: credentials.host as string,
		port: credentials.port as number,
		secure: credentials.secure as boolean,
		requireTLS: credentials.requireTLS as boolean,
		auth: {
			user: credentials.user as string,
			pass: credentials.password as string,
		},
		tls: {
			rejectUnauthorized: !(credentials.allowUnauthorizedCerts as boolean),
		},
	});
}

function formatAddresses(
	addrs: Array<{ name?: string; address?: string }> | undefined,
): Array<{ name: string; address: string }> {
	if (!addrs) return [];
	return addrs.map((a) => ({ name: a.name ?? '', address: a.address ?? '' }));
}

// ─── IMAP operation handlers ───────────────────────────────────────────────

async function opGetMessages(
	executeFns: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<Record<string, unknown>[]> {
	const limit = executeFns.getNodeParameter('limit', itemIndex) as number;
	const onlyUnread = executeFns.getNodeParameter('onlyUnread', itemIndex) as boolean;
	const includeBody = executeFns.getNodeParameter('includeBody', itemIndex) as boolean;
	const markAsReadOnFetch = executeFns.getNodeParameter('markAsReadOnFetch', itemIndex) as boolean;

	const lock = await client.getMailboxLock(mailbox);
	const messages: Record<string, unknown>[] = [];

	try {
		const searchCriteria = onlyUnread ? { seen: false } : {};
		const uids = await client.search(searchCriteria, { uid: true });
		const limitedUids = (uids || []).slice(-limit);

		if (limitedUids.length === 0) return [];

		const fetchQuery: Record<string, unknown> = {
			envelope: true,
			flags: true,
			internalDate: true,
			size: true,
			uid: true,
		};
		if (includeBody) fetchQuery.source = true;

		for await (const msg of client.fetch(limitedUids, fetchQuery as never, { uid: true })) {
			const data: Record<string, unknown> = {
				uid: msg.uid,
				seq: msg.seq,
				flags: msg.flags ? [...msg.flags] : [],
				internalDate: msg.internalDate,
				size: msg.size,
			};

			if (msg.envelope) {
				data.subject = msg.envelope.subject;
				data.date = msg.envelope.date;
				data.messageId = msg.envelope.messageId;
				data.from = formatAddresses(msg.envelope.from);
				data.to = formatAddresses(msg.envelope.to);
				data.cc = formatAddresses(msg.envelope.cc);
				data.bcc = formatAddresses(msg.envelope.bcc);
				data.replyTo = formatAddresses(msg.envelope.replyTo);
			}

			if (includeBody && msg.source) {
				const parsed = await simpleParser(msg.source as Buffer);
				data.text = parsed.text ?? '';
				data.html = parsed.html ?? '';
				data.attachments = (parsed.attachments ?? []).map((a) => ({
					filename: a.filename ?? '',
					contentType: a.contentType,
					size: a.size,
				}));
			}

			messages.push(data);
		}

		if (markAsReadOnFetch && limitedUids.length > 0) {
			await client.messageFlagsAdd(limitedUids, ['\\Seen'], { uid: true });
		}
	} finally {
		lock.release();
	}

	return messages;
}

async function opGetMessage(
	executeFns: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<Record<string, unknown>[]> {
	const uid = executeFns.getNodeParameter('uid', itemIndex) as string;
	const markAsReadOnFetch = executeFns.getNodeParameter('markAsReadOnFetch', itemIndex) as boolean;

	const lock = await client.getMailboxLock(mailbox);
	const messages: Record<string, unknown>[] = [];

	try {
		for await (const msg of client.fetch(
			uid,
			{ envelope: true, source: true, flags: true, internalDate: true, size: true, uid: true } as never,
			{ uid: true },
		)) {
			const data: Record<string, unknown> = {
				uid: msg.uid,
				seq: msg.seq,
				flags: msg.flags ? [...msg.flags] : [],
				internalDate: msg.internalDate,
				size: msg.size,
			};

			if (msg.envelope) {
				data.subject = msg.envelope.subject;
				data.date = msg.envelope.date;
				data.messageId = msg.envelope.messageId;
				data.from = formatAddresses(msg.envelope.from);
				data.to = formatAddresses(msg.envelope.to);
				data.cc = formatAddresses(msg.envelope.cc);
				data.bcc = formatAddresses(msg.envelope.bcc);
				data.replyTo = formatAddresses(msg.envelope.replyTo);
			}

			if (msg.source) {
				const parsed = await simpleParser(msg.source as Buffer);
				data.text = parsed.text ?? '';
				data.html = parsed.html ?? '';
				data.attachments = (parsed.attachments ?? []).map((a) => ({
					filename: a.filename ?? '',
					contentType: a.contentType,
					size: a.size,
					content: a.content.toString('base64'),
				}));
				const headersObj: Record<string, unknown> = {};
				for (const [key, value] of parsed.headers.entries()) {
					headersObj[key] = value;
				}
				data.headers = headersObj;
			}

			messages.push(data);
		}

		if (markAsReadOnFetch && messages.length > 0) {
			await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
		}
	} finally {
		lock.release();
	}

	return messages;
}

async function opMarkFlag(
	executeFns: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
	action: 'add' | 'remove',
	flag: string,
): Promise<Record<string, unknown>[]> {
	const uid = executeFns.getNodeParameter('uid', itemIndex) as string;

	const lock = await client.getMailboxLock(mailbox);
	try {
		if (action === 'add') {
			await client.messageFlagsAdd(uid, [flag], { uid: true });
		} else {
			await client.messageFlagsRemove(uid, [flag], { uid: true });
		}
	} finally {
		lock.release();
	}

	return [{ success: true, uid, flag, action, mailbox }];
}

async function opDeleteMessage(
	executeFns: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<Record<string, unknown>[]> {
	const uid = executeFns.getNodeParameter('uid', itemIndex) as string;

	const lock = await client.getMailboxLock(mailbox);
	try {
		await client.messageDelete(uid, { uid: true });
	} finally {
		lock.release();
	}

	return [{ success: true, uid, mailbox, operation: 'deleted' }];
}

async function opMoveMessage(
	executeFns: IExecuteFunctions,
	client: ImapFlow,
	mailbox: string,
	itemIndex: number,
): Promise<Record<string, unknown>[]> {
	const uid = executeFns.getNodeParameter('uid', itemIndex) as string;
	const destination = executeFns.getNodeParameter('destination', itemIndex) as string;

	const lock = await client.getMailboxLock(mailbox);
	try {
		await client.messageMove(uid, destination, { uid: true });
	} finally {
		lock.release();
	}

	return [{ success: true, uid, from: mailbox, to: destination, operation: 'moved' }];
}

// ─── Node class ────────────────────────────────────────────────────────────

export class EmailImap implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Email (IMAP/SMTP)',
		name: 'emailImap',
		icon: 'file:email.svg',
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Fetch, read, mark, delete, and send emails via IMAP and SMTP',
		defaults: {
			name: 'Email IMAP/SMTP',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'imapCredentials',
				required: true,
				displayOptions: {
					show: {
						operation: ['getMessages', 'getMessage', 'markAsRead', 'markAsUnread', 'deleteMessage', 'moveMessage'],
					},
				},
				testedBy: 'imapConnectionTest',
			},
			{
				name: 'smtpCredentials',
				required: true,
				displayOptions: {
					show: {
						operation: ['sendEmail'],
					},
				},
				testedBy: 'smtpConnectionTest',
			},
		],
		properties: [
			// ── Operation ──────────────────────────────────────────────────
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Delete Message',
						value: 'deleteMessage',
						description: 'Permanently delete a message from the mailbox',
						action: 'Delete a message',
					},
					{
						name: 'Get Many Messages',
						value: 'getMessages',
						description: 'Fetch multiple messages from a mailbox',
						action: 'Get many messages',
					},
					{
						name: 'Get Message',
						value: 'getMessage',
						description: 'Get the full content of a specific message by UID',
						action: 'Get a message',
					},
					{
						name: 'Mark as Read',
						value: 'markAsRead',
						description: 'Mark a message as read (add \\Seen flag)',
						action: 'Mark a message as read',
					},
					{
						name: 'Mark as Unread',
						value: 'markAsUnread',
						description: 'Mark a message as unread (remove \\Seen flag)',
						action: 'Mark a message as unread',
					},
					{
						name: 'Move Message',
						value: 'moveMessage',
						description: 'Move a message to another mailbox folder',
						action: 'Move a message',
					},
					{
						name: 'Send Email',
						value: 'sendEmail',
						description: 'Send an email via SMTP',
						action: 'Send an email',
					},
				],
				default: 'getMessages',
			},

			// ── Shared IMAP: Mailbox ───────────────────────────────────────
			{
				displayName: 'Mailbox',
				name: 'mailbox',
				type: 'string',
				default: 'INBOX',
				required: true,
				displayOptions: {
					show: {
						operation: ['getMessages', 'getMessage', 'markAsRead', 'markAsUnread', 'deleteMessage', 'moveMessage'],
					},
				},
				description: 'The mailbox folder to operate on (e.g. INBOX, Sent, Drafts, Trash)',
			},

			// ── getMessages ────────────────────────────────────────────────
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 1000 },
				default: 10,
				displayOptions: { show: { operation: ['getMessages'] } },
				description: 'Maximum number of messages to return (most recent first)',
			},
			{
				displayName: 'Only Unread',
				name: 'onlyUnread',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['getMessages'] } },
				description: 'Whether to return only unread messages',
			},
			{
				displayName: 'Include Body',
				name: 'includeBody',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['getMessages'] } },
				description: 'Whether to include full message body and attachments metadata. Disable for faster envelope-only fetches.',
			},

			// ── Shared IMAP: mark as read on fetch ─────────────────────────
			{
				displayName: 'Mark as Read After Fetch',
				name: 'markAsReadOnFetch',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['getMessages', 'getMessage'] } },
				description: 'Whether to mark fetched messages as read automatically',
			},

			// ── getMessage / markAsRead / markAsUnread / deleteMessage / moveMessage: UID
			{
				displayName: 'Message UID',
				name: 'uid',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['getMessage', 'markAsRead', 'markAsUnread', 'deleteMessage', 'moveMessage'],
					},
				},
				description:
					'The unique identifier (UID) of the message. Can be a single UID (e.g. 42), a range (e.g. 1:10), or a comma-separated list (e.g. 1,2,5).',
				placeholder: '42',
			},

			// ── moveMessage: destination ───────────────────────────────────
			{
				displayName: 'Destination Mailbox',
				name: 'destination',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['moveMessage'] } },
				description: 'Target mailbox folder (e.g. Archive, Trash, "My Folder")',
				placeholder: 'Archive',
			},

			// ── sendEmail ──────────────────────────────────────────────────
			{
				displayName: 'From',
				name: 'from',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['sendEmail'] } },
				placeholder: 'sender@example.com',
				description: 'Sender email address. Can include display name: "Name <email@example.com>".',
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['sendEmail'] } },
				placeholder: 'recipient@example.com',
				description: 'Recipient email address(es). Separate multiple addresses with commas.',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['sendEmail'] } },
				description: 'Subject line of the email',
			},
			{
				displayName: 'Text Body',
				name: 'text',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				displayOptions: { show: { operation: ['sendEmail'] } },
				description: 'Plain-text body of the email',
			},
			{
				displayName: 'HTML Body',
				name: 'html',
				type: 'string',
				typeOptions: { rows: 5 },
				default: '',
				displayOptions: { show: { operation: ['sendEmail'] } },
				description: 'HTML body of the email. When provided, HTML-capable clients will display it instead of the plain-text body.',
			},
			{
				displayName: 'CC',
				name: 'cc',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['sendEmail'] } },
				placeholder: 'cc@example.com',
				description: 'CC recipient(s), comma-separated',
			},
			{
				displayName: 'BCC',
				name: 'bcc',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['sendEmail'] } },
				placeholder: 'bcc@example.com',
				description: 'BCC recipient(s), comma-separated',
			},
			{
				displayName: 'Reply-To',
				name: 'replyTo',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['sendEmail'] } },
				placeholder: 'reply@example.com',
				description: 'Address that replies should be sent to (if different from From)',
			},
		],
	};

	// ── Credential tests ───────────────────────────────────────────────────

	methods = {
		credentialTest: {
			async imapConnectionTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const client = buildImapClient(credential.data as Record<string, unknown>);
				try {
					await client.connect();
					await client.logout();
					return { status: 'OK', message: 'IMAP connection successful' };
				} catch (error) {
					return { status: 'Error', message: (error as Error).message };
				}
			},

			async smtpConnectionTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const transporter = buildSmtpTransport(credential.data as Record<string, unknown>);
				try {
					await transporter.verify();
					transporter.close();
					return { status: 'OK', message: 'SMTP connection successful' };
				} catch (error) {
					return { status: 'Error', message: (error as Error).message };
				}
			},
		},
	};

	// ── Execute ────────────────────────────────────────────────────────────

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;

		// ── SMTP path ──────────────────────────────────────────────────────
		if (operation === 'sendEmail') {
			const smtpCredentials = await this.getCredentials('smtpCredentials');
			const transporter = buildSmtpTransport(smtpCredentials as Record<string, unknown>);

			try {
				for (let i = 0; i < items.length; i++) {
					try {
						const from = this.getNodeParameter('from', i) as string;
						const to = this.getNodeParameter('to', i) as string;
						const subject = this.getNodeParameter('subject', i) as string;
						const text = (this.getNodeParameter('text', i, '') as string) || undefined;
						const html = (this.getNodeParameter('html', i, '') as string) || undefined;
						const cc = (this.getNodeParameter('cc', i, '') as string) || undefined;
						const bcc = (this.getNodeParameter('bcc', i, '') as string) || undefined;
						const replyTo = (this.getNodeParameter('replyTo', i, '') as string) || undefined;

						const info = await transporter.sendMail({ from, to, subject, text, html, cc, bcc, replyTo });

						returnData.push({
							json: {
								success: true,
								messageId: info.messageId,
								accepted: info.accepted,
								rejected: info.rejected,
								response: info.response,
							},
							pairedItem: i,
						});
					} catch (error) {
						if (this.continueOnFail()) {
							returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
						} else {
							throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
						}
					}
				}
			} finally {
				transporter.close();
			}

			return [returnData];
		}

		// ── IMAP path ──────────────────────────────────────────────────────
		const imapCredentials = await this.getCredentials('imapCredentials');
		const client = buildImapClient(imapCredentials as Record<string, unknown>);

		try {
			await client.connect();

			for (let i = 0; i < items.length; i++) {
				try {
					const mailbox = this.getNodeParameter('mailbox', i) as string;
					let results: Record<string, unknown>[] = [];

					if (operation === 'getMessages') {
						results = await opGetMessages(this, client, mailbox, i);
					} else if (operation === 'getMessage') {
						results = await opGetMessage(this, client, mailbox, i);
					} else if (operation === 'markAsRead') {
						results = await opMarkFlag(this, client, mailbox, i, 'add', '\\Seen');
					} else if (operation === 'markAsUnread') {
						results = await opMarkFlag(this, client, mailbox, i, 'remove', '\\Seen');
					} else if (operation === 'deleteMessage') {
						results = await opDeleteMessage(this, client, mailbox, i);
					} else if (operation === 'moveMessage') {
						results = await opMoveMessage(this, client, mailbox, i);
					}

					for (const json of results) {
						returnData.push({ json: json as IDataObject, pairedItem: i });
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnData.push({ json: { error: (error as Error).message }, pairedItem: i });
					} else {
						throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
					}
				}
			}
		} finally {
			await client.logout().catch(() => {});
		}

		return [returnData];
	}
}
