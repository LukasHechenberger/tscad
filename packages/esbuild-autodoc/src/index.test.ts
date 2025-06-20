import type { PluginBuild } from 'esbuild';
import { FunctionDeclaration, JSDoc, JSDocTag, Project, SourceFile } from 'ts-morph';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addSeeTagPlugin } from './index';

vi.mock('ts-morph', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    Project: vi.fn().mockImplementation(() => ({
      getSourceFiles: vi.fn(),
      save: vi.fn(),
    })),
  };
});

describe('addSeeTagPlugin', () => {
  let mockProject: any;
  let mockSourceFile: any;
  let mockFunction: any;
  let mockJsDocument: any;
  let mockTag: any;
  let build: PluginBuild;
  let getPathname: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockTag = {
      getTagName: vi.fn(),
      getText: vi.fn(),
      replaceWithText: vi.fn(),
    };
    mockJsDocument = {
      getTags: vi.fn(),
      addTag: vi.fn(),
      getText: vi.fn(),
    };
    mockFunction = {
      isExported: vi.fn(),
      getName: vi.fn(),
      getJsDocs: vi.fn(),
      addJsDoc: vi.fn(),
    };
    mockSourceFile = {
      getFilePath: vi.fn(),
      getFunctions: vi.fn(),
    };
    mockProject = {
      getSourceFiles: vi.fn(),
      save: vi.fn(),
    };
    (Project as unknown as vi.Mock).mockReturnValue(mockProject);

    build = {
      onStart: vi.fn(),
    } as unknown as PluginBuild;

    getPathname = vi.fn();
  });

  it('should add @see tag if not present', async () => {
    mockFunction.isExported.mockReturnValue(true);
    mockFunction.getName.mockReturnValue('foo');
    mockFunction.getJsDocs.mockReturnValue([]);
    mockFunction.addJsDoc.mockReturnValue(mockJsDocument);
    mockJsDocument.getTags.mockReturnValue([]);
    mockSourceFile.getFilePath.mockReturnValue('/project/src/foo.ts');
    mockSourceFile.getFunctions.mockReturnValue([mockFunction]);
    mockProject.getSourceFiles.mockReturnValue([mockSourceFile]);
    getPathname.mockReturnValue('foo.html#foo');

    const plugin = addSeeTagPlugin({
      baseUrl: 'https://docs.example.com/',
      getPathname,
    });

    plugin.setup(build);

    // Simulate onStart
    const onStartHandler = (build.onStart as vi.Mock).mock.calls[0][0];
    await onStartHandler();

    expect(mockJsDocument.addTag).toHaveBeenCalledWith({
      tagName: 'see',
      text: '{@link https://docs.example.com/foo.html#foo}',
    });
    expect(mockProject.save).toHaveBeenCalled();
  });

  it('should update @see tag if present and outdated', async () => {
    mockFunction.isExported.mockReturnValue(true);
    mockFunction.getName.mockReturnValue('bar');
    mockFunction.getJsDocs.mockReturnValue([mockJsDocument]);
    mockJsDocument.getTags.mockReturnValue([mockTag]);
    mockTag.getTagName.mockReturnValue('see');
    mockTag.getText.mockReturnValue('@see {@link old-url}');
    mockSourceFile.getFilePath.mockReturnValue('/project/src/bar.ts');
    mockSourceFile.getFunctions.mockReturnValue([mockFunction]);
    mockProject.getSourceFiles.mockReturnValue([mockSourceFile]);
    getPathname.mockReturnValue('bar.html#bar');

    const plugin = addSeeTagPlugin({
      baseUrl: 'https://docs.example.com/',
      getPathname,
    });

    plugin.setup(build);

    const onStartHandler = (build.onStart as vi.Mock).mock.calls[0][0];
    await onStartHandler();

    expect(mockTag.replaceWithText).toHaveBeenCalledWith(
      '@see {@link https://docs.example.com/bar.html#bar}',
    );
    expect(mockProject.save).toHaveBeenCalled();
  });

  it('should not modify if @see tag is up to date', async () => {
    mockFunction.isExported.mockReturnValue(true);
    mockFunction.getName.mockReturnValue('baz');
    mockFunction.getJsDocs.mockReturnValue([mockJsDocument]);
    mockJsDocument.getTags.mockReturnValue([mockTag]);
    mockTag.getTagName.mockReturnValue('see');
    mockTag.getText.mockReturnValue('@see {@link https://docs.example.com/baz.html#baz}');
    mockSourceFile.getFilePath.mockReturnValue('/project/src/baz.ts');
    mockSourceFile.getFunctions.mockReturnValue([mockFunction]);
    mockProject.getSourceFiles.mockReturnValue([mockSourceFile]);
    getPathname.mockReturnValue('baz.html#baz');

    const plugin = addSeeTagPlugin({
      baseUrl: 'https://docs.example.com/',
      getPathname,
    });

    plugin.setup(build);

    const onStartHandler = (build.onStart as vi.Mock).mock.calls[0][0];
    await onStartHandler();

    expect(mockTag.replaceWithText).not.toHaveBeenCalled();
    expect(mockJsDocument.addTag).not.toHaveBeenCalled();
    expect(mockProject.save).toHaveBeenCalled();
  });

  it('should skip non-exported functions', async () => {
    mockFunction.isExported.mockReturnValue(false);
    mockSourceFile.getFilePath.mockReturnValue('/project/src/skip.ts');
    mockSourceFile.getFunctions.mockReturnValue([mockFunction]);
    mockProject.getSourceFiles.mockReturnValue([mockSourceFile]);
    getPathname.mockReturnValue('skip.html#skip');

    const plugin = addSeeTagPlugin({
      baseUrl: 'https://docs.example.com/',
      getPathname,
    });

    plugin.setup(build);

    const onStartHandler = (build.onStart as vi.Mock).mock.calls[0][0];
    await onStartHandler();

    expect(mockJsDocument.addTag).not.toHaveBeenCalled();
    expect(mockProject.save).toHaveBeenCalled();
  });

  it('should log and skip if getPathname returns undefined', async () => {
    mockFunction.isExported.mockReturnValue(true);
    mockFunction.getName.mockReturnValue('noDoc');
    mockFunction.getJsDocs.mockReturnValue([]);
    mockFunction.addJsDoc.mockReturnValue(mockJsDocument);
    mockJsDocument.getTags.mockReturnValue([]);
    mockSourceFile.getFilePath.mockReturnValue('/project/src/noDoc.ts');
    mockSourceFile.getFunctions.mockReturnValue([mockFunction]);
    mockProject.getSourceFiles.mockReturnValue([mockSourceFile]);
    getPathname.mockReturnValue();

    const plugin = addSeeTagPlugin({
      baseUrl: 'https://docs.example.com/',
      getPathname,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    plugin.setup(build);

    const onStartHandler = (build.onStart as vi.Mock).mock.calls[0][0];
    await onStartHandler();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('DOC @see for'));
    expect(mockJsDocument.addTag).not.toHaveBeenCalled();
    expect(mockProject.save).toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
