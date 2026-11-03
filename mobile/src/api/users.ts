import { api } from "./client";
import type { DeviceToken } from "../types";

export async function registerPushToken(
  token: string,
  platform?: string
): Promise<DeviceToken> {
  const { data } = await api.post<{ device_token: DeviceToken }>(
    "/api/users/me/push-token",
    { token, platform }
  );
  return data.device_token;
}
