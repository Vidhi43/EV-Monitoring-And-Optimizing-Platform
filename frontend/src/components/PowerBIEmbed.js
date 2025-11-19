// src/components/PowerBIEmbed.js
import React, { useEffect, useRef } from "react";
import { models, service, factories } from "powerbi-client";

/**
 * Fully React-safe Power BI embed component
 * - Guards against null refs
 * - Works with StrictMode / React 18
 * - Cleans up only if an embed exists
 */
export default function PowerBIEmbed({ embedConfig }) {
  const containerRef = useRef(null);
  const powerbiService = useRef(
    new service.Service(
      factories.hpmFactory,
      factories.wpmpFactory,
      factories.routerFactory
    )
  ).current;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !embedConfig?.embedUrl || !embedConfig?.accessToken) {
      return;
    }

    // Always remove any prior embed safely
    try {
      powerbiService.reset(container);
    } catch (_) {
      /* ignore */
    }

    const config = {
      type: "report",
      tokenType: models.TokenType.Embed,
      accessToken: embedConfig.accessToken,
      embedUrl: embedConfig.embedUrl,
      id: embedConfig.reportId,
      settings: {
        filterPaneEnabled: false,
        navContentPaneEnabled: true,
      },
    };

    // Try to embed the report
    try {
      powerbiService.embed(container, config);
      console.log("✅ Power BI report embedded");
    } catch (err) {
      console.error("❌ Power BI embed failed:", err);
    }

    // Cleanup only if the instance exists
    return () => {
      try {
        if (container && powerbiService.get(container)) {
          powerbiService.reset(container);
          console.log("🧹 Cleaned up Power BI instance");
        }
      } catch (_) {
        /* ignore */
      }
    };
  }, [embedConfig, powerbiService]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "320px",
        border: "1px solid #ccc",
        borderRadius: "6px",
      }}
    >
      {!embedConfig?.embedUrl && (
        <p style={{ textAlign: "center", paddingTop: "100px", color: "#666" }}>
          Power BI analytics will appear here.
        </p>
      )}
    </div>
  );
}
