import { motion } from "framer-motion";

export function SakuraBranches() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-40 select-none"
      aria-hidden="true"
    >
      {/* Top Left Branch */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, rotate: -5 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute -top-10 -left-10 w-72 sm:w-96 lg:w-[480px] h-auto"
      >
        <svg
          viewBox="0 0 500 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Main Branches */}
          <path
            d="M-20 -20 C 80 40, 180 30, 280 120 C 340 180, 420 220, 480 210"
            stroke="#8B5E66"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 180 30 C 220 80, 260 100, 310 90"
            stroke="#8B5E66"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path
            d="M 280 120 C 300 160, 340 180, 370 240"
            stroke="#8B5E66"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* Sakura Blossom Clusters */}
          {/* Cluster 1 */}
          <g transform="translate(180, 30)">
            <circle cx="0" cy="0" r="16" fill="#FFB7C5" opacity="0.9" />
            <circle cx="-8" cy="-6" r="12" fill="#FFC0CB" opacity="0.85" />
            <circle cx="8" cy="6" r="14" fill="#FF99AC" opacity="0.9" />
            <circle cx="0" cy="0" r="4" fill="#E65C83" />
          </g>

          {/* Cluster 2 */}
          <g transform="translate(280, 120)">
            <circle cx="0" cy="0" r="22" fill="#FFB7C5" opacity="0.9" />
            <circle cx="-10" cy="8" r="16" fill="#FF99AC" opacity="0.9" />
            <circle cx="12" cy="-6" r="15" fill="#FFE4E1" opacity="0.95" />
            <circle cx="-6" cy="-10" r="14" fill="#FFB7C5" opacity="0.85" />
            <circle cx="0" cy="0" r="5" fill="#D84373" />
          </g>

          {/* Cluster 3 */}
          <g transform="translate(310, 90)">
            <circle cx="0" cy="0" r="18" fill="#FFC0CB" opacity="0.9" />
            <circle cx="10" cy="6" r="14" fill="#FFB7C5" opacity="0.85" />
            <circle cx="-8" cy="-6" r="12" fill="#FF99AC" opacity="0.9" />
            <circle cx="0" cy="0" r="4" fill="#E65C83" />
          </g>

          {/* Cluster 4 - Branch Tip */}
          <g transform="translate(480, 210)">
            <circle cx="0" cy="0" r="18" fill="#FFB7C5" opacity="0.9" />
            <circle cx="-10" cy="-6" r="14" fill="#FFE4E1" opacity="0.95" />
            <circle cx="8" cy="8" r="15" fill="#FF99AC" opacity="0.9" />
            <circle cx="0" cy="0" r="4" fill="#D84373" />
          </g>

          {/* Sub Cluster */}
          <g transform="translate(370, 240)">
            <circle cx="0" cy="0" r="16" fill="#FFC0CB" opacity="0.9" />
            <circle cx="8" cy="-6" r="12" fill="#FFB7C5" opacity="0.85" />
            <circle cx="0" cy="0" r="3" fill="#E65C83" />
          </g>
        </svg>
      </motion.div>

      {/* Top Right Branch */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, rotate: 5 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        className="absolute -top-12 -right-12 w-80 sm:w-96 lg:w-[500px] h-auto scale-x-[-1]"
      >
        <svg
          viewBox="0 0 500 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full drop-shadow-md"
        >
          {/* Main Branches */}
          <path
            d="M-20 -20 C 90 50, 200 40, 300 130 C 360 190, 440 230, 490 220"
            stroke="#7A5057"
            strokeWidth="9"
            strokeLinecap="round"
          />
          <path
            d="M 200 40 C 240 90, 280 110, 330 100"
            stroke="#7A5057"
            strokeWidth="5"
            strokeLinecap="round"
          />

          {/* Blossom Clusters */}
          <g transform="translate(200, 40)">
            <circle cx="0" cy="0" r="20" fill="#FFB7C5" opacity="0.9" />
            <circle cx="10" cy="8" r="15" fill="#FF99AC" opacity="0.9" />
            <circle cx="-12" cy="-6" r="14" fill="#FFE4E1" opacity="0.95" />
            <circle cx="0" cy="0" r="4" fill="#D84373" />
          </g>

          <g transform="translate(300, 130)">
            <circle cx="0" cy="0" r="24" fill="#FFC0CB" opacity="0.9" />
            <circle cx="-12" cy="10" r="18" fill="#FFB7C5" opacity="0.85" />
            <circle cx="14" cy="-8" r="16" fill="#FF99AC" opacity="0.9" />
            <circle cx="0" cy="0" r="5" fill="#E65C83" />
          </g>

          <g transform="translate(490, 220)">
            <circle cx="0" cy="0" r="20" fill="#FFB7C5" opacity="0.9" />
            <circle cx="-8" cy="-8" r="14" fill="#FFE4E1" opacity="0.95" />
            <circle cx="6" cy="6" r="14" fill="#FF99AC" opacity="0.9" />
            <circle cx="0" cy="0" r="4" fill="#D84373" />
          </g>
        </svg>
      </motion.div>
    </div>
  );
}
