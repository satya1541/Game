import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress React DevTools message and all Vite development logs
if (typeof window !== 'undefined') {
  // Suppress React DevTools message
  (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    ...(window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__,
    supportsFiber: true,
    inject: () => {},
    onCommitFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
  };

  // Suppress all Vite and development console logs
  const originalConsole = { ...console };
  
  const suppressedMessages = [
    '[vite]',
    'Download the React DevTools',
    'hot updated:',
    'connecting...',
    'connected.',
    'server connection lost',
    'Polling for restart',
    'hmr update'
  ];

  const shouldSuppressMessage = (args: any[]) => {
    const message = args.join(' ');
    return suppressedMessages.some(suppressedMsg => 
      message.includes(suppressedMsg)
    );
  };

  console.log = (...args) => {
    if (!shouldSuppressMessage(args)) {
      originalConsole.log(...args);
    }
  };

  console.debug = (...args) => {
    if (!shouldSuppressMessage(args)) {
      originalConsole.debug(...args);
    }
  };

  console.info = (...args) => {
    if (!shouldSuppressMessage(args)) {
      originalConsole.info(...args);
    }
  };

  console.warn = (...args) => {
    if (!shouldSuppressMessage(args)) {
      originalConsole.warn(...args);
    }
  };
}

createRoot(document.getElementById("root")!).render(<App />);
