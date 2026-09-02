/** Mail through Resend's HTTPS API. No key: the link is logged instead (never in production). */

const FROM = process.env.MAIL_FROM || 'Tesla Studio <onboarding@resend.dev>';

function resetEmail(link) {
    return {
        subject: 'Reset your Tesla Studio password',
        text: `Someone asked to reset the password for your Tesla Studio account.\n\nOpen this link within one hour to choose a new password:\n${link}\n\nIf that was not you, ignore this email; your password stays as it is.`,
        html: `<p>Someone asked to reset the password for your Tesla Studio account.</p><p>Open this link within one hour to choose a new password:</p><p><a href="${link}">${link}</a></p><p>If that was not you, ignore this email; your password stays as it is.</p>`,
    };
}

async function sendMail({ to, subject, text, html }) {
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        if (process.env.NODE_ENV === 'production') {
            console.error(`RESEND_API_KEY is not set; mail to ${to} ("${subject}") was not sent.`);
        } else {
            console.warn(`RESEND_API_KEY is not set; mail to ${to} would have said:\n${text}`);
        }
        return { sent: false };
    }
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to, subject, text, html }),
    });
    if (!res.ok) {
        throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return { sent: true, id: (await res.json()).id };
}

module.exports = { resetEmail, sendMail };
