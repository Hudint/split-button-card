import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const dev = process.env.ROLLUP_WATCH === "true";

export default {
  input: "src/split-button-card.ts",
  output: {
    file: "dist/split-button-card.js",
    format: "es",
    inlineDynamicImports: true,
  },
  plugins: [
    nodeResolve(),
    typescript(),
    !dev && terser({ format: { comments: false } }),
  ],
};
