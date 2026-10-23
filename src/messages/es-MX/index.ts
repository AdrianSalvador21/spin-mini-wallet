import auth from "./auth.json";
import common from "./common.json";
import devTools from "./devTools.json";
import errors from "./errors.json";
import home from "./home.json";
import transfers from "./transfers.json";

const messages = {
  ...common,
  ...errors,
  ...auth,
  ...home,
  ...transfers,
  ...devTools,
};

export default messages;
