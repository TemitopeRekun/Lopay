import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SchoolSetupScreen from "./SchoolSetupScreen";
import { BackendAPI } from "../services/backend";

const navigate = vi.fn();
const showToast = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../services/backend", () => ({
  BackendAPI: {
    school: {
      getMyFees: vi.fn(),
      setMyFees: vi.fn(),
    },
  },
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Ada Bursar" } }),
}));

vi.mock("../store/uiStore", () => ({
  useUIStore: () => ({ showToast }),
}));

vi.mock("../components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const renderScreen = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <SchoolSetupScreen />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const waitForForm = async () =>
  waitFor(() => expect(screen.getAllByLabelText("Class name").length).toBeGreaterThan(0));

const typeClass = async (
  user: ReturnType<typeof userEvent.setup>,
  index: number,
  name: string,
  fee: string,
) => {
  const names = screen.getAllByLabelText("Class name");
  const fees = screen.getAllByLabelText("Term fee");
  await user.type(names[index], name);
  await user.type(fees[index], fee);
};

describe("SchoolSetupScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(BackendAPI.school.getMyFees).mockResolvedValue([]);
    vi.mocked(BackendAPI.school.setMyFees).mockResolvedValue([] as never);
  });

  it("greets a school with no fees as first-run setup", async () => {
    renderScreen();
    await waitForForm();
    expect(screen.getByText("Step 1 of 1 · Setup")).toBeInTheDocument();
    expect(screen.getByText("Welcome, Ada")).toBeInTheDocument();
  });

  it("publishes the whole schedule in ONE request", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await typeClass(user, 0, "JSS1", "120000");
    await user.click(screen.getByText("Add another class"));
    await typeClass(user, 1, "JSS2", "150000");

    await user.click(screen.getByRole("button", { name: /Publish/ }));

    // One call, not one per class — the old screen looped with 2.5s sleeps.
    await waitFor(() =>
      expect(BackendAPI.school.setMyFees).toHaveBeenCalledTimes(1),
    );
    expect(BackendAPI.school.setMyFees).toHaveBeenCalledWith([
      { className: "JSS1", feeAmount: 120000 },
      { className: "JSS2", feeAmount: 150000 },
    ]);
  });

  it("sends the owner to their dashboard once fees exist", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await typeClass(user, 0, "JSS1", "120000");
    await user.click(screen.getByRole("button", { name: /Publish/ }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith("/school-owner-dashboard", {
        replace: true,
      }),
    );
  });

  it("lets the school name its own classes, not just the suggestions", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await typeClass(user, 0, "Montessori Upper", "75000");
    await user.click(screen.getByRole("button", { name: /Publish/ }));

    await waitFor(() =>
      expect(BackendAPI.school.setMyFees).toHaveBeenCalledWith([
        { className: "Montessori Upper", feeAmount: 75000 },
      ]),
    );
  });

  it("quick-add fills the blank row rather than leaving a gap", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await user.click(screen.getByRole("button", { name: "+ JSS1" }));

    const names = screen.getAllByLabelText("Class name");
    expect(names).toHaveLength(1);
    expect(names[0]).toHaveValue("JSS1");
  });

  it("drops a class from quick-add once it is in use", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await user.click(screen.getByRole("button", { name: "+ JSS1" }));
    expect(
      screen.queryByRole("button", { name: "+ JSS1" }),
    ).not.toBeInTheDocument();
  });

  it("cannot publish with nothing filled in", async () => {
    renderScreen();
    await waitForForm();
    expect(screen.getByRole("button", { name: /Publish/ })).toBeDisabled();
  });

  it("refuses a class with a name but no fee", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await typeClass(user, 0, "JSS1", "100");
    await user.click(screen.getByText("Add another class"));
    // Second row has a name but no fee — publishing would silently drop it.
    await user.type(screen.getAllByLabelText("Class name")[1], "JSS2");

    await user.click(screen.getByRole("button", { name: /Publish/ }));

    expect(showToast).toHaveBeenCalledWith(
      "Give every class both a name and a fee.",
      "warning",
    );
    expect(BackendAPI.school.setMyFees).not.toHaveBeenCalled();
  });

  it("blocks a duplicated class name", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await typeClass(user, 0, "JSS1", "100");
    await user.click(screen.getByText("Add another class"));
    await typeClass(user, 1, "jss1", "200");

    await waitFor(() =>
      expect(screen.getByText('"jss1" is listed twice')).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: /Publish/ })).toBeDisabled();
  });

  it("rejects non-numeric fee input", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await user.type(screen.getAllByLabelText("Term fee")[0], "12a3b");
    expect(screen.getAllByLabelText("Term fee")[0]).toHaveValue("123");
  });

  it("never leaves the form with no row to type into", async () => {
    const user = userEvent.setup();
    renderScreen();
    await waitForForm();

    await user.click(screen.getByLabelText("Remove class"));
    expect(screen.getAllByLabelText("Class name")).toHaveLength(1);
  });

  it("edits the existing schedule instead of starting over", async () => {
    vi.mocked(BackendAPI.school.getMyFees).mockResolvedValue([
      { className: "JSS1", feeAmount: 120000 },
      { className: "JSS2", feeAmount: 150000 },
    ]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText("Update your fees")).toBeInTheDocument(),
    );
    const names = screen.getAllByLabelText("Class name");
    expect(names[0]).toHaveValue("JSS1");
    expect(names[1]).toHaveValue("JSS2");
    // Not framed as onboarding once a schedule exists.
    expect(screen.queryByText("Step 1 of 1 · Setup")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save changes/ })).toBeEnabled();
  });

  it("surfaces a publish failure instead of claiming success", async () => {
    const user = userEvent.setup();
    vi.mocked(BackendAPI.school.setMyFees).mockRejectedValue(
      new Error("Server exploded"),
    );

    renderScreen();
    await waitForForm();

    await typeClass(user, 0, "JSS1", "100");
    await user.click(screen.getByRole("button", { name: /Publish/ }));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(
        expect.stringContaining("Server exploded"),
        "error",
      ),
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
