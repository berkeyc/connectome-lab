import Link from "next/link";
import Thumb from "./Thumb";
import WorldThumb from "./WorldThumb";

type Props = {
  href: string;
  title: string;
  text?: string;
  eyebrow?: string;
  clip?: string | null;
  image?: string;
  /** experiment id whose 2D world is drawn when there is no clip or image */
  world?: string;
  tags?: { label: string; tone?: "real" | "warn" | "plain" }[];
  size?: "large" | "normal" | "compact";
  children?: React.ReactNode;
};

/** A project with its picture: used for experiments, tasks, datasets and paths through the site. */
export default function ProjectCard({ href, title, text, eyebrow, clip, image, world, tags = [], size = "normal", children }: Props) {
  return (
    <Link href={href} className={`pcard pcard-${size}`}>
      {!clip && !image && world ? (
        <div className="thumb pcard-media">
          <WorldThumb id={world} />
        </div>
      ) : (
        <Thumb clip={clip} image={image} alt={title} className="pcard-media" />
      )}
      <div className="pcard-body">
        {eyebrow && <span className="pcard-eyebrow">{eyebrow}</span>}
        <h3>{title}</h3>
        {text && <p>{text}</p>}
        {children}
        {tags.length > 0 && (
          <div className="pcard-tags">
            {tags.map((t) => (
              <span key={t.label} className={`tag ${t.tone ?? "plain"}`}>
                {t.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
