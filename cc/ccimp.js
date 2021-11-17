if (process.browser)
  module.exports = import('@tokel/cryptoconditions-js');
else
  module.exports = require('@tokel/cryptoconditions-js');
