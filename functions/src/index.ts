import { setGlobalOptions } from "firebase-functions";

setGlobalOptions({ maxInstances: 10 });

export { bylWebhook } from "./bylWebhook.js";
export { bylCheckout } from "./bylCheckout.js";
export { bylConfirm } from "./bylConfirm.js";
