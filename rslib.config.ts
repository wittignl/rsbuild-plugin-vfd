import { defineConfig } from "@rslib/core";

export default defineConfig({
    source: {
        entry: {
            index: "./src/ts/index.ts"
        }
    },
    output: {
        cleanDistPath: true
    },
    lib: [
        {
            format: "esm",
            syntax: ["node 18"],
            dts: true
        },
        {
            format: "cjs",
            syntax: ["node 18"]
        }
    ]
});
