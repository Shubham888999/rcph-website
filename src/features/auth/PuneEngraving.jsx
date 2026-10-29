import { useId } from "react";

/** Original decorative architecture inspired by Pune's carved gateways and old-city lanes. */
export default function PuneEngraving() {
  const id = useId().replace(/:/g, "");
  const lattice = `heritage-lattice-${id}`;
  const fade = `heritage-fade-${id}`;
  return <div className="login-access-pass__engraving" aria-hidden="true">
    <svg viewBox="0 0 720 960" preserveAspectRatio="xMidYMid slice" fill="none" focusable="false">
      <defs>
        <pattern id={lattice} width="24" height="24" patternUnits="userSpaceOnUse"><path d="m12 0 12 12-12 12L0 12zM0 0l24 24M24 0 0 24" /></pattern>
        <linearGradient id={fade} x1="0" x2="1"><stop offset="0" stopColor="currentColor" stopOpacity="0" /><stop offset="1" stopColor="currentColor" stopOpacity=".08" /></linearGradient>
      </defs>
      <g className="pass-engraving__lanes">
        <path d="M-20 252c95-91 184 31 277-25S382 137 467 163s101 46 164 14 118-20 118-20M-20 271c95-91 184 31 277-25S382 156 467 182s101 46 164 14 118-20 118-20M-20 290c95-91 184 31 277-25S382 175 467 201s101 46 164 14 118-20 118-20" />
        <path d="m20 357 102-43 86 16 66-69 105 20 69-54 109 8 126-59m-473 15 34 86m62-134 39 79m106-52 32 47m74-36-10 81" />
        <circle cx="274" cy="261" r="4" /><circle cx="448" cy="227" r="4" /><circle cx="122" cy="314" r="4" />
      </g>
      <g className="pass-engraving__sun" transform="translate(564 221)">
        <circle r="91" /><circle r="79" /><circle r="66" strokeDasharray="1 6" />
        {Array.from({ length: 24 }, (_, i) => <path key={i} transform={`rotate(${i * 15})`} d="M0-102v-12M0-78l9 18L0-44l-9-16z" />)}
        <path d="m0-38 10 28 28 10-28 10-10 28-10-28-28-10 28-10z" /><circle r="14" />
      </g>
      <g className="pass-engraving__arch">
        <path className="pass-engraving__arch-wash" d="M375 812V443q0-93 155-174 155 81 155 174v369z" />
        <path className="pass-engraving__draw" pathLength="1" d="M359 812V443q0-104 171-193 171 89 171 193v369M375 812V443q0-93 155-174 155 81 155 174v369M394 812V444q0-82 136-153 136 71 136 153v368" />
        <path d="M411 802V445q0-69 119-133 119 64 119 133v357M411 445q20 9 30-14 23 8 30-17 25 4 29-19 23-3 30-29 7 26 30 29 4 23 29 19 7 25 30 17 10 23 30 14" />
        <path d="M426 796V475h208v321M443 796V492h174v304M530 492v304M443 516h174M443 653h174M443 678h174" />
        <path fill={`url(#${lattice})`} d="M454 529h65v111h-65zM541 529h65v111h-65zM454 691h65v91h-65zM541 691h65v91h-65z" />
        <path d="M454 529h65v111h-65zM541 529h65v111h-65zM454 691h65v91h-65zM541 691h65v91h-65zM350 799h360v13H350zM342 819h376" />
        <g className="pass-engraving__studs">{[543, 570, 597, 624, 705, 731, 757].map(y => <g key={y}><circle cx="462" cy={y} r="2" /><circle cx="511" cy={y} r="2" /><circle cx="549" cy={y} r="2" /><circle cx="598" cy={y} r="2" /></g>)}</g>
        <circle className="pass-engraving__handle" cx="519" cy="663" r="6" /><circle className="pass-engraving__handle" cx="541" cy="663" r="6" />
      </g>
      <g className="pass-engraving__hills">
        <path d="M-20 796 82 722l48 24 60-52 60 47 38-21 77 75M-20 812 82 738l48 24 60-52 60 47 38-21 77 75M-20 828 82 754l48 24 60-52 60 47 38-21 77 75" />
        <path d="M-20 899q110-41 212-7t231-3 315-5M-20 911q110-41 212-7t231-3 315-5M-20 923q110-41 212-7t231-3 315-5" />
      </g>
      <g className="pass-engraving__corners"><path d="M28 62V28h34M658 28h34v34M28 898v34h34m596 0h34v-34M35 76V35h41m568 0h41v41M35 884v41h41m568 0h41v-41" /><path d="m44 44 7 7-7 7-7-7zm632 0 7 7-7 7-7-7zM44 902l7 7-7 7-7-7zm632 0 7 7-7 7-7-7z" /></g>
      <path className="pass-engraving__foil" fill={`url(#${fade})`} d="M0 0h720v960H0z" />
    </svg>
  </div>;
}
