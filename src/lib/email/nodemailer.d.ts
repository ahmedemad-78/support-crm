declare module "nodemailer" {
  import type { ConnectionOptions } from "node:tls";

  export interface SendMailOptions {
    from?: string;
    to?: string;
    subject?: string;
    html?: string;
    text?: string;
  }

  export interface SentMessageInfo {
    messageId: string;
  }

  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<SentMessageInfo>;
  }

  export interface TransportOptions {
    host?: string;
    port?: number;
    secure?: boolean;
    requireTLS?: boolean;
    auth?: { user?: string; pass?: string };
    tls?: ConnectionOptions;
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
  }

  export function createTransport(options: TransportOptions): Transporter;
}
