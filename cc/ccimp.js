var ccimp
if (process.browser)
  ccimp = import('cryptoconditions-js/pkg/cryptoconditions.js');
else
  ccimp = require('cryptoconditions-js/pkg/cryptoconditions.js');
exports.ccimp = ccimp