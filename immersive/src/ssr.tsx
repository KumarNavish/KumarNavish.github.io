import { renderToPipeableStream } from "react-dom/server";
import { PassThrough } from "node:stream";
import { App } from "./App";
export { metadata, cleanPath, ALIASES } from "./navigation";
export { EXHIBITS } from "./data/exhibits";
export function render(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = new PassThrough();
    let html = "";
    stream.on("data", (chunk) => {
      html += chunk.toString();
    });
    stream.on("end", () => resolve(html));
    stream.on("error", reject);
    const result = renderToPipeableStream(<App initialPath={path} />, {
      onAllReady() {
        result.pipe(stream);
      },
      onShellError: reject,
      onError: reject,
    });
  });
}
