(function() {
    console.log("[OFFLINE PATCH] Initializing WebSocket & Network Shim (Echo Mode)...");
    
    const OriginalWebSocket = window.WebSocket;

    class MockWebSocket extends EventTarget {
        constructor(url, protocols) {
            super();
            console.log(`[OFFLINE PATCH] Intercepted WebSocket connection to: ${url}`);
            this.url = url;
            this.readyState = 0; // CONNECTING
            
            setTimeout(() => {
                console.log(`[OFFLINE PATCH] Simulating WebSocket Open for ${url}`);
                this.readyState = 1; // OPEN
                if (this.onopen) {
                    this.onopen({ type: 'open' });
                }
                this.dispatchEvent(new Event('open'));
            }, 100);
        }

        send(data) {
            if (data instanceof ArrayBuffer) {
                const view = new Uint8Array(data);
                console.log(`[OFFLINE PATCH] WebSocket.send received bytes:`, view);
                
                // FUZZING STRATEGY V3:
                // Error: "MagicNumber should be 0xF0 (240) or 0xF3 (243). Is: 1"
                // This means our previous attempt (starting with 1) failed the first check.
                // The client sent [243, 6, ...]. So it expects 243 back (or 240).
                // The previous error "unexpected msgType 6" means it DOESN'T want type 6 back.
                
                // Hypothesis: 
                // Byte 0: Magic Number (Keep 243 / 0xF3)
                // Byte 1: Message Type (Change 6 -> 1 for 'Connect Accept'?)
                
                setTimeout(() => {
                    const response = new Uint8Array(view); // Copy original payload
                    
                    response[0] = 243; // Magic Number (Fixes "MagicNumber should be 0xF0 or 0xF3")
                    response[1] = 1;   // Message Type (Fixes "unexpected msgType 6")
                    
                    // We keep the rest of the bytes (2..7) assuming they are session/version IDs
                    
                    console.log(`[OFFLINE PATCH] Sending response [${response[0]}, ${response[1]}, ...]:`, response);
                    
                    const event = new MessageEvent('message', {
                        data: response.buffer,
                        origin: this.url,
                        lastEventId: '',
                        source: null,
                        ports: []
                    });
                    
                    if (this.onmessage) {
                        this.onmessage(event);
                    }
                    this.dispatchEvent(event);
                }, 50);
            } else {
                 console.log(`[OFFLINE PATCH] WebSocket.send received non-binary:`, data);
            }
        }

        close() {
            console.log(`[OFFLINE PATCH] WebSocket.close called for ${this.url}`);
            this.readyState = 3; // CLOSED
            if (this.onclose) {
                this.onclose({ type: 'close', wasClean: true });
            }
            this.dispatchEvent(new Event('close'));
        }
    }

    window.WebSocket = MockWebSocket;
    
    Object.defineProperty(navigator, "onLine", {
        get: () => true
    });

    console.log("[OFFLINE PATCH] Network Shim Active (Echo Mode).");
})();