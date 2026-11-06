export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  isComplete: boolean;
}

export enum ConnectionState {
  DISCONNECTED = "disconnected",
  CONNECTING = "connecting",
  CONNECTED = "connected",
  ERROR = "error",
}

export interface StreamConfig {
  videoOn: boolean;
  micOn: boolean;
  facingMode: "user" | "environment";
}
