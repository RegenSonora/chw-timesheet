import { describe, expect, it } from 'vitest';
import { CSP_MARKER, injectCsp } from '../../scripts/lib/csp.mjs';
import { checkFiles, checkHtml, localReferences } from '../../scripts/lib/dist-check.mjs';

const page = (head: string, body = '') =>
  injectCsp(`<!doctype html><html><head><meta charset="utf-8" />${CSP_MARKER}${head}</head>
<body>${body}<script type="module">console.log(1)</script></body></html>`);

const good = page(
  '<link rel="manifest" href="./manifest.webmanifest" /><style>body{color:red}</style>',
);

describe('checkHtml', () => {
  it('passes a self-contained page', () => {
    expect(checkHtml(good)).toEqual([]);
  });

  it('rejects an external script', () => {
    expect(checkHtml(page('<script src="./app.js"></script>'))).toContainEqual(
      expect.stringContaining('External script'),
    );
  });

  it('rejects external stylesheets and module preloads', () => {
    const errors = checkHtml(
      page('<link rel="stylesheet" href="a.css"><link rel="modulepreload" href="b.js">'),
    );
    expect(errors.filter((e) => e.startsWith('Link not allowed'))).toHaveLength(2);
  });

  it('rejects remote URLs in attributes and CSS', () => {
    expect(checkHtml(page('<link rel="icon" href="https://example.com/i.png">'))).toContainEqual(
      expect.stringContaining('Remote URL in href'),
    );
    expect(checkHtml(page('', '<img src="//cdn.example.com/x.png">'))).toContainEqual(
      expect.stringContaining('Remote URL in src'),
    );
    expect(
      checkHtml(page("<style>body{background:url('https://example.com/x.png')}</style>")),
    ).toContainEqual(expect.stringContaining('Remote URL in CSS'));
    expect(checkHtml(page('<style>@import "x.css";</style>'))).toContainEqual(
      'CSS @import in inline style',
    );
  });

  it('requires a CSP that blocks connections', () => {
    const noCsp = good.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
    expect(checkHtml(noCsp)).toContainEqual(expect.stringContaining('Expected one CSP meta tag'));

    const open = good.replace("connect-src 'none'", 'connect-src *');
    expect(checkHtml(open)).toContainEqual("CSP must set connect-src 'none'");
  });

  it('rejects unsafe-inline and remote hosts in script-src', () => {
    const unsafe = good.replace(/script-src [^;]+/, "script-src 'unsafe-inline' https://cdn.x");
    const errors = checkHtml(unsafe);
    expect(errors).toContainEqual(expect.stringContaining("allows 'unsafe-inline'"));
    expect(errors).toContainEqual(expect.stringContaining('allows https://cdn.x'));
  });

  it('requires the CSP before any script or style', () => {
    const late = `<html><head><style>a{}</style><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'"></head></html>`;
    expect(checkHtml(late)).toContainEqual('CSP meta must come before any script or style');
  });
});

describe('checkFiles', () => {
  const base = ['index.html', 'sw.js', 'manifest.webmanifest', 'icons/icon-192.png'];

  it('passes the allowed files', () => {
    expect(checkFiles(base)).toEqual([]);
  });

  it('rejects any extra file', () => {
    expect(checkFiles([...base, 'assets/index-abc.js', 'extra.txt'])).toEqual([
      'File not allowed in dist/: assets/index-abc.js',
      'File not allowed in dist/: extra.txt',
    ]);
  });

  it('requires index.html, sw.js and the manifest', () => {
    expect(checkFiles(['index.html'])).toEqual([
      'Missing dist/sw.js',
      'Missing dist/manifest.webmanifest',
    ]);
  });

  it('accepts Windows path separators', () => {
    expect(checkFiles([...base, 'icons\\apple-touch-icon.png'])).toEqual([]);
  });
});

describe('localReferences', () => {
  it('lists linked local files without ./', () => {
    expect(
      localReferences(
        '<link rel="manifest" href="./manifest.webmanifest"><link rel="icon" href="icons/a.png">',
      ),
    ).toEqual(['manifest.webmanifest', 'icons/a.png']);
  });
});
