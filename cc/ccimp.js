if (process.browser)
  module.exports = import('cryptoconditions-js/pkg/cryptoconditions.js');
else
  module.exports = require('cryptoconditions-js/pkg/cryptoconditions.js');
