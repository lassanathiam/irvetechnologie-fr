import { FilterXSS, getDefaultWhiteList } from "xss";

/**
 * Nettoyage serveur du HTML reçu de Sorank : on garde titres, paragraphes, listes,
 * tableaux, liens, images et citations ; scripts, iframes, styles et attributs
 * d'événement disparaissent.
 */
const listeBlanche = (() => {
  const base = getDefaultWhiteList() as Record<string, string[]>;
  const garder = [
    "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li", "strong", "b", "em", "i", "u",
    "s", "sup", "sub", "small", "mark", "code", "pre", "blockquote", "q", "cite", "figure",
    "figcaption", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "span", "div",
    "dl", "dt", "dd", "abbr",
  ];
  const wl: Record<string, string[]> = {};
  for (const tag of garder) wl[tag] = [];
  wl.a = ["href", "title", "target", "rel"];
  wl.img = ["src", "alt", "title", "width", "height", "loading"];
  wl.th = ["colspan", "rowspan", "scope"];
  wl.td = ["colspan", "rowspan"];
  wl.ol = ["start", "type"];
  wl.blockquote = ["cite"];
  void base;
  return wl;
})();

const filtre = new FilterXSS({
  whiteList: listeBlanche,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "noscript", "object", "embed", "form", "svg", "math"],
  allowCommentTag: false,
  safeAttrValue(tag, name, value, cssFilter) {
    if ((name === "href" || name === "src") && !/^(https?:|mailto:|tel:|\/|#)/i.test(value.trim())) {
      return "";
    }
    return (filtre as unknown as { options: never }) && defaultSafe(tag, name, value, cssFilter);
  },
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
import { safeAttrValue as defaultSafe } from "xss";

export function nettoyerHtmlArticle(html: string): string {
  // Le titre principal (h1) est rendu par la page : le corps commence au niveau h2.
  const sansH1 = html.replace(/<(\/?)h1(\s|>)/gi, "<$1h2$2");
  return filtre.process(sansH1).trim();
}
