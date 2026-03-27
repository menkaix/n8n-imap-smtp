"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailImap = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const imapflow_1 = require("imapflow");
const nodemailer = __importStar(require("nodemailer"));
const mailparser_1 = require("mailparser");
function buildImapClient(credentials) {
    return new imapflow_1.ImapFlow({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        auth: {
            user: credentials.user,
            pass: credentials.password,
        },
        tls: {
            rejectUnauthorized: !credentials.allowUnauthorizedCerts,
        },
        logger: false,
    });
}
function buildSmtpTransport(credentials) {
    return nodemailer.createTransport({
        host: credentials.host,
        port: credentials.port,
        secure: credentials.secure,
        requireTLS: credentials.requireTLS,
        auth: {
            user: credentials.user,
            pass: credentials.password,
        },
        tls: {
            rejectUnauthorized: !credentials.allowUnauthorizedCerts,
        },
    });
}
function formatAddresses(addrs) {
    if (!addrs)
        return [];
    return addrs.map((a) => { var _a, _b; return ({ name: (_a = a.name) !== null && _a !== void 0 ? _a : '', address: (_b = a.address) !== null && _b !== void 0 ? _b : '' }); });
}
async function opGetMessages(executeFns, client, mailbox, itemIndex) {
    var _a, _b, _c;
    const limit = executeFns.getNodeParameter('limit', itemIndex);
    const onlyUnread = executeFns.getNodeParameter('onlyUnread', itemIndex);
    const includeBody = executeFns.getNodeParameter('includeBody', itemIndex);
    const markAsReadOnFetch = executeFns.getNodeParameter('markAsReadOnFetch', itemIndex);
    const lock = await client.getMailboxLock(mailbox);
    const messages = [];
    try {
        const searchCriteria = onlyUnread ? { seen: false } : {};
        const uids = await client.search(searchCriteria, { uid: true });
        const limitedUids = (uids || []).slice(-limit);
        if (limitedUids.length === 0)
            return [];
        const fetchQuery = {
            envelope: true,
            flags: true,
            internalDate: true,
            size: true,
            uid: true,
        };
        if (includeBody)
            fetchQuery.source = true;
        for await (const msg of client.fetch(limitedUids, fetchQuery, { uid: true })) {
            const data = {
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
                const parsed = await (0, mailparser_1.simpleParser)(msg.source);
                data.text = (_a = parsed.text) !== null && _a !== void 0 ? _a : '';
                data.html = (_b = parsed.html) !== null && _b !== void 0 ? _b : '';
                data.attachments = ((_c = parsed.attachments) !== null && _c !== void 0 ? _c : []).map((a) => {
                    var _a;
                    return ({
                        filename: (_a = a.filename) !== null && _a !== void 0 ? _a : '',
                        contentType: a.contentType,
                        size: a.size,
                    });
                });
            }
            messages.push(data);
        }
        if (markAsReadOnFetch && limitedUids.length > 0) {
            await client.messageFlagsAdd(limitedUids, ['\\Seen'], { uid: true });
        }
    }
    finally {
        lock.release();
    }
    return messages;
}
async function opGetMessage(executeFns, client, mailbox, itemIndex) {
    var _a, _b, _c;
    const uid = executeFns.getNodeParameter('uid', itemIndex);
    const markAsReadOnFetch = executeFns.getNodeParameter('markAsReadOnFetch', itemIndex);
    const lock = await client.getMailboxLock(mailbox);
    const messages = [];
    try {
        for await (const msg of client.fetch(uid, { envelope: true, source: true, flags: true, internalDate: true, size: true, uid: true }, { uid: true })) {
            const data = {
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
                const parsed = await (0, mailparser_1.simpleParser)(msg.source);
                data.text = (_a = parsed.text) !== null && _a !== void 0 ? _a : '';
                data.html = (_b = parsed.html) !== null && _b !== void 0 ? _b : '';
                data.attachments = ((_c = parsed.attachments) !== null && _c !== void 0 ? _c : []).map((a) => {
                    var _a;
                    return ({
                        filename: (_a = a.filename) !== null && _a !== void 0 ? _a : '',
                        contentType: a.contentType,
                        size: a.size,
                        content: a.content.toString('base64'),
                    });
                });
                const headersObj = {};
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
    }
    finally {
        lock.release();
    }
    return messages;
}
async function opMarkFlag(executeFns, client, mailbox, itemIndex, action, flag) {
    const uid = executeFns.getNodeParameter('uid', itemIndex);
    const lock = await client.getMailboxLock(mailbox);
    try {
        if (action === 'add') {
            await client.messageFlagsAdd(uid, [flag], { uid: true });
        }
        else {
            await client.messageFlagsRemove(uid, [flag], { uid: true });
        }
    }
    finally {
        lock.release();
    }
    return [{ success: true, uid, flag, action, mailbox }];
}
async function opDeleteMessage(executeFns, client, mailbox, itemIndex) {
    const uid = executeFns.getNodeParameter('uid', itemIndex);
    const lock = await client.getMailboxLock(mailbox);
    try {
        await client.messageDelete(uid, { uid: true });
    }
    finally {
        lock.release();
    }
    return [{ success: true, uid, mailbox, operation: 'deleted' }];
}
async function opMoveMessage(executeFns, client, mailbox, itemIndex) {
    const uid = executeFns.getNodeParameter('uid', itemIndex);
    const destination = executeFns.getNodeParameter('destination', itemIndex);
    const lock = await client.getMailboxLock(mailbox);
    try {
        await client.messageMove(uid, destination, { uid: true });
    }
    finally {
        lock.release();
    }
    return [{ success: true, uid, from: mailbox, to: destination, operation: 'moved' }];
}
class EmailImap {
    constructor() {
        this.description = {
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
            inputs: [n8n_workflow_1.NodeConnectionTypes.Main],
            outputs: [n8n_workflow_1.NodeConnectionTypes.Main],
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
                {
                    displayName: 'Mark as Read After Fetch',
                    name: 'markAsReadOnFetch',
                    type: 'boolean',
                    default: false,
                    displayOptions: { show: { operation: ['getMessages', 'getMessage'] } },
                    description: 'Whether to mark fetched messages as read automatically',
                },
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
                    description: 'The unique identifier (UID) of the message. Can be a single UID (e.g. 42), a range (e.g. 1:10), or a comma-separated list (e.g. 1,2,5).',
                    placeholder: '42',
                },
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
        this.methods = {
            credentialTest: {
                async imapConnectionTest(credential) {
                    const client = buildImapClient(credential.data);
                    try {
                        await client.connect();
                        await client.logout();
                        return { status: 'OK', message: 'IMAP connection successful' };
                    }
                    catch (error) {
                        return { status: 'Error', message: error.message };
                    }
                },
                async smtpConnectionTest(credential) {
                    const transporter = buildSmtpTransport(credential.data);
                    try {
                        await transporter.verify();
                        transporter.close();
                        return { status: 'OK', message: 'SMTP connection successful' };
                    }
                    catch (error) {
                        return { status: 'Error', message: error.message };
                    }
                },
            },
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const operation = this.getNodeParameter('operation', 0);
        if (operation === 'sendEmail') {
            const smtpCredentials = await this.getCredentials('smtpCredentials');
            const transporter = buildSmtpTransport(smtpCredentials);
            try {
                for (let i = 0; i < items.length; i++) {
                    try {
                        const from = this.getNodeParameter('from', i);
                        const to = this.getNodeParameter('to', i);
                        const subject = this.getNodeParameter('subject', i);
                        const text = this.getNodeParameter('text', i, '') || undefined;
                        const html = this.getNodeParameter('html', i, '') || undefined;
                        const cc = this.getNodeParameter('cc', i, '') || undefined;
                        const bcc = this.getNodeParameter('bcc', i, '') || undefined;
                        const replyTo = this.getNodeParameter('replyTo', i, '') || undefined;
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
                    }
                    catch (error) {
                        if (this.continueOnFail()) {
                            returnData.push({ json: { error: error.message }, pairedItem: i });
                        }
                        else {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex: i });
                        }
                    }
                }
            }
            finally {
                transporter.close();
            }
            return [returnData];
        }
        const imapCredentials = await this.getCredentials('imapCredentials');
        const client = buildImapClient(imapCredentials);
        try {
            await client.connect();
            for (let i = 0; i < items.length; i++) {
                try {
                    const mailbox = this.getNodeParameter('mailbox', i);
                    let results = [];
                    if (operation === 'getMessages') {
                        results = await opGetMessages(this, client, mailbox, i);
                    }
                    else if (operation === 'getMessage') {
                        results = await opGetMessage(this, client, mailbox, i);
                    }
                    else if (operation === 'markAsRead') {
                        results = await opMarkFlag(this, client, mailbox, i, 'add', '\\Seen');
                    }
                    else if (operation === 'markAsUnread') {
                        results = await opMarkFlag(this, client, mailbox, i, 'remove', '\\Seen');
                    }
                    else if (operation === 'deleteMessage') {
                        results = await opDeleteMessage(this, client, mailbox, i);
                    }
                    else if (operation === 'moveMessage') {
                        results = await opMoveMessage(this, client, mailbox, i);
                    }
                    for (const json of results) {
                        returnData.push({ json: json, pairedItem: i });
                    }
                }
                catch (error) {
                    if (this.continueOnFail()) {
                        returnData.push({ json: { error: error.message }, pairedItem: i });
                    }
                    else {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, { itemIndex: i });
                    }
                }
            }
        }
        finally {
            await client.logout().catch(() => { });
        }
        return [returnData];
    }
}
exports.EmailImap = EmailImap;
//# sourceMappingURL=EmailImap.node.js.map