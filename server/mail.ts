import nodemailer, { type Transporter } from "nodemailer";
import { env } from "./env";

/** En pruebas los correos no salen: se guardan aquí para poder verificarlos. */
export const testOutbox: { to: string; subject: string; text: string }[] = [];

let transporter: Transporter | null = null;

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    testOutbox.push({ to, subject, text });
    return;
  }
  if (!env.smtpUrl) throw new Error("SMTP no configurado");
  transporter ??= nodemailer.createTransport(env.smtpUrl);
  await transporter.sendMail({ from: env.mailFrom, to, subject, text });
}
