import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  { ignores: ["main.js", "preload.js"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // 빌드 시 사용하지 않는 변수로 인한 실패 방지 (경고로만 표시)
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
];

export default eslintConfig;
