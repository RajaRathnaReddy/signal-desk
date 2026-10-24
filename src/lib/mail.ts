import nodemailer from "nodemailer";
import { siteUrl } from "./seo";
import { SITE_NAME } from "./constants";

export const mailConfigured = () => !!process.env.SMTP_URL;

/** Sends the double-opt-in confirmation. Returns false when SMTP is not configured, so the UI can say so honestly. */
export async function sendConfirmation(email: string, token: string, names: string[]): Promise<boolean> {
  if (!process.env.SMTP_URL) return false;
  const link = `${siteUrl()}/confirm?token=${encodeURIComponent(token)}`;
  const t = nodemailer.createTransport(process.env.SMTP_URL);
  await t.sendMail({
    from: process.env.MAIL_FROM || `${SITE_NAME} <no-reply@localhost>`,
    to: email,
    subject: `Confirm your ${SITE_NAME} subscription`,
    text: `You asked to receive: ${names.join(", ")}.\n\nConfirm by opening this link:\n${link}\n\nIf you did not ask for this, ignore this message and nothing will be sent.`,
  });
  return true;
}
