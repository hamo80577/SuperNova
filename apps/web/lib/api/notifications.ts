import { apiRequest } from "./request";
import type { PageMeta } from "./organization";

export interface NotificationItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list(params: { page?: number; pageSize?: number; unreadOnly?: boolean } = {}) {
    const query = new URLSearchParams();
    if (params.page) query.set("page", String(params.page));
    if (params.pageSize) query.set("pageSize", String(params.pageSize));
    if (params.unreadOnly !== undefined) {
      query.set("unreadOnly", String(params.unreadOnly));
    }

    return apiRequest<{ items: NotificationItem[]; meta: PageMeta }>(
      `/notifications${query.toString() ? `?${query}` : ""}`
    );
  },
  markRead(id: string) {
    return apiRequest<NotificationItem>(`/notifications/${id}/read`, {
      method: "PATCH",
      body: JSON.stringify({})
    });
  },
  markAllRead() {
    return apiRequest<{ count: number }>("/notifications/read-all", {
      method: "PATCH",
      body: JSON.stringify({})
    });
  }
};
