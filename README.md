# n8n-nodes-imap-smtp

A community node for [n8n](https://n8n.io) that enables reading and sending emails using **IMAP** and **SMTP** protocols.

## Features

| Operation | Protocol | Description |
|---|---|---|
| **Get Many Messages** | IMAP | Fetch multiple messages from a mailbox with optional filters |
| **Get Message** | IMAP | Get the full content (body, headers, attachments) of a specific message |
| **Mark as Read** | IMAP | Add the `\Seen` flag to a message |
| **Mark as Unread** | IMAP | Remove the `\Seen` flag from a message |
| **Delete Message** | IMAP | Permanently delete a message |
| **Move Message** | IMAP | Move a message to another mailbox folder |
| **Send Email** | SMTP | Send an email with plain-text and/or HTML body |

## Installation

> **Self-hosted only.** Community node installation requires a self-hosted n8n instance (not available on n8n Cloud for unverified packages).

### Via npm registry (recommended)

In your n8n instance go to **Settings → Community Nodes → Install**, accept the risk notice, and enter:

```
n8n-nodes-imap-smtp
```

### Via GitHub (not yet published to npm)

The n8n GUI only accepts npm package names — to install directly from this GitHub repository, use the command line.

#### Standard / npm global install

```bash
# Navigate to the n8n custom nodes directory (create it if needed)
mkdir -p ~/.n8n/nodes
cd ~/.n8n/nodes

# Install from GitHub (tarball — no SSH key required)
npm install https://github.com/menkaix/n8n-imap-smtp/archive/refs/heads/main.tar.gz

# Restart n8n
```

#### Docker (interactive shell)

```bash
# Open a shell in the running container
docker exec -it <container_name> sh

mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes
npm install https://github.com/menkaix/n8n-imap-smtp/archive/refs/heads/main.tar.gz

exit
docker restart <container_name>
```

#### Docker Compose

```bash
docker compose exec n8n sh -c \
  "mkdir -p ~/.n8n/nodes && cd ~/.n8n/nodes && npm install https://github.com/menkaix/n8n-imap-smtp/archive/refs/heads/main.tar.gz"
docker compose restart n8n
```

> **Why tarball and not `git+https://`?** Some environments (including the default n8n Docker image) have a git configuration that rewrites HTTPS GitHub URLs to SSH, causing a `Permission denied (publickey)` error. Installing via the `.tar.gz` tarball URL bypasses git entirely.
>
> **To install a specific branch or tag**, replace `main` with the branch/tag name in the URL, e.g. `.../archive/refs/heads/develop.tar.gz` or `.../archive/refs/tags/v1.0.0.tar.gz`.

### Manual build (from source)

```bash
git clone https://github.com/menkaix/n8n-imap-smtp.git
cd n8n-imap-smtp
npm install
npm run build

# Copy compiled output into n8n's custom directory
cp -r dist/* ~/.n8n/custom/
```

Then restart n8n.

## Credentials

### IMAP Credentials

| Field | Default | Description |
|---|---|---|
| Host | — | IMAP server hostname (e.g. `imap.gmail.com`) |
| Port | `993` | `993` for SSL/TLS, `143` for STARTTLS |
| Username | — | Email address or login |
| Password | — | Password or app-specific password |
| SSL/TLS | `true` | Enable direct TLS (port 993) |
| Allow Unauthorized Certs | `false` | Accept self-signed certificates (testing only) |

### SMTP Credentials

| Field | Default | Description |
|---|---|---|
| Host | — | SMTP server hostname (e.g. `smtp.gmail.com`) |
| Port | `587` | `587` for STARTTLS, `465` for SSL, `25` for plain |
| Username | — | Email address or login |
| Password | — | Password or app-specific password |
| SSL/TLS | `false` | Use direct SSL (port 465) |
| Require TLS (STARTTLS) | `true` | Force STARTTLS upgrade (port 587) |
| Allow Unauthorized Certs | `false` | Accept self-signed certificates (testing only) |

> **Gmail / Google Workspace:** Enable "App Passwords" in your Google account security settings and use the generated 16-character password.

> **Outlook / Microsoft 365:** Use OAuth2 or enable "Allow less secure apps" / app passwords depending on your tenant settings.

## Usage examples

### Fetch unread emails and send a reply

1. Add an **Email (IMAP/SMTP)** node, choose **Get Many Messages**, set *Only Unread* = `true`.
2. Add a second **Email (IMAP/SMTP)** node, choose **Send Email**, map `from`, `to` and `subject` from the first node's output.
3. Add a third **Email (IMAP/SMTP)** node, choose **Mark as Read**, map `uid` from step 1.

### Output data shape — `Get Message`

```json
{
  "uid": 42,
  "seq": 5,
  "flags": ["\\Seen"],
  "internalDate": "2024-01-15T10:30:00.000Z",
  "size": 3821,
  "subject": "Hello from n8n",
  "date": "2024-01-15T10:29:58.000Z",
  "messageId": "<abc123@mail.example.com>",
  "from": [{ "name": "Alice", "address": "alice@example.com" }],
  "to":   [{ "name": "Bob",   "address": "bob@example.com"   }],
  "cc":   [],
  "bcc":  [],
  "replyTo": [],
  "text": "Hello Bob,\n\nThis is a test.\n",
  "html": "<p>Hello Bob,</p><p>This is a test.</p>",
  "attachments": [
    { "filename": "report.pdf", "contentType": "application/pdf", "size": 51200, "content": "<base64>" }
  ],
  "headers": { "x-mailer": "n8n", "content-type": "multipart/alternative" }
}
```

## Development

```bash
# Install dependencies
npm install

# Build (outputs to dist/)
npm run build

# Watch mode
npm run dev

# Lint
npm run lint
npm run lint:fix
```

### Project structure

```
n8n-nodes-imap-smtp/
├── credentials/
│   ├── ImapCredentials.credentials.ts   # IMAP credential type
│   └── SmtpCredentials.credentials.ts   # SMTP credential type
├── nodes/
│   └── EmailImap/
│       ├── EmailImap.node.ts            # Node implementation
│       └── email.svg                    # Node icon
├── package.json
├── tsconfig.json
└── eslint.config.mjs
```

## Dependencies

| Package | Version | Purpose |
|---|---|---|
| [imapflow](https://imapflow.com/) | `^1.0` | Modern async IMAP client |
| [mailparser](https://nodemailer.com/extras/mailparser/) | `^3.7` | Parse raw RFC2822 messages |
| [nodemailer](https://nodemailer.com/) | `^6.9` | SMTP email sending |

## Sources — n8n Custom Node Documentation

The following official n8n documentation was referenced to build this node:

| Topic | URL |
|---|---|
| Overview — Creating nodes | https://docs.n8n.io/integrations/creating-nodes/overview/ |
| Choosing a build style (declarative vs programmatic) | https://docs.n8n.io/integrations/creating-nodes/plan/choose-node-method/ |
| Programmatic-style node tutorial | https://docs.n8n.io/integrations/creating-nodes/build/programmatic-style-node/ |
| Node base file reference | https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/ |
| Programmatic execute() method | https://docs.n8n.io/integrations/creating-nodes/build/reference/node-base-files/programmatic-style-execute-method/ |
| Credentials files reference | https://docs.n8n.io/integrations/creating-nodes/build/reference/credentials-files/ |
| Node UI elements reference | https://docs.n8n.io/integrations/creating-nodes/build/node-ui-elements/ |
| Submit community nodes | https://docs.n8n.io/integrations/creating-nodes/deploy/submit-community-nodes/ |
| Install private nodes | https://docs.n8n.io/integrations/creating-nodes/deploy/install-private-nodes/ |
| n8n-nodes-starter (template repo) | https://github.com/n8n-io/n8n-nodes-starter |

## License

[MIT](LICENSE)
