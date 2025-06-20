import path from 'node:path';
import type { Plugin } from 'esbuild';
import { Project } from 'ts-morph';

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

          for (const function_ of functions) {
            if (!function_.isExported()) continue;

            const name = function_.getName();
            if (!name) continue;

            const jsDocument = function_.getJsDocs()[0] || function_.addJsDoc({ description: '' });
            const existingSee = jsDocument.getTags().find((tag) => tag.getTagName() === 'see');

            const documentPath = getPathname(relativePath, name);
            if (!documentPath) {
              console.log(`DOC @see for ${relativePath}#${name}`);
              continue;
            }
            const documentUrl = new URL(documentPath, DOCS_BASE_URL).toString();
            const seeText = `@see {@link ${documentUrl}}`;

            if (existingSee) {
              if (existingSee.getText() !== seeText) {
                existingSee.replaceWithText(seeText);
                modified = true;
              }
            } else {
              jsDocument.addTag({ tagName: 'see', text: documentUrl });
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
