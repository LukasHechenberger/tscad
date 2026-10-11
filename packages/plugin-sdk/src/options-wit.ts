/**
 * Turns a plugin's options schema (the JSON Schema its `info()` returns, derived from its Rust
 * options struct by schemars) into a WIT package with one record, `<plugin>-options`. Doc comments
 * carry the descriptions, defaults (`@defaultValue`) and ranges, so `jco types` can make a
 * documented TypeScript interface of it.
 */

type Schema = {
  $ref?: string;
  $defs?: Record<string, Schema>;
  type?: string | string[];
  format?: string;
  description?: string;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
  anyOf?: Schema[];
  oneOf?: Schema[];
  properties?: Record<string, Schema>;
  required?: string[];
  items?: Schema;
  prefixItems?: Schema[];
  minItems?: number;
  maxItems?: number;
};

const integers: Record<string, string> = {
  uint8: 'u8',
  uint16: 'u16',
  uint32: 'u32',
  int8: 's8',
  int16: 's16',
  int32: 's32',
};

const keywords = new Set(
  'as async bool borrow char constructor enum export f32 f64 flags from func future import include interface list option own package record resource result s8 s16 s32 s64 static stream string tuple type u8 u16 u32 u64 use variant with world'.split(
    ' ',
  ),
);

/** `overhangAngle`, `overhang_angle` → `overhang-angle`, escaped if it is a WIT keyword. */
export function witName(name: string): string {
  const kebab = name
    .replaceAll(/([a-z\d])([A-Z])/g, '$1-$2')
    .replaceAll('_', '-')
    .toLowerCase();
  if (!/^[a-z][a-z\d]*(-[a-z][a-z\d]*)*$/.test(kebab)) {
    throw new Error(`"${name}" is not a valid WIT name (each word must start with a letter)`);
  }
  return keywords.has(kebab) ? `%${kebab}` : kebab;
}

function documentation(schema: Schema, indent: string): string[] {
  const lines = schema.description ? schema.description.split('\n') : [];
  const range =
    schema.minimum !== undefined && schema.maximum !== undefined
      ? `From ${schema.minimum} to ${schema.maximum}.`
      : schema.minimum === undefined
        ? schema.maximum === undefined
          ? undefined
          : `At most ${schema.maximum}.`
        : `At least ${schema.minimum}.`;
  if (range) lines.push(...(lines.length > 0 ? [''] : []), range);
  if (schema.default !== undefined) {
    lines.push(
      ...(lines.length > 0 ? [''] : []),
      `@defaultValue ${JSON.stringify(schema.default)}`,
    );
  }
  return lines.map((line) => `${indent}///${line ? ` ${line}` : ''}`);
}

/** The options record of `plugin` as a WIT package, or throws for schemas WIT cannot express. */
export function optionsWit(plugin: string, schema: Schema): string {
  const definitions: string[] = [];
  const defined = new Map<Schema, string>();

  function type(property: Schema, name: string): string {
    if (property.$ref) {
      const definition = /^#\/\$defs\/(.+)$/.exec(property.$ref)?.[1];
      const target = definition === undefined ? undefined : schema.$defs?.[definition];
      if (!definition || !target) throw new Error(`${name}: unresolved $ref ${property.$ref}`);
      return named(target, witName(definition));
    }
    const variants = property.anyOf ?? property.oneOf;
    if (variants) {
      const nonNull = variants.filter((variant) => variant.type !== 'null');
      if (nonNull.length === 1 && variants.length === 2)
        return `option<${type(nonNull[0]!, name)}>`;
      throw new Error(`${name}: unions other than "T or null" have no WIT equivalent`);
    }
    if (Array.isArray(property.type)) {
      const nonNull = property.type.filter((t) => t !== 'null');
      if (nonNull.length !== 1) throw new Error(`${name}: type ${property.type.join(' | ')}`);
      const inner = type({ ...property, type: nonNull[0] }, name);
      return property.type.includes('null') ? `option<${inner}>` : inner;
    }
    switch (property.type) {
      case 'boolean': {
        return 'bool';
      }
      case 'integer': {
        // Options travel as JSON, where 64-bit integers lose precision (and jco types them bigint).
        const integer = integers[property.format ?? ''];
        if (!integer)
          throw new Error(`${name}: 64-bit integers do not survive JSON, use 32 bits or f64`);
        return integer;
      }
      case 'number': {
        return property.format === 'float' ? 'f32' : 'f64';
      }
      case 'string': {
        return property.enum ? named(property, name) : 'string';
      }
      case 'array': {
        if (property.prefixItems) {
          return `tuple<${property.prefixItems.map((item, index) => type(item, `${name}-${index}`)).join(', ')}>`;
        }
        if (!property.items) throw new Error(`${name}: array without items`);
        const item = type(property.items, `${name}-item`);
        // A fixed length reads better as a tuple, and jco would make `list<f64>` a Float64Array.
        if (property.minItems !== undefined && property.minItems === property.maxItems) {
          return `tuple<${Array.from({ length: property.minItems }, () => item).join(', ')}>`;
        }
        return `list<${item}>`;
      }
      case 'object': {
        return named(property, name);
      }
      default: {
        throw new Error(`${name}: type ${String(property.type)} has no WIT equivalent`);
      }
    }
  }

  /** A record or enum, defined once. */
  function named(definition: Schema, name: string): string {
    const existing = defined.get(definition);
    if (existing) return existing;
    defined.set(definition, name);
    const lines = documentation({ description: definition.description }, '  ');
    if (definition.enum) {
      const cases = definition.enum.map((value) => {
        if (typeof value !== 'string') throw new Error(`${name}: only string enums map to WIT`);
        return `    ${witName(value)},`;
      });
      lines.push(`  enum ${name} {`, ...cases, '  }');
    } else {
      const required = new Set(definition.required);
      const fields = Object.entries(definition.properties ?? {}).flatMap(([key, field]) => {
        const fieldName = witName(key);
        const fieldType = type(field, `${name}-${fieldName.replace('%', '')}`);
        const optional = !required.has(key) && !fieldType.startsWith('option<');
        return [
          ...documentation(field, '    '),
          `    ${fieldName}: ${optional ? `option<${fieldType}>` : fieldType},`,
        ];
      });
      lines.push(`  record ${name} {`, ...fields, '  }');
    }
    definitions.push(lines.join('\n'));
    return name;
  }

  if (schema.type !== 'object') throw new Error('options schema: expected an object schema');
  const record = named(schema, `${witName(plugin)}-options`);
  return [
    `// Generated by plugins/build.ts from the options schema of the ${plugin} plugin. Do not edit.`,
    `package tscad:${witName(plugin)};`,
    '',
    'interface options {',
    definitions.join('\n\n'),
    '}',
    '',
    `world ${witName(plugin)} {`,
    `  use options.{${record}};`,
    '}',
    '',
  ].join('\n');
}
