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
        width: window.IsaWidgetConfig?.width || 400,
        height: window.IsaWidgetConfig?.height || 650
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
        iframe.addEventListener('load', function() {
            console.log('Widget Chatbot Isa cargado correctamente');
        });
    }
    
    /**
     * Obtiene los estilos CSS para el widget
     */
    function getWidgetStyles() {
        var isRight = config.position === 'bottom-right';
        var styles = [
            'position: fixed',
            isRight ? 'right: 0' : 'left: 0',
            'bottom: 0',
            'width: ' + config.width + 'px',
            'height: ' + config.height + 'px',
            'border: none',
            'z-index: ' + config.zIndex,
            'box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2)',
            'border-radius: 20px 20px 0 0',
            'transition: all 0.3s ease'
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
            @media (max-width: 768px) {
                #isa-chatbot-widget {
                    width: 100% !important;
                    height: 100vh !important;
                    border-radius: 0 !important;
                    right: 0 !important;
                    left: 0 !important;
                }
            }
            
            @media (max-width: 1024px) and (min-width: 769px) {
                #isa-chatbot-widget {
                    width: 350px !important;
                    height: 600px !important;
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


