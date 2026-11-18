import type { JSX, Component, CSSProperties, SignalLike } from "preact";

declare namespace React {
  type ReactNode = JSX.Element | string | number | Component | boolean | null | undefined;
  type Style = string | CSSProperties | SignalLike<CSSProperties> | undefined
}
