import type { JSX } from "preact/jsx-runtime";
import type { Component } from 'preact';
import { JSXInternal } from "preact/src/jsx";

declare namespace React {
  type ReactNode = JSX.Element | string | number | Component | boolean | null | undefined;
  type Style = string | JSXInternal.CSSProperties | JSXInternal.SignalLike<string | JSXInternal.CSSProperties> | undefined
}
