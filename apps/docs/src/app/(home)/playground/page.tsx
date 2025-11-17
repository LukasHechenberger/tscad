import type { Metadata } from 'next';
import { ClientPlaygroundPage } from './page.client';

export function generateMetadata() {
  return { title: 'Playground' } satisfies Metadata;
}

export default async function PlaygroundPage() {
  return <ClientPlaygroundPage />;
}
