declare module '@jscad/3mf-serializer' {
  export function serialize(options: any, ...objects: any[]): BlobPart[];
  export const mimeType: string;
}

declare module '@jscad/obj-serializer' {
  export function serialize(options: any, ...objects: any[]): BlobPart[];
  export const mimeType: string;
}

declare module '@jscad/stl-serializer' {
  export function serialize(options: any, ...objects: any[]): BlobPart[];
  export const mimeType: string;
}
