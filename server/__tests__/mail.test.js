import { describe, expect, it } from 'vitest';
import { resetEmail } from '../utils/mail.js';

describe('reset email', () => {
    it('puts the link verbatim in subject-bearing text and html bodies', () => {
        const link = 'https://teslastudio.online/?reset=abc123';
        const mail = resetEmail(link);
        expect(mail.subject).toMatch(/password/i);
        expect(mail.text).toContain(link);
        expect(mail.html).toContain(`href="${link}"`);
        expect(mail.text).toMatch(/hour/);
    });
});
