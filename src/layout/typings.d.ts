import type { JSX } from "preact/jsx-runtime";
import type { Component } from 'preact';

declare namespace React {
  type ReactNode = JSX.Element | string | number | Component | boolean | null | undefined;
}
