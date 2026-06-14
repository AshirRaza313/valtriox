import { readFileSync } from "fs";
import { join } from "path";

// Font buffers loaded from .b64 files at runtime (avoids webpack parse stack overflow)
const fontsDir = join(process.cwd(), "fonts");

export const FONT_REGULAR = Buffer.from(
  readFileSync(join(fontsDir, "font-regular.b64"), "utf-8"),
  "base64"
);

export const FONT_BOLD = Buffer.from(
  readFileSync(join(fontsDir, "font-bold.b64"), "utf-8"),
  "base64"
);

export const FONT_ITALIC = Buffer.from(
  readFileSync(join(fontsDir, "font-italic.b64"), "utf-8"),
  "base64"
);

export const FONT_BOLD_ITALIC = Buffer.from(
  readFileSync(join(fontsDir, "font-bold-italic.b64"), "utf-8"),
  "base64"
);