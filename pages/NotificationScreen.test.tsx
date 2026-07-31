import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import NotificationScreen from "./NotificationScreen";
import type { Notification } from "../types";

const notifications: Notification[] = [];
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const navigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../context/DataContext", () => ({
  useData: () => ({
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
  }),
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../components/BottomNav", () => ({ BottomNav: () => null }));

const notif = (over: Partial<Notification> = {}): Notification => ({
  id: "n1",
  type: "payment",
  title: "Payment Confirmed",
  message: "Your payment was confirmed.",
  timestamp: new Date().toISOString(),
  read: false,
  ...over,
});

const renderScreen = () =>
  render(
    <MemoryRouter>
      <NotificationScreen />
    </MemoryRouter>,
  );

beforeEach(() => {
  notifications.length = 0;
  vi.clearAllMocks();
});

describe("NotificationScreen — filters", () => {
  it("puts a platform broadcast under Announcements, not Payments", async () => {
    // Every row used to be typed "payment" client-side, so Announcements was
    // permanently empty and broadcasts appeared under Payments.
    const user = userEvent.setup();
    notifications.push(
      notif({ id: "pay", type: "payment", title: "Payment Confirmed" }),
      notif({ id: "ann", type: "announcement", title: "Term Resumes Monday" }),
    );
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Announcements" }));
    expect(screen.getByText("Term Resumes Monday")).toBeInTheDocument();
    expect(screen.queryByText("Payment Confirmed")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Payments" }));
    expect(screen.getByText("Payment Confirmed")).toBeInTheDocument();
    expect(screen.queryByText("Term Resumes Monday")).not.toBeInTheDocument();
  });

  it("counts an alert as a payment-related notification", async () => {
    const user = userEvent.setup();
    notifications.push(notif({ type: "alert", title: "Payment Defaulted" }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Payments" }));
    expect(screen.getByText("Payment Defaulted")).toBeInTheDocument();
  });

  it("shows everything under All", () => {
    notifications.push(
      notif({ id: "a", type: "announcement", title: "Notice" }),
      notif({ id: "b", type: "payment", title: "Payment Confirmed" }),
    );
    renderScreen();

    expect(screen.getByText("Notice")).toBeInTheDocument();
    expect(screen.getByText("Payment Confirmed")).toBeInTheDocument();
  });
});

describe("NotificationScreen — timestamps", () => {
  it("never shows the raw ISO createdAt", () => {
    notifications.push(notif({ timestamp: "2026-06-15T14:35:00.000Z" }));
    renderScreen();

    expect(screen.queryByText(/2026-06-15T14:35/)).not.toBeInTheDocument();
    expect(screen.getByText("15 Jun")).toBeInTheDocument();
  });

  it("reads relatively for something that just happened", () => {
    notifications.push(
      notif({ timestamp: new Date(Date.now() - 5 * 60_000).toISOString() }),
    );
    renderScreen();

    expect(screen.getByText("5m ago")).toBeInTheDocument();
  });
});

describe("NotificationScreen — deep links", () => {
  it("navigates to the linked screen when the reader taps View", async () => {
    // The `link` the backend writes was stored and never used — opening a
    // notification only ever showed a modal.
    const user = userEvent.setup();
    notifications.push(notif({ link: "/history", read: true }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Payment Confirmed/ }));
    await user.click(screen.getByRole("button", { name: "View" }));

    expect(navigate).toHaveBeenCalledWith("/history");
  });

  it("offers no View for a notification with no link", async () => {
    const user = userEvent.setup();
    notifications.push(notif({ link: undefined, read: true }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Payment Confirmed/ }));

    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("offers no View for a route this reader cannot open", async () => {
    // Links are written for whichever audience the notification targets, so a
    // parent can receive one pointing at a school-owner screen. Navigating there
    // would bounce off the route guard.
    const user = userEvent.setup();
    notifications.push(notif({ link: "/school/pending-payments", read: true }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Payment Confirmed/ }));

    expect(screen.queryByRole("button", { name: "View" })).not.toBeInTheDocument();
    expect(navigate).not.toHaveBeenCalled();
  });
});

describe("NotificationScreen — read state", () => {
  it("marks an unread notification read when opened", async () => {
    const user = userEvent.setup();
    notifications.push(notif({ read: false }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Payment Confirmed/ }));

    expect(markNotificationRead).toHaveBeenCalledWith("n1");
  });

  it("does not re-mark an already-read notification", async () => {
    const user = userEvent.setup();
    notifications.push(notif({ read: true }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: /Payment Confirmed/ }));

    expect(markNotificationRead).not.toHaveBeenCalled();
  });

  it("marks all read in a single request", async () => {
    const user = userEvent.setup();
    notifications.push(notif({ id: "a", read: false }), notif({ id: "b", read: false }));
    renderScreen();

    await user.click(screen.getByRole("button", { name: "more_vert" }));
    await user.click(screen.getByRole("button", { name: /Mark all as read/ }));

    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1);
    expect(markNotificationRead).not.toHaveBeenCalled();
  });
});
