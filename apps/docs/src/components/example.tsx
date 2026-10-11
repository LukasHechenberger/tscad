import type { ReactNode } from 'react';

/** An API example: its code, and the picture the kernel rendered from it (by build-api-docs). */
export function Example({ image, children }: { image?: string; children: ReactNode }) {
  return (
    <div className="not-prose bg-fd-card my-4 grid items-center gap-3 rounded-xl border p-2 sm:grid-cols-[minmax(0,1fr)_200px]">
      <div className="prose min-w-0 [&_figure]:my-0">{children}</div>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- plain SVG files
        <img
          src={image}
          alt=""
          loading="lazy"
          className="h-[150px] w-full rounded-lg bg-neutral-100 object-contain p-2"
        />
      ) : (
        <p className="text-fd-muted-foreground px-2 text-sm">
          The picture needs the plugins built.
        </p>
      )}
    </div>
  );
}
