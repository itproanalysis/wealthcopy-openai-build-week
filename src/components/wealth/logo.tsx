type WealthLogoProps = {
  inverse?: boolean;
};

export function WealthLogo({ inverse = false }: WealthLogoProps) {
  const textColor = inverse ? "text-white" : "text-[#082a66]";

  return (
    <div className="flex items-center gap-2.5" aria-label="WealthCopy">
      <svg
        aria-hidden="true"
        className="h-8 w-11"
        fill="none"
        viewBox="0 0 48 36"
      >
        <path
          d="M4 7 14.5 30 26 7"
          stroke="#08a8aa"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="7"
        />
        <path
          d="M21 7 30.5 30 44 4"
          stroke={inverse ? "#8ee7e6" : "#082a66"}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="7"
        />
      </svg>
      <span className={`text-lg font-extrabold tracking-[-0.04em] ${textColor}`}>
        WealthCopy
      </span>
    </div>
  );
}
