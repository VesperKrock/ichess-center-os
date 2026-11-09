import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
base: "/ichess-center-os/",
build: {
  rolldownOptions: {
    input: {
      main: fileURLToPath(new URL("./index.html", import.meta.url)),
      handbook: fileURLToPath(new URL("./handbook/index.html", import.meta.url)),
    },
  },
},
});
