/**
 * Integración del widget en cualquier página (iframe + postMessage: resize, lightbox IA360).
 *
 * En tu HTML (antes de cargar este archivo):
 *   <script>
 *     window.IsaWidgetConfig = {
 *       widgetUrl: 'https://tudominio.com/',   // URL del build del widget (Vite)
 *       apiBaseUrl: 'https://api.tudominio.com', // opcional: backend API + socket (query ?apiBaseUrl=)
 *       position: 'bottom-right',
 *       zIndex: 9999,
 *       edgeOffset: 20,
 *       closedWidth: 200,
 *       closedHeight: 56,
 *       ia360SkipHistorial: false,
 *       iframeChrome: true   // opcional: borde/sombra del iframe (por defecto van ocultos)
 *     };
 *   </script>
 *   <script src="https://tudominio.com/isa-widget-loader.js"></script>
 *
 * Desarrollo local: widgetUrl 'http://localhost:3003/' y este script desde el mismo origen.
 */

(function() {
    'use strict';
    
    // Prevenir múltiples cargas
    if (window.IsaWidgetLoaded) {
        return;
    }
    window.IsaWidgetLoaded = true;
    
    // Configuración por defecto
    // apiBaseUrl: URL del backend (API + WebSocket). Si no se define, el widget usa el mismo origen que widgetUrl.
    var defaultConfig = {
        widgetUrl: window.IsaWidgetConfig?.widgetUrl || 'https://tudominio.com/widget-chatbot/index.html',
        apiBaseUrl: window.IsaWidgetConfig?.apiBaseUrl ?? '',
        position: window.IsaWidgetConfig?.position || 'bottom-right', // 'bottom-right' | 'bottom-left'
        zIndex: window.IsaWidgetConfig?.zIndex || 9999,
        // Tamaño máximo cuando el chat está abierto (el iframe se achica solo al cerrar vía postMessage)
        width: window.IsaWidgetConfig?.width || 350,
        height: window.IsaWidgetConfig?.height || 520,
        closedWidth: window.IsaWidgetConfig?.closedWidth || 200,
        closedHeight: window.IsaWidgetConfig?.closedHeight || 56,
        edgeOffset: window.IsaWidgetConfig?.edgeOffset || 20,
        referrerPolicy: window.IsaWidgetConfig?.referrerPolicy || 'no-referrer-when-downgrade',
        /** Por defecto sin borde ni sombra en el iframe (solo el botón). true = marco visible */
        iframeChrome: window.IsaWidgetConfig?.iframeChrome === true
    };
    
    var config = Object.assign({}, defaultConfig, window.IsaWidgetConfig || {});
    
    /**
     * Crea el iframe del widget
     */
    function createWidget() {
        // Verificar si ya existe
        if (document.getElementById('isa-chatbot-widget')) {
            return;
        }
        
        var iframe = document.createElement('iframe');
        iframe.id = 'isa-chatbot-widget';
        var widgetSrc = config.widgetUrl;
        var qs = [];
        if (config.apiBaseUrl !== undefined && config.apiBaseUrl !== '') {
            qs.push('apiBaseUrl=' + encodeURIComponent(config.apiBaseUrl));
        }
        var skipHist = config.ia360SkipHistorial;
        if (skipHist === true || skipHist === 'true' || skipHist === '1' || skipHist === 1) {
            qs.push('ia360SkipHistorial=1');
        }
        if (qs.length > 0) {
            var sep = widgetSrc.indexOf('?') >= 0 ? '&' : '?';
            iframe.src = widgetSrc + sep + qs.join('&');
        } else {
            iframe.src = widgetSrc;
        }
        iframe.title = window.IsaWidgetConfig?.iframeTitle || 'Chatbot Isa';
        iframe.setAttribute('allow', 'microphone; camera');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('scrolling', 'no');
        iframe.setAttribute('loading', 'lazy');
        if (config.referrerPolicy) {
            iframe.setAttribute('referrerpolicy', config.referrerPolicy);
        }
        iframe.style.cssText = getWidgetStyles();
        
        // Agregar al body
        document.body.appendChild(iframe);
        
        // Agregar estilos responsive
        addResponsiveStyles();
        
        // Evento de carga
        iframe.addEventListener('load', function() {});
        
        // Redimensionar iframe según el estado del chat (cerrado = solo burbuja, no tapa formularios)
        setupIframeResizeListener(iframe);
    }
    
    function getWidgetOrigin() {
        try {
            return new URL(config.widgetUrl).origin;
        } catch (e) {
            return '';
        }
    }
    
    function setupIframeResizeListener(iframe) {
        var hostImgLightbox = null;
        var hostLbKeyHandler = null;
        var hostLbBlobUrl = null;

        function closeHostImageLightbox(syncToIframe) {
            if (syncToIframe === undefined) syncToIframe = true;
            if (hostLbBlobUrl) {
                try {
                    URL.revokeObjectURL(hostLbBlobUrl);
                } catch (e) {}
                hostLbBlobUrl = null;
            }
            var hadOverlay = !!hostImgLightbox;
            if (hostLbKeyHandler) {
                document.removeEventListener('keydown', hostLbKeyHandler);
                hostLbKeyHandler = null;
            }
            if (hostImgLightbox) {
                hostImgLightbox.remove();
                hostImgLightbox = null;
            }
            if (hadOverlay && syncToIframe) {
                var w = iframe.contentWindow;
                var o = getWidgetOrigin();
                if (w && o) {
                    try {
                        w.postMessage({ source: 'isa-widget-chat', type: 'lightbox-sync-close' }, o);
                    } catch (e) {}
                }
            }
        }

        function openHostImageLightbox(src, alt, opts) {
            if (!src || typeof src !== 'string') return;
            closeHostImageLightbox(false);
            if (opts && opts.revokeOnClose) {
                hostLbBlobUrl = src;
            }
            var root = document.createElement('div');
            root.id = 'isa-host-img-lightbox';
            root.className = 'isa-host-img-lightbox';
            root.setAttribute('role', 'dialog');
            root.setAttribute('aria-modal', 'true');
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'isa-host-lb-close';
            btn.setAttribute('aria-label', 'Cerrar');
            btn.appendChild(document.createTextNode('\u00d7'));
            btn.addEventListener('click', function() { closeHostImageLightbox(true); });
            var inner = document.createElement('div');
            inner.className = 'isa-host-lb-inner';
            var img = document.createElement('img');
            img.src = src;
            img.alt = alt || '';
            img.referrerPolicy = 'no-referrer';
            inner.appendChild(img);
            root.appendChild(btn);
            root.appendChild(inner);
            root.addEventListener('click', function(e) {
                if (e.target === root) closeHostImageLightbox(true);
            });
            document.body.appendChild(root);
            hostImgLightbox = root;
            hostLbKeyHandler = function(e) {
                if (e.key === 'Escape') closeHostImageLightbox(true);
            };
            document.addEventListener('keydown', hostLbKeyHandler);
        }

        window.addEventListener('message', function(event) {
            var data = event.data;
            if (!data || data.source !== 'isa-widget-chat') return;
            var expectedOrigin = getWidgetOrigin();

            if (data.type === 'resize') {
                if (expectedOrigin && event.origin !== expectedOrigin) return;
                if (typeof data.width !== 'number' || typeof data.height !== 'number') return;
                var w = Math.max(80, Math.round(data.width));
                var h = Math.max(72, Math.round(data.height));
                if (data.open) {
                    var vw = window.innerWidth || 1024;
                    var vh = window.innerHeight || 768;
                    w = Math.min(w, vw - 24);
                    h = Math.min(h, vh - 24);
                }
                iframe.style.width = w + 'px';
                iframe.style.height = h + 'px';
                return;
            }

            if (data.type === 'lightbox-open') {
                if (expectedOrigin && event.origin !== expectedOrigin) return;
                if (typeof data.src === 'string') openHostImageLightbox(data.src, data.alt || '');
                return;
            }

            if (data.type === 'lightbox-open-blob' && data.imageBuffer instanceof ArrayBuffer) {
                if (expectedOrigin && event.origin !== expectedOrigin) return;
                var blob = new Blob([data.imageBuffer], { type: data.mime || 'image/png' });
                var url = URL.createObjectURL(blob);
                openHostImageLightbox(url, data.alt || '', { revokeOnClose: true });
                return;
            }

            if (data.type === 'lightbox-close') {
                if (expectedOrigin && event.origin !== expectedOrigin) return;
                closeHostImageLightbox(false);
            }
        });
    }
    
    /**
     * Estilos iniciales del iframe: compacto hasta que el widget envíe el primer resize
     */
    function getWidgetStyles() {
        var isRight = config.position === 'bottom-right';
        var off = (typeof config.edgeOffset === 'number' ? config.edgeOffset : 20) + 'px';
        var cw = config.closedWidth || 200;
        var ch = config.closedHeight || 56;
        var chrome = config.iframeChrome !== false;
        /* Borde corporativo + trazo neutro: se nota en fondo blanco y en gris; sombras suaves en capas */
        var border = chrome
            ? '1px solid rgba(0, 22, 137, 0.26)'
            : 'none';
        var shadow = chrome
            ? '0 0 0 1px rgba(0, 0, 0, 0.06), 0 4px 14px rgba(0, 22, 137, 0.14), 0 14px 40px rgba(0, 0, 0, 0.12)'
            : 'none';
        var styles = [
            'position: fixed',
            isRight ? 'right: ' + off : 'left: ' + off,
            'bottom: ' + off,
            'width: ' + cw + 'px',
            'height: ' + ch + 'px',
            'border: ' + border,
            'z-index: ' + config.zIndex,
            'box-shadow: ' + shadow,
            'border-radius: 16px',
            'transition: none',
            'background: transparent',
            'overflow: hidden',
            'box-sizing: border-box'
        ];
        return styles.join('; ');
    }
    
    /**
     * Agrega estilos responsive
     */
    function addResponsiveStyles() {
        // Verificar si ya se agregaron los estilos
        if (document.getElementById('isa-widget-styles')) {
            return;
        }
        
        var style = document.createElement('style');
        style.id = 'isa-widget-styles';
        style.textContent = `
            .isa-host-img-lightbox {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                display: flex;
                flex-direction: column;
                background: rgba(15, 23, 42, 0.92);
                backdrop-filter: blur(3px);
                box-sizing: border-box;
            }
            .isa-host-lb-close {
                position: fixed;
                top: 12px;
                right: 12px;
                z-index: 2147483647;
                width: 44px;
                height: 44px;
                border: none;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.18);
                color: #fff;
                font-size: 28px;
                line-height: 1;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .isa-host-lb-inner {
                flex: 1;
                min-height: 0;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 56px 12px 20px;
                overflow: auto;
                box-sizing: border-box;
            }
            .isa-host-lb-inner img {
                max-width: 100%;
                max-height: 100%;
                width: auto;
                height: auto;
                object-fit: contain;
                border-radius: 4px;
                box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
            }
            @media (max-width: 768px) {
                #isa-chatbot-widget {
                    width: 100% !important;
                    height: 100% !important;
                    max-height: 100dvh !important;
                    border-radius: 0 !important;
                    right: 0 !important;
                    left: 0 !important;
                    bottom: 0 !important;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Inicializar el widget
     */
    function init() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createWidget);
        } else {
            // DOM ya está listo
            createWidget();
        }
    }
    
    // Inicializar
    init();
    
    // Exponer API pública (opcional)
    window.IsaWidget = {
        show: function() {
            var widget = document.getElementById('isa-chatbot-widget');
            if (widget) {
                widget.style.display = 'block';
            }
        },
        hide: function() {
            var widget = document.getElementById('isa-chatbot-widget');
            if (widget) {
                widget.style.display = 'none';
            }
        },
        remove: function() {
            var widget = document.getElementById('isa-chatbot-widget');
            if (widget) {
                widget.remove();
            }
        }
    };
    
})();


