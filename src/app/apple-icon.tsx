import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon (iOS): the Headroom mark on its gradient. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2f6bff, #7b61ff 52%, #ff7e51)",
        }}
      >
        <svg width="150" height="150" viewBox="0 0 64 64" fill="none">
          <g stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="16" y="13" width="32" height="38" rx="7" />
            <path d="M10 24h6M10 32h6M10 40h6M48 24h6M48 32h6M48 40h6" />
            <path d="M26.5 25.5 32 20l5.5 5.5" />
          </g>
          <rect x="21.5" y="38" width="21" height="7.5" rx="2.5" fill="#fff" />
          <rect x="21.5" y="30.5" width="21" height="5" rx="2" fill="#fff" fillOpacity="0.55" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
