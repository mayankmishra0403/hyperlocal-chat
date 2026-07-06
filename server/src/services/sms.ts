import { config } from "../config";

export interface SmsProvider {
  send(phone: string, message: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  async send(phone: string, message: string) {
    console.log(`[SMS] To: ${phone} | Body: ${message}`);
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
    case "textbee":
      return new TextBeeSmsProvider();
    case "console":
    default:
      return new ConsoleSmsProvider();
  }
}

export const sms = getProvider();
