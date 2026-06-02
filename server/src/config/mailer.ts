import nodemailer from 'nodemailer';
export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
export async function sendMail(opts: { to: string; subject: string; html: string }): Promise<void> {
  await transporter.sendMail({ from: process.env.EMAIL_FROM || 'noreply@pm.app', ...opts });
}
