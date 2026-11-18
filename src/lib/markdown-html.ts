/**
 * Conversion du mini-markdown des fiches vers du HTML minimal, que Google Drive
 * transforme en Google Doc à l'import. Tout est échappé : aucun HTML brut n'est conservé.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function inline(text: string): string {
  return esc(text)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function markdownToHtml(source: string): string {
  const out: string[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (list.length) out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
    list = [];
  };
  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (!line) {
      flushList();
      flushPara();
    } else if (heading) {
      flushList();
      flushPara();
      const level = Math.min(Math.max(heading[1].length, 2), 4); // « ## » -> titre 2, « ### » -> titre 3
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
    } else if (/^[-*+]\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^[-*+]\s+/, ""));
    } else {
      flushList();
      para.push(line);
    }
  }
  flushList();
  flushPara();
  return `<html><body>${out.join("")}</body></html>`;
}

/**
 * Remet à plat l'export markdown d'un Google Doc pour le mini-markdown de l'app :
 * retire les échappements, uniformise les puces et les niveaux de titre.
 */
export function normalizeDocMarkdown(md: string): string {
  return md
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => {
      const t = line
        .replace(/^(?:>\s?)+/, "") // l'export marque en citation une liste placée en tête du Doc
        .replace(/\\([\\`*_{}[\]()#+\-.!>~|])/g, "$1")
        .replace(/^\s+([-*+]\s)/, "$1")
        .replace(/^[*+]\s/, "- ")
        .replace(/^#\s/, "## ")
        .replace(/^(#{1,6} )\*\*(.+)\*\*$/, "$1$2");
      return t.trimEnd();
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
