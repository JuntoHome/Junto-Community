import { describe, expect, it } from "vitest";
import { MAX_WORKBOOK_BYTES, WORKBOOK_FILE_MESSAGES, checkWorkbookFile } from "./check-file";

/** The 4 bytes every .xlsx (a ZIP archive) starts with. */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/** A file of `size` bytes, starting with the ZIP signature unless `zip` is false. */
function fakeFile(name: string, size: number, zip = true): File {
  const bytes = new Uint8Array(size);
  if (zip) bytes.set(ZIP_SIGNATURE.slice(0, size));
  return new File([bytes], name);
}

describe("checkWorkbookFile", () => {
  it("refuses an empty file", async () => {
    const result = await checkWorkbookFile(fakeFile("Test.xlsx", 0));
    expect(result).toEqual({ ok: false, code: "empty", message: WORKBOOK_FILE_MESSAGES.empty });
  });

  it("refuses a file over 2 MB, and accepts one of exactly 2 MB", async () => {
    expect(MAX_WORKBOOK_BYTES).toBe(2 * 1024 * 1024);
    const tooLarge = await checkWorkbookFile(fakeFile("Test.xlsx", MAX_WORKBOOK_BYTES + 1));
    expect(tooLarge).toEqual({ ok: false, code: "tooLarge", message: WORKBOOK_FILE_MESSAGES.tooLarge });
    const atLimit = await checkWorkbookFile(fakeFile("Test.xlsx", MAX_WORKBOOK_BYTES));
    expect(atLimit.ok).toBe(true);
  });

  it("refuses a .csv file by its name, even with ZIP bytes", async () => {
    const result = await checkWorkbookFile(fakeFile("Test.csv", 100));
    expect(result).toEqual({ ok: false, code: "extension", message: WORKBOOK_FILE_MESSAGES.extension });
  });

  it("refuses a file named .xlsx that doesn't start with the ZIP signature", async () => {
    const notZip = new File([new TextEncoder().encode("Record ID,Company\nTST-0001,Test Company 01\n")], "Test.xlsx");
    const result = await checkWorkbookFile(notZip);
    expect(result).toEqual({ ok: false, code: "signature", message: WORKBOOK_FILE_MESSAGES.signature });
  });

  it("accepts an uppercase .XLSX name", async () => {
    const file = fakeFile("TEST.XLSX", 100);
    const result = await checkWorkbookFile(file);
    expect(result).toEqual({ ok: true, file });
  });

  it("asks for exactly one file", async () => {
    const one = fakeFile("Test.xlsx", 100);
    expect((await checkWorkbookFile([])).ok).toBe(false);
    expect(await checkWorkbookFile([one, one])).toMatchObject({ ok: false, code: "count" });
    expect(await checkWorkbookFile(null)).toMatchObject({ ok: false, code: "count" });
    expect(await checkWorkbookFile([one])).toEqual({ ok: true, file: one });
  });
});
