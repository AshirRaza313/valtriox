// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { NotificationCenter } from "../components/brandflow/shared/NotificationCenter";

vi.mock("@/store/brandflow-store", () => ({
  useValtrioxStore: (selector?: any) => {
    if (selector) return selector({ organization: { id: "org-1" }, appTheme: "light" });
    return { organization: { id: "org-1" }, appTheme: "light", setActiveSection: vi.fn() };
  },
}));

vi.mock("@/lib/i18n", () => ({
  useTranslation: () => (key: string, fallback?: any) => fallback || key,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("NotificationCenter markAllRead double-failure rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it("rolls back optimistic zero when mutation and refetch both fail", async () => {
    const fetchMock = globalThis.fetch as any;

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({
        notifications: [
          { id: "n1", title: "Test", message: "msg", type: "info", read: false, createdAt: new Date().toISOString(), userId: "user-1" },
          { id: "n2", title: "Test2", message: "msg2", type: "info", read: false, createdAt: new Date().toISOString(), userId: null },
        ],
        unreadCount: 2,
      }),
    }));

    render(<NotificationCenter />);

    const bellButton = document.getElementById("notification-bell-btn")!;
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(screen.getByText("Test")).toBeTruthy();
      expect(screen.getByText("2 unread")).toBeTruthy();
    });

    fetchMock.mockImplementationOnce(async () => ({ ok: false, json: async () => ({}) }));
    fetchMock.mockImplementationOnce(async () => { throw new Error("Network error"); });

    const markAllButtons = screen.getAllByText(/Mark all read/i);
    fireEvent.click(markAllButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("2 unread")).toBeTruthy();
    });

    const unreadDots = document.querySelectorAll('span.h-2.w-2.rounded-full');
    expect(unreadDots.length).toBe(2);
  });

  it("rolls back when mutation 500 and refetch 403", async () => {
    const fetchMock = globalThis.fetch as any;

    fetchMock.mockImplementationOnce(async () => ({
      ok: true,
      json: async () => ({
        notifications: [
          { id: "n1", title: "Test", message: "msg", type: "info", read: false, createdAt: new Date().toISOString(), userId: "user-1" },
        ],
        unreadCount: 1,
      }),
    }));

    render(<NotificationCenter />);
    const bell = document.getElementById("notification-bell-btn")!;
    fireEvent.click(bell);

    await waitFor(() => expect(screen.getByText("Test")).toBeTruthy());

    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 403, json: async () => ({}) }));

    const markAll = screen.getAllByText(/Mark all read/i)[0];
    fireEvent.click(markAll);

    await waitFor(() => expect(screen.getByText("1 unread")).toBeTruthy());
  });
});
