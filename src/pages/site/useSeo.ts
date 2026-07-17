import { useEffect } from 'react';
import { site } from './siteInfo';

/** Sets the document title + meta description for a public page (basic SEO). */
export function useSeo(title: string, description: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = `${title} · ${site.name}`;

    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('name', 'description');
      document.head.appendChild(tag);
    }
    const prevDesc = tag.getAttribute('content');
    tag.setAttribute('content', description);

    return () => {
      document.title = prev;
      if (prevDesc != null) tag!.setAttribute('content', prevDesc);
    };
  }, [title, description]);
}
