import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { UI_COLORS } from '@/lib/colors';
import type { PersonaMedia } from '@/services/studentService';

interface PhysicalAssessmentContentProps {
  materials: PersonaMedia[];
  loading?: boolean;
}

/**
 * Allowed domains for iframe src attributes.
 * Extend this list as new embed providers are needed.
 */
const ALLOWED_IFRAME_DOMAINS = [
  'youtube.com',
  'www.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
  'h5p.org',
  'www.h5p.org',
  'h5p.com',
  'embed.h5p.com',
  'docs.google.com',
  'drive.google.com',
  'open.spotify.com',
  'w.soundcloud.com',
  'codepen.io',
  'codesandbox.io',
  'loom.com',
  'www.loom.com',
];

/**
 * Configure DOMPurify to only allow iframe elements with safe attributes.
 */
function sanitizeEmbedCode(html: string): string {
  // Allow only iframe tags
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['iframe'],
    ALLOWED_ATTR: [
      'src',
      'width',
      'height',
      'allow',
      'allowfullscreen',
      'frameborder',
      'title',
      'style',
      'loading',
      'referrerpolicy',
      'sandbox',
    ],
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['allowfullscreen'],
  });

  // Validate that the iframe src is from an allowed domain
  const parser = new DOMParser();
  const doc = parser.parseFromString(clean, 'text/html');
  const iframe = doc.querySelector('iframe');

  if (!iframe) return '';

  const src = iframe.getAttribute('src') || '';
  try {
    const url = new URL(src, window.location.origin);
    const hostname = url.hostname;
    const isAllowed = ALLOWED_IFRAME_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    );
    if (!isAllowed) return '';
  } catch {
    return '';
  }

  return clean;
}

/**
 * Detect whether a value is embed HTML (starts with <iframe) or a plain URL.
 */
function isEmbedCode(value: string): boolean {
  return value.trimStart().toLowerCase().startsWith('<iframe');
}

/**
 * Extract width and height from an iframe's attributes to compute aspect ratio.
 * Returns the aspect ratio as a CSS string (e.g., "16 / 9") or null if not determinable.
 */
function extractAspectRatio(html: string): string | null {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const iframe = doc.querySelector('iframe');
  if (!iframe) return null;

  const width = parseInt(iframe.getAttribute('width') || '', 10);
  const height = parseInt(iframe.getAttribute('height') || '', 10);

  if (width > 0 && height > 0) {
    return `${width} / ${height}`;
  }

  return null;
}

/**
 * Renders a single embed — either from raw embed HTML or a plain URL.
 */
function EmbedRenderer({ url, title }: { url: string; title: string }) {
  const { sanitizedHtml, aspectRatio } = useMemo(() => {
    if (isEmbedCode(url)) {
      const sanitized = sanitizeEmbedCode(url);
      const ratio = extractAspectRatio(url);
      return { sanitizedHtml: sanitized, aspectRatio: ratio };
    }
    return { sanitizedHtml: null, aspectRatio: null };
  }, [url]);

  // Embed code path — render sanitized HTML in a responsive container
  if (sanitizedHtml) {
    return (
      <div
        className="embed-responsive rounded-lg overflow-hidden w-full"
        style={{
          position: 'relative',
          aspectRatio: aspectRatio || '16 / 9',
          borderWidth: '1px',
          borderStyle: 'solid',
          borderColor: UI_COLORS.border.default,
        }}
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
    );
  }

  // Plain URL path — render in a 16:9 iframe wrapper (legacy behavior)
  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '56.25%',
        height: 0,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: UI_COLORS.border.default,
      }}
    >
      <iframe
        src={url}
        title={title}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          border: 0,
        }}
        allowFullScreen
        allow="autoplay *; fullscreen *; encrypted-media *"
        sandbox="allow-downloads allow-forms allow-same-origin allow-scripts allow-top-navigation allow-pointer-lock allow-popups allow-modals allow-orientation-lock allow-popups-to-escape-sandbox allow-presentation allow-top-navigation-by-user-activation"
      />
    </div>
  );
}

function PhysicalAssessmentContent({ materials, loading }: PhysicalAssessmentContentProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>Loading materials...</p>
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm" style={{ color: UI_COLORS.text.muted }}>No physical assessment materials available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {materials.map((material) => (
        <div key={material.media_id} className="space-y-2">
          <h3 className="text-sm font-semibold" style={{ color: UI_COLORS.text.heading }}>
            {material.title}
          </h3>
          {material.description && (
            <p className="text-xs" style={{ color: UI_COLORS.text.muted }}>
              {material.description}
            </p>
          )}
          {material.url && (
            <EmbedRenderer url={material.url} title={material.title} />
          )}
        </div>
      ))}
    </div>
  );
}

export default PhysicalAssessmentContent;
