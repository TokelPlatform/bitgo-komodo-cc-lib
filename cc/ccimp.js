var ccimp
if (process.browser)
  ccimp = import('@tokel/cryptoconditions');
else
  ccimp = require('@tokel/cryptoconditions');
exports.ccimp = ccimp