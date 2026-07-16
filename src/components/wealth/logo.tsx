type WealthLogoProps = {
  inverse?: boolean;
};

export function WealthLogo({ inverse = false }: WealthLogoProps) {
  const textColor = inverse ? "text-white" : "text-[#0b202a]";

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <svg
        aria-hidden="true"
        className="h-7 w-10 shrink-0"
        fill="none"
        viewBox="0 0 48 36"
      >
        <path
          d="M4 7 14.5 30 26 7"
          stroke="#45a18c"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="7"
        />
        <path
          d="M21 7 30.5 30 44 4"
          stroke={inverse ? "#b9ddcf" : "#0d705f"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="7"
        />
      </svg>
      <span className={`whitespace-nowrap text-lg font-semibold tracking-[-0.045em] ${textColor}`}>
        WealthCopy
      </span>
    </div>
  );
}
