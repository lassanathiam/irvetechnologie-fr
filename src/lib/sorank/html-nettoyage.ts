import { FilterXSS, safeAttrValue } from "xss";

/**
 * Nettoyage serveur du HTML reçu de Sorank : on garde titres, paragraphes, listes,
 * tableaux, liens, images et citations ; scripts, iframes, styles et attributs
 * d'événement disparaissent.
 */
const BALISES = [
  "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "ul", "ol", "li", "strong", "b", "em", "i", "u",
  "s", "sup", "sub", "small", "mark", "code", "pre", "blockquote", "q", "cite", "figure",
  "figcaption", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "span", "div",
  "dl", "dt", "dd", "abbr",
];

const listeBlanche: Record<string, string[]> = Object.fromEntries(BALISES.map((b) => [b, []]));
listeBlanche.a = ["href", "title", "target", "rel"];
listeBlanche.img = ["src", "alt", "title", "width", "height", "loading"];
listeBlanche.th = ["colspan", "rowspan", "scope"];
listeBlanche.td = ["colspan", "rowspan"];
listeBlanche.ol = ["start", "type"];
listeBlanche.blockquote = ["cite"];

const filtre = new FilterXSS({
  whiteList: listeBlanche,
  stripIgnoreTag: true,
  stripIgnoreTagBody: ["script", "style", "iframe", "noscript", "object", "embed", "form", "svg", "math"],
  allowCommentTag: false,
  safeAttrValue(tag, name, value, cssFilter) {
    if ((name === "href" || name === "src") && !/^(https?:|mailto:|tel:|\/|#)/i.test(value.trim())) {
      return "";
    }
    return safeAttrValue(tag, name, value, cssFilter);
  },
});

export function nettoyerHtmlArticle(html: string): string {
  // Le titre principal (h1) est rendu par la page : le corps commence au niveau h2.
  const sansH1 = html.replace(/<(\/?)h1(?=[\s>])/gi, "<$1h2");
  return filtre.process(sansH1).trim();
}
