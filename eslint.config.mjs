import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  {
    ignores: [".next/**", "node_modules/**", "**/._*"],
  },
  ...nextVitals,
];

export default config;
