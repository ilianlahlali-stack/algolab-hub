import type { ReactNode } from "react";

/**
 * Mini-markdown pour les fiches : « ## titre », listes « - », paragraphes,
 * **gras**, `code` et [lien](https://…). Pas de HTML brut : rien n'est injecté.
 */
const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;

function inline(text: string, key: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    const k = `${key}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={k}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={k}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
    if (link) {
      return (
        <a key={k} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    return part;
  });
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    const n = blocks.length;
    blocks.push(
      <ul key={`ul-${n}`}>
        {list.map((item, i) => (
          <li key={i}>{inline(item, `li-${n}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  const flushPara = () => {
    if (!para.length) return;
    const n = blocks.length;
    blocks.push(<p key={`p-${n}`}>{inline(para.join(" "), `p-${n}`)}</p>);
    para = [];
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flushList();
      flushPara();
    } else if (/^#{1,6}\s+/.test(line)) {
      flushList();
      flushPara();
      blocks.push(<h4 key={`h-${blocks.length}`}>{inline(line.replace(/^#{1,6}\s+/, ""), `h-${blocks.length}`)}</h4>);
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
  return <div className="md">{blocks}</div>;
}
