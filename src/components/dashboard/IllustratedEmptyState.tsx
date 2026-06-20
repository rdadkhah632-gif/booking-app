import type { ReactNode } from "react";

type Props = {
  action?: ReactNode;
  body: string;
  title: string;
  variant: "services" | "staff";
};

export default function IllustratedEmptyState({
  action,
  body,
  title,
  variant,
}: Props) {
  return (
    <div className="illustrated-empty-state">
      <div className="empty-visual" aria-hidden="true">
        {variant === "staff" ? <StaffIllustration /> : <ServicesIllustration />}
      </div>

      <div className="empty-copy">
        <h3>{title}</h3>
        <p>{body}</p>
        {action && <div className="empty-action">{action}</div>}
      </div>

      <style jsx>{`
        .illustrated-empty-state {
          position: relative;
          overflow: hidden;
          display: grid;
          place-items: center;
          gap: clamp(1.1rem, 3vw, 1.6rem);
          min-height: clamp(300px, 34vw, 360px);
          padding: clamp(1.2rem, 3vw, 2.1rem);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--radius);
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent),
            rgba(13, 13, 19, 0.68);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          text-align: center;
        }

        .empty-visual {
          width: min(100%, 540px);
          color: var(--accent);
        }

        .empty-copy {
          display: grid;
          justify-items: center;
          gap: 0.75rem;
          max-width: 460px;
        }

        .empty-copy h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.65rem, 3.6vw, 2.2rem);
          line-height: 1.05;
        }

        .empty-copy p {
          margin: 0;
          color: var(--text-muted);
          font-size: clamp(1rem, 2.4vw, 1.14rem);
          line-height: 1.55;
        }

        .empty-action {
          display: flex;
          justify-content: center;
          width: 100%;
          padding-top: 0.3rem;
        }

        .empty-action :global(.btn) {
          min-width: min(100%, 310px);
          border-color: rgba(255, 107, 53, 0.72);
          background: rgba(255, 107, 53, 0.07);
          color: var(--accent);
        }

        .empty-action :global(.empty-action-icon) {
          font-size: 1.35rem;
          line-height: 1;
        }

        @media (max-width: 640px) {
          .illustrated-empty-state {
            min-height: 300px;
            padding: 1.15rem;
          }

          .empty-action :global(.btn) {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

function StaffIllustration() {
  return (
    <svg
      className="empty-illustration"
      viewBox="0 0 640 280"
      role="img"
      focusable="false"
    >
      <g className="dot-cluster" opacity="0.42">
        {[
          [72, 42],
          [96, 42],
          [120, 42],
          [72, 66],
          [96, 66],
          [120, 66],
          [72, 90],
          [96, 90],
          [120, 90],
          [520, 182],
          [544, 182],
          [568, 182],
          [520, 206],
          [544, 206],
          [568, 206],
          [520, 230],
          [544, 230],
          [568, 230],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.2" />
        ))}
      </g>

      <path
        className="muted-line dashed"
        d="M196 142v-50c0-18 12-30 30-30h188c18 0 30 12 30 30v50"
      />
      <path className="muted-line dashed" d="M320 138v-38" />
      <circle className="muted-line dashed node" cx="196" cy="166" r="38" />
      <circle className="muted-line dashed node" cx="320" cy="166" r="38" />
      <circle className="muted-line dashed node" cx="444" cy="166" r="38" />
      <circle className="main-disc" cx="320" cy="58" r="70" />
      <circle className="muted-line" cx="320" cy="28" r="22" />
      <path className="muted-line" d="M278 86c9-25 28-37 42-37s33 12 42 37" />
      <circle className="accent-ring" cx="390" cy="96" r="34" />
      <path className="accent-line" d="M390 78v36M372 96h36" />
      <path className="accent-line subtle-plus" d="M548 34v24M536 46h24" />
      <circle className="muted-dot" cx="38" cy="154" r="6" />
      <circle className="muted-dot" cx="586" cy="144" r="5" />
      <path className="base-line" d="M92 258h456" />

      <style jsx>{illustrationStyles}</style>
    </svg>
  );
}

function ServicesIllustration() {
  return (
    <svg
      className="empty-illustration"
      viewBox="0 0 640 280"
      role="img"
      focusable="false"
    >
      <path
        className="muted-line dashed"
        d="M205 52h230c21 0 36 15 36 36v112c0 21-15 36-36 36H205c-21 0-36-15-36-36V88c0-21 15-36 36-36Z"
      />
      <g className="service-card">
        <path
          className="card-plane"
          d="M134 132c2-23 22-40 45-38l288 24c23 2 40 22 38 45l-6 74c-2 23-22 40-45 38l-288-24c-23-2-40-22-38-45l6-74Z"
        />
        <path
          className="muted-line dashed"
          d="M170 134h74c14 0 24 10 24 24v74c0 14-10 24-24 24h-74c-14 0-24-10-24-24v-74c0-14 10-24 24-24Z"
        />
        <path className="accent-line" d="M206 174v46M183 197h46" />
        <path className="muted-line thick" d="M316 174h142" />
        <path className="muted-line thick faint" d="M315 208h112" />
        <path className="muted-line thick faint" d="M314 238h64" />
        <circle className="muted-dot" cx="470" cy="202" r="5" />
        <circle className="muted-dot" cx="486" cy="202" r="5" />
        <circle className="muted-dot" cx="502" cy="202" r="5" />
      </g>
      <circle className="main-disc" cx="330" cy="54" r="58" />
      <path className="accent-line" d="M306 34l49 49M356 34l-49 49" />
      <circle className="accent-line" cx="307" cy="86" r="10" />
      <circle className="accent-line" cx="355" cy="86" r="10" />
      <path className="accent-line subtle-plus" d="M536 70v24M524 82h24" />
      <path className="muted-line subtle-plus" d="M86 84v24M74 96h24" />
      <path className="muted-line subtle-plus" d="M560 226v24M548 238h24" />
      <circle className="muted-dot" cx="40" cy="170" r="6" />
      <circle className="muted-dot" cx="586" cy="168" r="5" />
      <path className="base-line" d="M96 258h448" />

      <style jsx>{illustrationStyles}</style>
    </svg>
  );
}

const illustrationStyles = `
  .empty-illustration {
    width: 100%;
    height: auto;
    display: block;
  }

  .muted-line,
  .main-disc,
  .card-plane {
    fill: none;
    stroke: rgba(255, 255, 255, 0.33);
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .main-disc,
  .card-plane {
    fill: rgba(255, 255, 255, 0.025);
  }

  .dashed {
    stroke-dasharray: 12 12;
  }

  .node {
    fill: rgba(255, 255, 255, 0.012);
  }

  .accent-ring {
    fill: rgba(255, 107, 53, 0.08);
    stroke: var(--accent);
    stroke-width: 4;
  }

  .accent-line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 4;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .subtle-plus {
    opacity: 0.9;
  }

  .thick {
    stroke-width: 8;
    opacity: 0.72;
  }

  .faint {
    opacity: 0.38;
  }

  .dot-cluster,
  .muted-dot {
    fill: rgba(255, 255, 255, 0.42);
  }

  .base-line {
    fill: none;
    stroke: rgba(255, 255, 255, 0.1);
    stroke-width: 2;
    stroke-linecap: round;
  }
`;
