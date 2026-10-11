/**
 * A form for a model's parameters, generated from their JSON Schema: sliders for bounded
 * numbers, checkboxes for booleans, selects for enums, text fields for strings.
 */
import type { ParameterJsonSchema, ParametersJsonSchema } from '@tscad/modeling';

export type ParameterForm = {
  /** Shows `schema` (rebuilding fields only if it changed) with the given values. */
  update(schema: ParametersJsonSchema, values: Record<string, unknown>): void;
};

/** Values echoed back by the server don't overwrite a field edited within this time. */
const EDIT_GRACE_MS = 1000;

export function createParameterForm(
  panel: HTMLElement,
  onChange: (values: Record<string, unknown>) => void,
): ParameterForm {
  const fields = panel.querySelector<HTMLElement>('.fields')!;
  let current: Record<string, unknown> = {};
  let renderedSchema = '';
  const setters = new Map<string, (value: unknown) => void>();
  const editedAt = new Map<string, number>();

  const edit = (key: string, value: unknown) => {
    current = { ...current, [key]: value };
    editedAt.set(key, performance.now());
    onChange(current);
  };

  panel.querySelector<HTMLButtonElement>('.reset')!.addEventListener('click', () => {
    current = {};
    editedAt.clear();
    onChange(current); // empty: every parameter takes its default
  });

  return {
    update(schema, values) {
      const signature = JSON.stringify(schema);
      if (signature !== renderedSchema) {
        renderedSchema = signature;
        fields.replaceChildren();
        setters.clear();
        for (const [key, property] of Object.entries(schema.properties ?? {})) {
          const { element, set } = field(key, property, (value) => edit(key, value));
          fields.append(element);
          setters.set(key, set);
        }
      }
      const now = performance.now();
      current = { ...values };
      for (const [key, set] of setters) {
        if (now - (editedAt.get(key) ?? -Infinity) > EDIT_GRACE_MS) set(values[key]);
      }
      panel.hidden = setters.size === 0;
    },
  };
}

/** One labelled input for a parameter, plus a setter to show a value from the server. */
function field(
  key: string,
  property: ParameterJsonSchema,
  onInput: (value: unknown) => void,
): { element: HTMLElement; set: (value: unknown) => void } {
  const element = document.createElement('label');
  element.className = 'field';
  element.innerHTML = `<span class="name"></span>`;
  element.querySelector('.name')!.textContent = key;
  if (property.description) element.title = property.description;

  const types = new Set([property.type ?? []].flat());
  const add = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    attributes: Record<string, string> = {},
  ) => {
    const input = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) input.setAttribute(name, value);
    element.append(input);
    return input;
  };

  if (property.enum) {
    const select = add('select');
    for (const option of property.enum)
      select.append(
        new Option(
          typeof option === 'string' ? option : JSON.stringify(option),
          JSON.stringify(option),
        ),
      );
    select.addEventListener('change', () => onInput(JSON.parse(select.value)));
    return { element, set: (value) => (select.value = JSON.stringify(value)) };
  }

  if (types.has('boolean')) {
    element.classList.add('inline');
    const checkbox = add('input', { type: 'checkbox' });
    checkbox.addEventListener('change', () => onInput(checkbox.checked));
    return { element, set: (value) => (checkbox.checked = value === true) };
  }

  if (types.has('integer') || types.has('number')) {
    const min = property.minimum ?? property.exclusiveMinimum;
    const max = property.maximum ?? property.exclusiveMaximum;
    const step = types.has('integer')
      ? 1
      : typeof property.multipleOf === 'number'
        ? property.multipleOf
        : min !== undefined && max !== undefined
          ? niceStep((max - min) / 100)
          : 'any';
    const bounds = {
      ...(min !== undefined && { min: String(min) }),
      ...(max !== undefined && { max: String(max) }),
      step: String(step),
    };
    const number = add('input', { type: 'number', ...bounds });
    // A slider only makes sense with both bounds.
    const range =
      min !== undefined && max !== undefined
        ? add('input', { type: 'range', ...bounds })
        : undefined;
    element.classList.toggle('ranged', !!range);
    const send = (raw: string) => raw !== '' && !Number.isNaN(Number(raw)) && onInput(Number(raw));
    number.addEventListener('input', () => {
      if (range) range.value = number.value;
      send(number.value);
    });
    if (range) {
      range.addEventListener('input', () => {
        number.value = range.value;
        send(range.value);
      });
    }
    return {
      element,
      set: (value) => {
        number.value = value === undefined ? '' : String(value);
        if (range && value !== undefined) range.value = String(value);
      },
    };
  }

  if (types.has('string')) {
    const text = add('input', { type: 'text' });
    text.addEventListener('change', () => onInput(text.value));
    return { element, set: (value) => (text.value = value === undefined ? '' : String(value)) };
  }

  // Arrays, objects, …: shown, not editable (yet).
  const readOnly = add('input', { type: 'text', disabled: '' });
  return { element, set: (value) => (readOnly.value = JSON.stringify(value)) };
}

/** 1, 2 or 5 × 10^n closest above `raw`, for slider steps. */
function niceStep(raw: number): number {
  const exponent = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * exponent).find((step) => step >= raw)!;
}
