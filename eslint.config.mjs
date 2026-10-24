import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Editorial images are authored with explicit dimensions and arbitrary remote hosts;
      // next/image's host allow-listing does not fit a CMS where editors choose image URLs.
      "@next/next/no-img-element": "off",
    },
  },
];
