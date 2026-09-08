# Verify a sending domain in Resend + your DNS host

Use this when `MAIL_PROVIDER=resend` on `prescope-submit` (`prescope-submit` is the technical Worker service name — keep it). The From: address (`MAIL_FROM`) must use a domain you verify in Resend. Do not commit real domains, API keys, or DNS values.

**Leave existing inbound email as it is.** Do not turn on Resend **Receiving** unless you intend to change how mail is delivered. Do not change an existing MX row that already delivers company mail.

Placeholders below use `example.com`. Substitute your sending domain.

---

## 1. Resend

Open [resend.com/domains](https://resend.com/domains).

1. Click **Domains**, then **Add Domain**.
2. Type `example.com` (your domain). Leave **Receiving** off. Click **Add Domain**.
3. Open **Records**. Copy the rows Resend shows (typically MX + TXT on `send`, and TXT on `resend._domainkey`). Values are unique to your Resend account — do not invent them.

---

## 2. Your DNS host

Open DNS management for `example.com` at whatever host holds the zone (Cloudflare, GoDaddy, Route 53, and so on).

Add the records Resend listed. **Name** is only the host Resend gives (`send` or `resend._domainkey`) — not `example.com` and not `send.example.com` unless your DNS UI requires a fully qualified name. TTL: 600 or the host default.

| Type | Name | Value | Priority |
|------|------|-------|----------|
| MX | send | *(paste from Resend)* | 10 |
| TXT | send | *(paste from Resend)* | |
| TXT | resend._domainkey | *(paste from Resend)* | |

Save. Do not edit the existing mail MX that already delivers inbound mail.

---

## 3. Back in Resend

After DNS is saved, click **Verify DNS Records**. Wait until the domain shows **Verified**, then set Worker secrets:

```
npx wrangler secret put MAIL_FROM
npx wrangler secret put MAIL_API_KEY
npx wrangler secret put ASSESSOR_MAILBOX
```

`MAIL_FROM` example: `Scoping <intake@example.com>`. `ASSESSOR_MAILBOX` may be comma- or semicolon-separated. Never commit live values.

---

## Email you can send to whoever owns DNS

```
Subject: Please add 3 DNS records on example.com

DNS host → example.com → DNS / zone editor.
Add these 3 records. Do not change the inbound email MX that is already there.
In Name, type only send or resend._domainkey (not example.com).

Type | Name              | Value              | Priority
MX   | send              |                    | 10
TXT  | send              |                    |
TXT  | resend._domainkey |                    |

Reply when saved so we can click Verify in Resend.
```
