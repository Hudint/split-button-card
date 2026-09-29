// JavaScript templates in button-card syntax: `[[[ return entity.state; ]]]`.
// The code runs with the same variables button-card provides, so existing
// templates can be copied over unchanged.
import { html } from "lit";
import type { HassEntity, HomeAssistant } from "./types";

type TemplateFn = (
  states: HomeAssistant["states"],
  entity: HassEntity | undefined,
  user: unknown,
  hass: HomeAssistant,
  variables: Record<string, unknown>,
  htmlTag: typeof html
) => unknown;

const TEMPLATE = /^\s*\[\[\[([\s\S]*)\]\]\]\s*$/;

const cache = new Map<string, TemplateFn | null>();

export const isTemplate = (value: unknown): value is string =>
  typeof value === "string" && TEMPLATE.test(value);

const compile = (code: string): TemplateFn | null => {
  if (!cache.has(code)) {
    try {
      cache.set(
        code,
        new Function(
          "states",
          "entity",
          "user",
          "hass",
          "variables",
          "html",
          `'use strict'; ${code}`
        ) as TemplateFn
      );
    } catch (err) {
      console.warn("split-button-card: invalid template", err, code);
      cache.set(code, null);
    }
  }
  return cache.get(code) ?? null;
};

/** Returns the template result, or the value unchanged if it is no template. */
export const renderTemplate = <T>(
  value: T,
  hass: HomeAssistant | undefined,
  entity: HassEntity | undefined
): T | unknown => {
  if (!isTemplate(value) || !hass) return value;
  const fn = compile(TEMPLATE.exec(value)![1]);
  if (!fn) return undefined;
  try {
    return fn(hass.states, entity, hass.user, hass, {}, html);
  } catch (err) {
    console.warn("split-button-card: template error", err);
    return undefined;
  }
};
