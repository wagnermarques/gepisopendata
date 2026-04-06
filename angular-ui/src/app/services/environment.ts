export const isTauri = (): boolean => 
  !!(window as any).__TAURI__ || 
  !!(window as any).__TAURI_INTERNALS__ || 
  navigator.userAgent.includes('Tauri');
