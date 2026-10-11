/**
 * Reads the public API's documentation from its TSDoc comments, with the TypeScript compiler:
 * every export of `@tscad/modeling` tagged `@category` becomes an entry with its signature, text,
 * documented options and `@example` blocks.
 */
import path from 'node:path';
import ts from 'typescript';

export const ROOT = path.join(import.meta.dir, '../../../..');
export const API_ENTRY = path.join(ROOT, 'packages/modeling/src/index.ts');

/** Categories in reading order; entries in other categories come after them. */
export const CATEGORIES = [
  '3D shapes',
  '2D shapes',
  'Extrusions',
  'Transforms',
  'Booleans',
  'Parameters',
  'Plugins',
  'Types',
];

/** `oneOf`: an alternative of a union, like `r` or `d` of `{ r } | { d }`. */
export type ReferenceOption = {
  name: string;
  type: string;
  optional: boolean;
  oneOf: boolean;
  documentation: string;
};

export type ReferenceEntry = {
  name: string;
  kind: 'function' | 'class' | 'type';
  category: string;
  /** One line per overload, member or alias, as shown in the reference. */
  signature: string;
  /** The comment text before the first tag (Markdown-ish: `code`, [links](url), blank-line paragraphs). */
  documentation: string;
  /** Documented properties of object-typed parameters (or of the type itself). */
  options: ReferenceOption[];
  /** Methods, for classes. */
  members: string[];
  /** Source of each `@example` block. */
  examples: string[];
  source: { file: string; line: number };
};

export function compilerOptions(): ts.CompilerOptions {
  const project = path.join(ROOT, 'packages/modeling');
  const { config } = ts.readConfigFile(path.join(project, 'tsconfig.json'), ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config, ts.sys, project).options;
}

/** The members of a union (alternatives) or intersection (all apply), flattened. */
const branches = (type: ts.Type): { part: ts.Type; oneOf: boolean }[] =>
  type.isUnion()
    ? type.types.map((part) => ({ part, oneOf: true }))
    : type.isIntersection()
      ? type.types.flatMap((member) => branches(member))
      : [{ part: type, oneOf: false }];

/** Categories sort in `CATEGORIES` order; unknown ones last. */
const rank = (category: string) =>
  CATEGORIES.includes(category) ? CATEGORIES.indexOf(category) : CATEGORIES.length;

export function extractDocs(entry = API_ENTRY): ReferenceEntry[] {
  const program = ts.createProgram([entry], compilerOptions());
  const checker = program.getTypeChecker();
  const module = checker.getSymbolAtLocation(program.getSourceFile(entry)!)!;
  const printer = ts.createPrinter({ removeComments: true });
  /** Source text of a type, without comments, on one line: `{ center?: boolean }`. */
  const typeText = (node: ts.TypeNode) =>
    printer
      .printNode(ts.EmitHint.Unspecified, node, node.getSourceFile())
      .replaceAll(/\s+/g, ' ')
      .replaceAll(/;\s*}/g, ' }')
      .replaceAll(/\(\s+/g, '(')
      .replace(/^\| /, '');

  /** Documented properties of `type` declared in our own sources (not lib.d.ts), across unions and intersections. */
  function documentedProperties(type: ts.Type): ReferenceOption[] {
    const seen = new Map<string, ReferenceOption>();
    for (const { part, oneOf } of branches(type)) {
      for (const property of checker.getPropertiesOfType(part)) {
        const declaration = property.declarations?.[0];
        if (
          !declaration ||
          declaration.getSourceFile().isDeclarationFile ||
          seen.has(property.name)
        )
          continue;
        const documentation = ts
          .displayPartsToString(property.getDocumentationComment(checker))
          .trim();
        if (!documentation) continue;
        const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
        const type =
          ts.isPropertySignature(declaration) && declaration.type
            ? typeText(declaration.type)
            : checker.typeToString(checker.getTypeOfSymbolAtLocation(property, declaration));
        seen.set(property.name, { name: property.name, type, optional, oneOf, documentation });
      }
    }
    return [...seen.values()];
  }

  function parameters(declaration: ts.SignatureDeclaration): {
    text: string;
    options: ReferenceOption[];
  } {
    const options: ReferenceOption[] = [];
    const texts = declaration.parameters.map((parameter) => {
      const name = ts.isIdentifier(parameter.name) ? parameter.name.text : 'options';
      const type = parameter.type
        ? checker.getTypeFromTypeNode(parameter.type)
        : checker.getTypeAtLocation(parameter);
      if (!parameter.dotDotDotToken) options.push(...documentedProperties(type));
      const optional = parameter.questionToken || parameter.initializer ? '?' : '';
      return `${parameter.dotDotDotToken ? '...' : ''}${name}${optional}: ${parameter.type ? typeText(parameter.type) : checker.typeToString(type)}`;
    });
    return { text: texts.join(', '), options };
  }

  const entries: ReferenceEntry[] = [];
  for (let symbol of checker.getExportsOfModule(module)) {
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol.declarations?.[0];
    if (!declaration) continue;
    const comment = parseComment(declaration);
    const category = comment.tags.category?.[0];
    if (!category) continue; // undocumented or host-facing (evaluateModel, Node, …)

    const file = declaration.getSourceFile();
    const source = {
      file: path.relative(ROOT, file.fileName),
      line: file.getLineAndCharacterOfPosition(declaration.getStart()).line + 1,
    };
    const base = {
      name: symbol.name,
      category,
      documentation: comment.text,
      examples: comment.tags.example ?? [],
      source,
      members: [] as string[],
    };

    if (ts.isFunctionDeclaration(declaration)) {
      const typeParameters = declaration.typeParameters
        ? `<${declaration.typeParameters.map((t) => t.getText()).join(', ')}>`
        : '';
      const { text, options } = parameters(declaration);
      const returns = declaration.type ? `: ${typeText(declaration.type)}` : '';
      entries.push({
        ...base,
        kind: 'function',
        signature: `${symbol.name}${typeParameters}(${text})${returns}`,
        options,
      });
    } else if (ts.isClassDeclaration(declaration)) {
      const members = declaration.members.filter(
        (m): m is ts.MethodDeclaration =>
          ts.isMethodDeclaration(m) && m.name.getText() !== 'toJSON',
      );
      const methods = members.map(
        (m) =>
          `.${m.name.getText()}(${parameters(m).text})${m.type ? `: ${typeText(m.type)}` : ''}`,
      );
      entries.push({
        ...base,
        kind: 'class',
        signature: `class ${symbol.name}`,
        options: [],
        members: methods,
      });
    } else if (ts.isTypeAliasDeclaration(declaration)) {
      const options = documentedProperties(checker.getTypeAtLocation(declaration));
      // With documented options the table says it all; otherwise show the definition.
      const definition = options.length > 0 ? '{ … }' : typeText(declaration.type);
      entries.push({
        ...base,
        kind: 'type',
        signature: `type ${symbol.name} = ${definition}`,
        options,
      });
    }
  }
  return entries.sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      a.source.file.localeCompare(b.source.file) ||
      a.source.line - b.source.line,
  );
}

/** The text and tags of a declaration's (last) JSDoc comment, keeping example indentation. */
function parseComment(declaration: ts.Node): { text: string; tags: Record<string, string[]> } {
  // The last JSDoc block is the one attached to the declaration.
  const comments = ts.getJSDocCommentsAndTags(declaration).filter((node) => ts.isJSDoc(node));
  const block = comments.at(-1);
  if (!block) return { text: '', tags: {} };
  const lines = block
    .getText()
    .replace(/^\/\*\*\s?/, '')
    .replace(/\s*\*\/$/, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''));
  // The text, then one block per tag.
  const blocks: { tag: string; lines: string[] }[] = [{ tag: '', lines: [] }];
  for (const line of lines) {
    const tag = /^@(\w+)\s?(.*)$/.exec(line);
    if (tag) blocks.push({ tag: tag[1]!, lines: [tag[2]!] });
    else blocks.at(-1)!.lines.push(line);
  }
  const tags: Record<string, string[]> = {};
  for (const { tag, lines } of blocks.slice(1)) {
    const text = lines.join('\n').trim();
    // TSDoc wants example code fenced; the fence is presentation, not code.
    (tags[tag] ??= []).push(
      tag === 'example' ? text.replace(/^```\w*\n/, '').replace(/\n```$/, '') : text,
    );
  }
  return { text: blocks[0]!.lines.join('\n').trim(), tags };
}
