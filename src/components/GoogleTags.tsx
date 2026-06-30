"use client";

import { useEffect, useState } from "react";

/**
 * GoogleTags — Componente que injeta Google Analytics, GTM e scripts
 * customizados no <head> e <body> do site.
 * Carrega as configurações do banco via API pública.
 */
export default function GoogleTags() {
   const [loaded, setLoaded] = useState(false);

   useEffect(() => {
      if (loaded) return;

      const loadTags = async () => {
         try {
            const res = await fetch("/api/tags");
            const data = await res.json();

            // Google Analytics (GA4)
            const gaId = data.google_analytics_id;
            if (gaId && gaId.trim()) {
               // Injetar script do gtag.js
               const gaScript = document.createElement("script");
               gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${gaId.trim()}`;
               gaScript.async = true;
               document.head.appendChild(gaScript);

               // Injetar configuração do gtag
               const gaConfig = document.createElement("script");
               gaConfig.innerHTML = `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${gaId.trim()}');
               `;
               document.head.appendChild(gaConfig);
            }

            // Google Tag Manager (GTM)
            const gtmId = data.google_tag_manager_id;
            if (gtmId && gtmId.trim()) {
               // Script GTM no <head>
               const gtmScript = document.createElement("script");
               gtmScript.innerHTML = `
                  (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
                  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
                  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
                  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                  })(window,document,'script','dataLayer','${gtmId.trim()}');
               `;
               document.head.appendChild(gtmScript);

               // Noscript GTM no <body>
               const noscript = document.createElement("noscript");
               const iframe = document.createElement("iframe");
               iframe.src = `https://www.googletagmanager.com/ns.html?id=${gtmId.trim()}`;
               iframe.height = "0";
               iframe.width = "0";
               iframe.style.display = "none";
               iframe.style.visibility = "hidden";
               noscript.appendChild(iframe);
               document.body.insertBefore(noscript, document.body.firstChild);
            }

            // Scripts customizados no <head>
            const customHead = data.custom_head_scripts;
            if (customHead && customHead.trim()) {
               const container = document.createElement("div");
               container.innerHTML = customHead.trim();
               // Extrair e executar scripts
               const scripts = container.querySelectorAll("script");
               scripts.forEach((script) => {
                  const newScript = document.createElement("script");
                  if (script.src) {
                     newScript.src = script.src;
                     newScript.async = true;
                  } else {
                     newScript.innerHTML = script.innerHTML;
                  }
                  // Copiar atributos
                  Array.from(script.attributes).forEach((attr) => {
                     if (attr.name !== "src") {
                        newScript.setAttribute(attr.name, attr.value);
                     }
                  });
                  document.head.appendChild(newScript);
               });
               // Adicionar elementos não-script (links, metas, etc.)
               const nonScripts = container.querySelectorAll(":not(script)");
               nonScripts.forEach((el) => {
                  document.head.appendChild(el.cloneNode(true));
               });
            }

            // Scripts customizados no <body>
            const customBody = data.custom_body_scripts;
            if (customBody && customBody.trim()) {
               const container = document.createElement("div");
               container.innerHTML = customBody.trim();
               const scripts = container.querySelectorAll("script");
               scripts.forEach((script) => {
                  const newScript = document.createElement("script");
                  if (script.src) {
                     newScript.src = script.src;
                     newScript.async = true;
                  } else {
                     newScript.innerHTML = script.innerHTML;
                  }
                  Array.from(script.attributes).forEach((attr) => {
                     if (attr.name !== "src") {
                        newScript.setAttribute(attr.name, attr.value);
                     }
                  });
                  document.body.appendChild(newScript);
               });
            }

            setLoaded(true);
         } catch (err) {
            console.error("Failed to load tracking tags:", err);
         }
      };

      loadTags();
   }, [loaded]);

   return null;
}
