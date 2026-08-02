import { describe, it, expect, vi, afterEach } from "vitest";
import { escapeCsvCell, toCsv, downloadCsv, monthRange } from "./csv";

describe("escapeCsvCell", () => {
  it("passes plain values through", () => {
    expect(escapeCsvCell("Ada")).toBe("Ada");
    expect(escapeCsvCell(2500)).toBe("2500");
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("keeps a zero rather than blanking it", () => {
    expect(escapeCsvCell(0)).toBe("0");
  });

  it("quotes values containing a comma", () => {
    expect(escapeCsvCell("Bright Stars, Ikeja")).toBe('"Bright Stars, Ikeja"');
  });

  it("doubles embedded quotes", () => {
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("quotes values containing newlines", () => {
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });
});

describe("toCsv", () => {
  it("writes a header row then the data rows, CRLF separated", () => {
    const csv = toCsv(
      ["Date", "Student", "Amount"],
      [
        ["2026-02-01", "Ada", 25000],
        ["2026-02-02", "Bode, Jr", 10000],
      ],
    );
    expect(csv).toBe(
      'Date,Student,Amount\r\n2026-02-01,Ada,25000\r\n2026-02-02,"Bode, Jr",10000',
    );
  });

  it("emits just the header when there are no rows", () => {
    expect(toCsv(["A", "B"], [])).toBe("A,B");
  });
});

describe("monthRange", () => {
  it("spans the whole month inclusively", () => {
    const { from, to } = monthRange(2026, 1); // February
    expect(from).toBe("2026-02-01T00:00:00.000Z");
    expect(to).toBe("2026-02-28T23:59:59.999Z");
  });

  it("handles a leap February", () => {
    expect(monthRange(2028, 1).to).toBe("2028-02-29T23:59:59.999Z");
  });

  it("handles December without rolling the year", () => {
    const { from, to } = monthRange(2026, 11);
    expect(from).toBe("2026-12-01T00:00:00.000Z");
    expect(to).toBe("2026-12-31T23:59:59.999Z");
  });
});

describe("downloadCsv", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a blob URL and clicks a download anchor", () => {
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    (URL as unknown as Record<string, unknown>).createObjectURL =
      createObjectURL;
    (URL as unknown as Record<string, unknown>).revokeObjectURL =
      revokeObjectURL;
    const clicks: string[] = [];
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    };

    const ok = downloadCsv("ledger.csv", "A,B\r\n1,2");

    HTMLAnchorElement.prototype.click = orig;
    expect(ok).toBe(true);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:x");
    expect(clicks).toEqual(["ledger.csv"]);
  });

  it("leaves no anchor behind in the document", () => {
    (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(
      () => "blob:x",
    );
    (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {};

    downloadCsv("ledger.csv", "A,B");

    HTMLAnchorElement.prototype.click = orig;
    expect(document.querySelectorAll("a[download]").length).toBe(0);
  });

  it("reports failure instead of pretending when Blob support is missing", () => {
    const originalBlob = globalThis.Blob;
    // @ts-expect-error deliberately removing platform support
    delete globalThis.Blob;

    expect(downloadCsv("ledger.csv", "A,B")).toBe(false);

    globalThis.Blob = originalBlob;
  });

  it("reports failure when createObjectURL is unavailable", () => {
    const original = URL.createObjectURL;
    delete (URL as unknown as Record<string, unknown>).createObjectURL;

    expect(downloadCsv("ledger.csv", "A,B")).toBe(false);

    (URL as unknown as Record<string, unknown>).createObjectURL = original;
  });
});
