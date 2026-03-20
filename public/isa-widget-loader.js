/**
 * Script de carga dinámica para el Widget Chatbot Isa
 * 
 * Uso: Agrega este script antes del cierre de </body> en tu CRM
 * <script src="https://tudominio.com/widget-chatbot/isa-widget-loader.js"></script>
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
        width: window.IsaWidgetConfig?.width || 400,
        height: window.IsaWidgetConfig?.height || 650,
        closedWidth: window.IsaWidgetConfig?.closedWidth || 280,
        closedHeight: window.IsaWidgetConfig?.closedHeight || 96,
        edgeOffset: window.IsaWidgetConfig?.edgeOffset || 20
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
        if (config.apiBaseUrl !== undefined && config.apiBaseUrl !== '') {
            var sep = widgetSrc.indexOf('?') >= 0 ? '&' : '?';
            iframe.src = widgetSrc + sep + 'apiBaseUrl=' + encodeURIComponent(config.apiBaseUrl);
        } else {
            iframe.src = widgetSrc;
        }
        iframe.title = 'Chatbot Isa';
        iframe.setAttribute('allow', 'microphone');
        iframe.setAttribute('frameborder', '0');
        iframe.setAttribute('scrolling', 'no');
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
        window.addEventListener('message', function(event) {
            var data = event.data;
            if (!data || data.source !== 'isa-widget-chat' || data.type !== 'resize') return;
            var expectedOrigin = getWidgetOrigin();
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
        });
    }
    
    /**
     * Estilos iniciales del iframe: compacto hasta que el widget envíe el primer resize
     */
    function getWidgetStyles() {
        var isRight = config.position === 'bottom-right';
        var off = (typeof config.edgeOffset === 'number' ? config.edgeOffset : 20) + 'px';
        var cw = config.closedWidth || 280;
        var ch = config.closedHeight || 96;
        var styles = [
            'position: fixed',
            isRight ? 'right: ' + off : 'left: ' + off,
            'bottom: ' + off,
            'width: ' + cw + 'px',
            'height: ' + ch + 'px',
            'border: none',
            'z-index: ' + config.zIndex,
            'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18)',
            'border-radius: 16px',
            'transition: width 0.25s ease, height 0.25s ease',
            'background: transparent',
            'overflow: hidden'
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
            /* En móvil el widget puede ocupar pantalla completa; el iframe sigue controlando tamaño vía postMessage en escritorio */
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


