export function otpEmail(params: {
  code: string;
  brand: string;
  minutes: number;
}) {
  const { code, brand, minutes } = params;

  const text = `Your ${brand} verification code is ${code}. It expires in ${minutes} minutes. If you did not request this, ignore this email.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 8px;font-size:20px;color:#0f172a;">Verify your email</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#475569;">
          Use this code to finish creating your ${brand} account.
        </p>
        <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;background:#f1f5f9;border-radius:12px;padding:16px;text-align:center;">
          ${code}
        </div>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
          The code expires in ${minutes} minutes. If you didn't request it, you can safely ignore this email.
        </p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { text, html };
}
