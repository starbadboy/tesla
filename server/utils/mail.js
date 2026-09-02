/** Mail through Resend's HTTPS API. */

const FROM = process.env.MAIL_FROM || 'Tesla Studio <onboarding@resend.dev>';

const escapeHtml = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function resetEmail(link) {
    const safe = escapeHtml(link);
    return {
        subject: 'Reset your Tesla Studio password',
        text: `Someone asked to reset the password for your Tesla Studio account.\n\nOpen this link within one hour to choose a new password:\n${link}\n\nIf that was not you, ignore this email; your password stays as it is.`,
        html: `<p>Someone asked to reset the password for your Tesla Studio account.</p><p>Open this link within one hour to choose a new password:</p><p><a href="${safe}">${safe}</a></p><p>If that was not you, ignore this email; your password stays as it is.</p>`,
    };
}

/**
 * Without an API key nothing is sent. The full text (which carries the live link) is
 * logged only when NODE_ENV is explicitly "development"; anywhere else only the recipient.
 */
async function sendMail({ to, subject, text, html }) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        if (process.env.NODE_ENV === 'development') {
            console.warn(`RESEND_API_KEY is not set; mail to ${to} would have said:\n${text}`);
        } else {
            console.error(`RESEND_API_KEY is not set; mail to ${to} ("${subject}") was not sent.`);
        }
        return { sent: false };
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to, subject, text, html }),
        signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
        throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const { id } = await res.json();
    console.log(`Mail "${subject}" accepted by Resend as ${id}`);
    return { sent: true, id };
}

module.exports = { resetEmail, sendMail };
