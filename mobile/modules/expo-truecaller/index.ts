import { requireNativeModule } from "expo-modules-core";

const ExpoTruecaller = requireNativeModule("ExpoTruecaller");

export interface TruecallerResult {
  requestId: string;
  phoneNumber: string;
}

export function verifyTruecaller(): Promise<TruecallerResult> {
  return ExpoTruecaller.verify();
}
