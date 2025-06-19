import type { Plugin } from 'esbuild';
import { Project } from 'ts-morph';
import path, { relative } from 'node:path';

export function addSeeTagPlugin({
  baseUrl: DOCS_BASE_URL,
  getPathname,
}: {
  baseUrl: string;
  getPathname: (sourcePath: string, name: string) => string | undefined;
}): Plugin {
  return {
    name: 'add-see-tag-plugin',
    setup(build) {
      const project = new Project({
        tsConfigFilePath: 'tsconfig.json',
        skipAddingFilesFromTsConfig: false,
      });

      build.onStart(async () => {
        const sourceFiles = project.getSourceFiles('src/**/*.ts');

        for (const sourceFile of sourceFiles) {
          let modified = false;

          const relativePath = path.relative(process.cwd(), sourceFile.getFilePath());

          const functions = sourceFile.getFunctions();

          for (const fn of functions) {
            if (!fn.isExported()) continue;

            const name = fn.getName();
            if (!name) continue;

            const jsDoc = fn.getJsDocs()[0] || fn.addJsDoc({ description: '' });
            const existingSee = jsDoc.getTags().find((tag) => tag.getTagName() === 'see');

            const docPath = getPathname(relativePath, name);
            if (!docPath) {
              console.log(`DOC @see for ${relativePath}#${name}`);
              continue;
            }
            const docUrl = new URL(docPath, DOCS_BASE_URL).toString();
            const seeText = `@see ${docUrl}`;

            if (existingSee) {
              if (existingSee.getText() !== seeText) {
                existingSee.replaceWithText(seeText);
                modified = true;
              }
            } else {
              jsDoc.addTag({ tagName: 'see', text: docUrl });
              modified = true;
            }
          }

          if (modified) {
            console.log(`DOC Updated: ${relativePath}`);
          }
        }

        await project.save();
      });
    },
  };
}
