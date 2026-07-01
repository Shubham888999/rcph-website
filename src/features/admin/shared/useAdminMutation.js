import { useCallback, useRef, useState } from "react";
import { adminDiagnostic, safeAdminError } from "./adminErrors";

export default function useAdminMutation({ uid, module, onNotice }) {
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const run = useCallback(async (operation, request, success, options = {}) => {
    if (lock.current) return null; lock.current = true; setBusy(true);
    try { const result = await request(); onNotice?.({ type: "success", message: success }); return result; }
    catch (error) { if (import.meta.env.DEV) console.error("Admin mutation failed.", adminDiagnostic(error, operation, module, uid)); const handled = options.onError?.(error) === true; if (!handled) onNotice?.({ type: "error", message: safeAdminError(error) }); return null; }
    finally { lock.current = false; setBusy(false); }
  }, [module, onNotice, uid]);
  return { busy, run };
}
