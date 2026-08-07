import type { WorkbenchApi } from "../shared/types";

declare global {
  interface Window {
    h3: WorkbenchApi;
  }
}

export {};
