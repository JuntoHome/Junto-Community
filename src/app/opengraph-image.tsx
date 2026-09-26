import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Junto Community Alliance. Learn Something. Meet Someone. At the Library.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default social share image for every page: the stacked logo on ivory. */
export default async function OpenGraphImage() {
  const logo = await readFile(join(process.cwd(), "public/jca-logo-stacked.png"), "base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FBF8F1",
        }}
      >
        <img src={`data:image/png;base64,${logo}`} alt="" width={560} height={560} />
      </div>
    ),
    size,
  );
}
