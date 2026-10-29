import { useEffect, useRef } from 'react';
import { api } from '../api/client';

/**
 * Browser-level proctoring listeners. Fire-and-forget posts to the API.
 * Debounces blur/visibility a bit so rapid focus flips don't spam.
 */
export function useProctoring(attemptId, enabled, rules = {}) {
  const lastSent = useRef({});

  useEffect(() => {
    if (!enabled || !attemptId) return undefined;

    function shouldCapture(type) {
      const map = {
        tab_switch: rules.captureTabSwitch !== false,
        window_blur: rules.captureWindowBlur !== false,
        fullscreen_exit: rules.captureFullscreenExit !== false,
        copy_attempt: rules.captureCopy !== false,
        paste_attempt: rules.capturePaste !== false,
        right_click_attempt: rules.captureRightClick !== false,
      };
      return map[type] !== false;
    }

    function send(type, meta = {}) {
      if (!shouldCapture(type)) return;
      const now = Date.now();
      if (now - (lastSent.current[type] || 0) < 800) return;
      lastSent.current[type] = now;
      api(`/attempts/${attemptId}/proctoring-events`, {
        method: 'POST',
        body: { type, meta, occurredAt: new Date().toISOString() },
      }).catch(() => {
        /* ignore network blips during attempt */
      });
    }

    function onVisibility() {
      if (document.hidden) send('tab_switch');
    }

    function onBlur() {
      send('window_blur');
    }

    function onFullscreen() {
      if (!document.fullscreenElement) send('fullscreen_exit');
    }

    function onCopy(e) {
      send('copy_attempt');
      e.preventDefault();
    }

    function onPaste(e) {
      send('paste_attempt');
      e.preventDefault();
    }

    function onContextMenu(e) {
      send('right_click_attempt');
      e.preventDefault();
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFullscreen);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFullscreen);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [attemptId, enabled, rules]);
}
