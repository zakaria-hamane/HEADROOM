import { ImageResponse } from "next/og";
import { CATALOG_STATS } from "@/lib/catalog";
import { siteConfig } from "@/lib/site";

export const alt = `${siteConfig.name}: ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background:
            "radial-gradient(900px 500px at 10% -10%, rgba(47,107,255,.38), transparent), radial-gradient(700px 420px at 100% 0%, rgba(255,126,81,.3), transparent), #080a15",
          color: "#eceffb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 26,
              background: "linear-gradient(135deg, #2f6bff, #7b61ff 52%, #ff7e51)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="84" height="84" viewBox="0 0 64 64" fill="none">
              <g stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="16" y="13" width="32" height="38" rx="7" />
                <path d="M10 24h6M10 32h6M10 40h6M48 24h6M48 32h6M48 40h6" />
                <path d="M26.5 25.5 32 20l5.5 5.5" />
              </g>
              <rect x="21.5" y="38" width="21" height="7.5" rx="2.5" fill="#fff" />
              <rect x="21.5" y="30.5" width="21" height="5" rx="2" fill="#fff" fillOpacity="0.55" />
            </svg>
          </div>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: 3 }}>
            <span>HEAD</span>
            <span style={{ color: "#38c9e0" }}>ROOM</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.02, maxWidth: 1000 }}>Know your GPU headroom before you buy.</div>
          <div style={{ fontSize: 30, color: "#a0a8ce", maxWidth: 1000 }}>The LLM plus its embedders, rerankers, OCR, speech and guardrail models: memory, speed and cost on one GPU budget.</div>
        </div>
        <div style={{ display: "flex", gap: 40, fontSize: 28, color: "#a0a8ce" }}>
          <span>{CATALOG_STATS.models} LLMs</span>
          <span>{CATALOG_STATS.companions} RAG &amp; agent models</span>
          <span>{CATALOG_STATS.gpus} GPUs</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
