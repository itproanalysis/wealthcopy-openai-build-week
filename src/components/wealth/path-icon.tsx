import type { PathType } from "@/lib/wealth/engine";

type PathIconProps = {
  type: PathType;
};

export function PathIcon({ type }: PathIconProps) {
  if (type === "stable") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 48 48">
        <path
          d="M24 5 39 11v11c0 10-6.2 17-15 21-8.8-4-15-11-15-21V11l15-6Z"
          fill="#eaf4ff"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="m16.5 24 5 5 10-11"
          stroke="#06a4a8"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (type === "balanced") {
    return (
      <svg aria-hidden="true" fill="none" viewBox="0 0 48 48">
        <path
          d="M24 8v32M13 14h22M16 14 9 28h14l-7-14ZM32 14l-7 14h14l-7-14Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.5"
        />
        <path
          d="M14 40h20"
          stroke="#06a4a8"
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 48 48">
      <path
        d="M29 7c6 1 10 5 12 12L27 33l-12-12L29 7Z"
        fill="#e8f8f8"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="m31 17 .1.1M16 29l-8 3 8 3M20 33l-2 8 7-6"
        stroke="#06a4a8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <circle cx="31" cy="17" r="3" fill="currentColor" />
    </svg>
  );
}
