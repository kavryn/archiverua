import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// Route segment config
export const alt = SITE_NAME;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Fonts are bundled in the repo (Cyrillic-subset Montserrat) and read from disk,
// so the build never depends on a live Google Fonts request.
const fontsDir = join(process.cwd(), "src/app/_fonts");

export default async function Image() {
  const [logo, bold, semibold] = await Promise.all([
    readFile(join(process.cwd(), "public/logo.svg")),
    readFile(join(fontsDir, "Montserrat-Bold.woff")),
    readFile(join(fontsDir, "Montserrat-SemiBold.woff")),
  ]);
  // Satori can't read a file path, so inline the shared logo as a data URI.
  const logoDataUri = `data:image/svg+xml;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: 80,
          background: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoDataUri} width={252} height={280} alt="" style={{ flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div
            style={{
              fontFamily: "Montserrat",
              fontWeight: 700,
              fontSize: 84,
              color: "#0f172a",
              lineHeight: 1.05,
            }}
          >
            {SITE_NAME}
          </div>
          <div
            style={{
              fontFamily: "Montserrat",
              fontWeight: 600,
              fontSize: 34,
              color: "#475569",
              marginTop: 24,
              lineHeight: 1.35,
            }}
          >
            {SITE_TAGLINE}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Montserrat", data: bold, weight: 700, style: "normal" },
        { name: "Montserrat", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
