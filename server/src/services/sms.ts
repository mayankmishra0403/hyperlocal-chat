import { config } from "../config";

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(phone: string, message: string) {
    console.log(`[SMS] To: ${phone} | Body: ${message}`);
  }
}

class AndroidSmsGatewayProvider implements SmsProvider {
  private apiBase: string;
  private auth: string;

  constructor() {
    this.apiBase = config.smsGateway.apiBase;
    this.auth = btoa(`${config.smsGateway.username}:${config.smsGateway.password}`);
  }

  async send(phone: string, message: string) {
    console.log(`[SMS] To: ${phone} | Body: ${message}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${this.apiBase}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${this.auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumbers: [phone],
        textMessage: { text: message },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      const body = await res.text();
      console.error(`SMS Gateway API error (${res.status}): ${body}`);
    } else {
      console.log(`SMS sent successfully`);
    }
  }
}

class TextBeeSmsProvider implements SmsProvider {
  private apiKey: string;
  private deviceId: string;
  private apiBase: string;

  constructor() {
    this.apiKey = config.textbee.apiKey;
    this.deviceId = config.textbee.deviceId;
    this.apiBase = config.textbee.apiBase;
  }

  async send(phone: string, message: string) {
    console.log(`[SMS] To: ${phone} | Body: ${message}`);

    const url = `${this.apiBase}/api/v1/gateway/devices/${this.deviceId}/send-sms`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify({
        recipients: [phone],
        message,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`TextBee API error (${res.status}): ${body}`);
    }
  }
}

function getProvider(): SmsProvider {
  switch (config.smsProvider) {
    case "smsgateway":
      return new AndroidSmsGatewayProvider();
    case "textbee":
      return new TextBeeSmsProvider();
    case "console":
    default:
      return new ConsoleSmsProvider();
  }
}

export const sms = getProvider();
