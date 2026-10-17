#!/bin/sh
# screenpipe — AI that knows everything you've seen, said, or heard
# https://screenpipe.com

# Runs INSIDE the n8n container; reset.ts passes it to `docker exec … sh -c`.
# Marks every unread message of $MAILBOX read, with the IMAP credential
# $CRED_ID already stored in n8n, so the next activation of the demo Flow only
# processes the email sent live. The decrypted credential only exists in a
# private temp dir removed on exit, and nothing here prints it.
# Last line on stdout: {"marked":<n>,"unread":<n left>}.
set -eu
umask 077
: "${CRED_ID:?CRED_ID is required}"
mailbox="${MAILBOX:-INBOX}"
pnpm_dir="${N8N_PNPM_DIR:-/usr/local/lib/node_modules/n8n/node_modules/.pnpm}"

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
trap 'exit 130' INT TERM
cred="$dir/credential.json"

if ! out="$(n8n export:credentials --id="$CRED_ID" --decrypted --output="$cred" 2>&1)" || [ ! -s "$cred" ]; then
  reason="$(printf '%s\n' "$out" | grep -v -i -e password -e '"data"' | tail -n 3)"
  echo "cannot export the n8n credential $CRED_ID: $reason" >&2
  exit 3
fi

imapflow="$(ls -d "$pnpm_dir"/imapflow@*/node_modules/imapflow 2>/dev/null | tail -n 1)"
if [ -z "$imapflow" ]; then
  echo "imapflow not found under $pnpm_dir" >&2
  exit 4
fi

CRED_FILE="$cred" IMAPFLOW="$imapflow" MAILBOX="$mailbox" node - <<'JS'
const fs = require("fs");
const { ImapFlow } = require(process.env.IMAPFLOW);
const exported = JSON.parse(fs.readFileSync(process.env.CRED_FILE, "utf8"));
fs.rmSync(process.env.CRED_FILE, { force: true });
const data = (Array.isArray(exported) ? exported[0] : exported)?.data ?? {};
// n8n leaves defaults out of the stored data: port 993, TLS on.
const client = new ImapFlow({
  host: data.host,
  port: Number(data.port ?? 993),
  secure: data.secure ?? true,
  auth: { user: data.user, pass: data.password },
  tls: { rejectUnauthorized: !data.allowUnauthorizedCerts },
  logger: false,
});
const fail = error => {
  console.error(`IMAP: ${error?.message ?? error}${error?.responseText ? ` (${error.responseText})` : ""}`);
  process.exit(5);
};
client.on("error", fail);
const unseen = async () => (await client.search({ seen: false }, { uid: true })) || [];
(async () => {
  await client.connect();
  const lock = await client.getMailboxLock(process.env.MAILBOX);
  let marked = 0;
  let unread = 0;
  try {
    const uids = await unseen();
    if (uids.length) await client.messageFlagsAdd(uids, ["\\Seen"], { uid: true });
    marked = uids.length;
    unread = (await unseen()).length;
  } finally {
    lock.release();
  }
  await client.logout();
  console.log(JSON.stringify({ marked, unread }));
})().catch(fail);
JS
