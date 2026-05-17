export type KeyboardShortcut = {
  label: string;
  ariaKeyShortcuts: string;
};

const SHORTCUT_BLOCKED_TARGET_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "summary",
  "textarea",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[role='combobox']",
  "[role='menuitemcheckbox']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='textbox']",
].join(",");

function isShortcutBlockedTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest(SHORTCUT_BLOCKED_TARGET_SELECTOR));
}

function hasSystemModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

export function shouldIgnoreShortcutEvent(event: KeyboardEvent): boolean {
  return event.isComposing || hasSystemModifier(event) || isShortcutBlockedTarget(event.target);
}

export function runShortcutOnce(event: KeyboardEvent, callback: () => void): void {
  event.preventDefault();

  if (!event.repeat) {
    callback();
  }
}
