import { Music2 } from "lucide-react";
import { Link } from "react-router-dom";

export function BrandMark() {
  return (
    <Link className="brand-mark" to="/" aria-label="诗琴首页">
      <span className="brand-mark__icon" aria-hidden="true">
        <Music2 size={22} strokeWidth={1.8} />
      </span>
      <span>
        <strong>诗琴</strong>
        <small>聚会司琴训练</small>
      </span>
    </Link>
  );
}
