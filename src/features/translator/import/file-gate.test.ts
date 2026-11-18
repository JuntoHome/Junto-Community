import { readFileSync } from "node:fs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { PUBLIC_RS_SAMPLE_PATH, PUBLIC_SAMPLE_PATH, RS_SAMPLE_PATH, SAMPLE_PATH } from "../__fixtures__/records";
import { ALLOWED_WORKBOOKS } from "./allowlist";
import { FILE_GATE_MESSAGES, checkAllowlist, sha256Hex } from "./file-gate";
import { parseWorkbook } from "./parse";

const SAMPLE_SHA256 = "67a510867ed6c7273cfebabea5c6895e43bd2cae2c98395acd09146ba6ed580b";

const RS_SAMPLE_SHA256 = "ebf0a966b5548fe683f91b94c2a44a6a5f33d4a3274ab3aa217e57e4e4185eeb";

const readSample = () => toArrayBuffer(readFileSync(SAMPLE_PATH));
const readRsSample = () => toArrayBuffer(readFileSync(RS_SAMPLE_PATH));

/**
 * A copy of the sample with exactly one cell changed: the first number cell in the Contacts
 * sheet (an Employees value) gets 1 added. Only that cell's XML changes; the ZIP is rebuilt.
 */
async function sampleWithOneCellChanged(): Promise<ArrayBuffer> {
  const zip = await JSZip.loadAsync(readSample());
  const sheetPath = "xl/worksheets/sheet1.xml";
  const xml = await zip.file(sheetPath)!.async("string");
  // A number cell is either untyped or t="n", and holds its value in <v>: <c r="I2" t="n"><v>25</v></c>.
  const numberCell = /<c r="([A-Z]+\d+)"(?![^>]*\bt="(?!n")[^"]*")[^>]*><v>(\d+)<\/v><\/c>/;
  const match = numberCell.exec(xml);
  if (!match) throw new Error("No number cell found in the sample's first sheet");
  const changed = xml.replace(match[0], match[0].replace(`<v>${match[2]}</v>`, `<v>${Number(match[2]) + 1}</v>`));
  zip.file(sheetPath, changed);
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("checkAllowlist (file gate)", () => {
  it("accepts the synthetic sample", async () => {
    const result = await checkAllowlist(readSample());
    expect(result).toMatchObject({ ok: true, entry: { fileName: "JCA_Synthetic_Contacts.xlsx", layout: "synthetic" } });
  });

  it("accepts the Load sample copy in public/, which must be byte-identical", async () => {
    expect(await sha256Hex(toArrayBuffer(readFileSync(PUBLIC_SAMPLE_PATH)))).toBe(SAMPLE_SHA256);
  });

  it("refuses a copy of the sample with one cell changed", async () => {
    const changed = await sampleWithOneCellChanged();

    // The copy is still a readable workbook that differs from the sample in exactly one cell.
    const [before, after] = await Promise.all([parseWorkbook(readSample()), parseWorkbook(changed)]);
    if (!before.ok || !after.ok) throw new Error("Both workbooks should parse");
    const differing = before.workbook.rows.flatMap((row, i) =>
      row.sourceValues.filter((value, column) => value !== after.workbook.rows[i].sourceValues[column]),
    );
    expect(differing).toHaveLength(1);

    const result = await checkAllowlist(changed);
    expect(result).toEqual({ ok: false, code: "notAllowed", message: FILE_GATE_MESSAGES.notAllowed });
  });

  it("accepts the Reference Solutions layout sample (TR-35) and its byte-identical copy in public/", async () => {
    const result = await checkAllowlist(readRsSample());
    expect(result).toMatchObject({
      ok: true,
      entry: { fileName: "JCA_Synthetic_RS_Layout.xlsx", layout: "reference-solutions" },
    });
    expect(await sha256Hex(toArrayBuffer(readFileSync(PUBLIC_RS_SAMPLE_PATH)))).toBe(RS_SAMPLE_SHA256);
  });

  it("allowlists exactly the expected workbooks, so no test fixture can be added unnoticed", () => {
    expect(ALLOWED_WORKBOOKS.map(({ sha256, fileName, layout }) => ({ sha256, fileName, layout }))).toEqual([
      { sha256: SAMPLE_SHA256, fileName: "JCA_Synthetic_Contacts.xlsx", layout: "synthetic" },
      { sha256: RS_SAMPLE_SHA256, fileName: "JCA_Synthetic_RS_Layout.xlsx", layout: "reference-solutions" },
    ]);
  });
});
