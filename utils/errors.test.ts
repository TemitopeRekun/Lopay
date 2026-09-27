import { describe, it, expect } from "vitest";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("reads .message off an Error", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns a non-empty string as-is", () => {
    expect(getErrorMessage("nope")).toBe("nope");
  });

  it("reads a string .message off a plain object (e.g. an API body)", () => {
    expect(getErrorMessage({ message: "api said no" })).toBe("api said no");
  });

  it("falls back for null / empty / non-string-message values", () => {
    expect(getErrorMessage(null)).toBe("Something went wrong");
    expect(getErrorMessage({}, "fallback")).toBe("fallback");
    expect(getErrorMessage("", "fb")).toBe("fb");
    expect(getErrorMessage({ message: 123 }, "fb")).toBe("fb");
  });
});

/**
 * The server's own words have to reach the user.
 *
 * An axios error is an `Error`, and its `message` is "Request failed with
 * status code 400". Checking `instanceof Error` first therefore replaced every
 * hand-written API refusal with a status code — invisibly, because a message
 * still appeared, it was merely the useless one.
 */
describe("getErrorMessage — API refusals", () => {
  const axiosError = (data: unknown, status = 400) => {
    const error = new Error(`Request failed with status code ${status}`);
    (error as unknown as { response: unknown }).response = { status, data };
    return error;
  };

  it("prefers the API's message over axios's status-code string", () => {
    expect(
      getErrorMessage(
        axiosError({
          statusCode: 400,
          message: "Your migration window has closed.",
        }),
      ),
    ).toBe("Your migration window has closed.");
  });

  it("shows a parent why their invite link failed, not a status code", () => {
    // The case that made this worth fixing: the message is written on the
    // server, next to the rule, and is the only thing that tells them what to
    // do next.
    expect(
      getErrorMessage(
        axiosError(
          {
            message:
              "This invite link is not valid. It may have expired or already been used — ask your school to send a new one.",
          },
          404,
        ),
      ),
    ).toMatch(/ask your school to send a new one/);
  });

  it("joins a ValidationPipe's array of field errors", () => {
    // Nest returns `message: string[]`. Showing only the first sends someone
    // round the loop again for the second.
    expect(
      getErrorMessage(
        axiosError({ message: ["reason should not be empty", "closesAt must be a Date"] }),
      ),
    ).toBe("reason should not be empty. closesAt must be a Date");
  });

  it("falls back to the API's `error` field when there is no message", () => {
    expect(getErrorMessage(axiosError({ error: "Forbidden" }, 403))).toBe(
      "Forbidden",
    );
  });

  it("handles a plain-text body from a proxy", () => {
    expect(getErrorMessage(axiosError("Bad Gateway", 502))).toBe("Bad Gateway");
  });

  it("ignores an empty message rather than showing a blank toast", () => {
    expect(getErrorMessage(axiosError({ message: "   " }))).toBe(
      "Request failed with status code 400",
    );
  });

  it("still handles a network error, which has no response at all", () => {
    const offline = new Error("Network Error");
    expect(getErrorMessage(offline)).toBe("Network Error");
  });

  it("still falls back when there is nothing usable anywhere", () => {
    expect(getErrorMessage({}, "Could not save")).toBe("Could not save");
  });
});
