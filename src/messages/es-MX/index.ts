import auth from "./auth.json";
import common from "./common.json";
import errors from "./errors.json";
import home from "./home.json";

const messages = {
  ...common,
  ...errors,
  ...auth,
  ...home,
};

export default messages;
