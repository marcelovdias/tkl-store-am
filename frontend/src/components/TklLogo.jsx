export function TklLogo({ size = 48 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Emblema TKL AM"
      className="shrink-0"
    >
      <circle cx="50" cy="50" r="47" fill="#141413" stroke="#E5E0D5" strokeWidth="1.5" />
      {/* Grafismo geométrico superior inspirado em trama/escamas */}
      <path
        d="M32 32 L50 16 L68 32 M39 32 L50 22 L61 32 M44 32 L50 26.5 L56 32"
        stroke="#FAF8F5"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 16 L50 32"
        stroke="#B8293D"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* Tipografia TKL */}
      <text
        x="50"
        y="59"
        textAnchor="middle"
        fill="#FAF8F5"
        fontSize="24"
        fontWeight="300"
        letterSpacing="4"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        TKL
      </text>
      <circle cx="77" cy="43" r="2.2" fill="#B8293D" />
      {/* Linha divisória + AM */}
      <line x1="28" y1="67" x2="72" y2="67" stroke="#FAF8F5" strokeOpacity="0.45" strokeWidth="1" />
      <text
        x="50"
        y="80"
        textAnchor="middle"
        fill="#C89B3C"
        fontSize="11"
        fontWeight="600"
        letterSpacing="3.5"
        fontFamily="Plus Jakarta Sans, sans-serif"
      >
        AM
      </text>
    </svg>
  );
}
