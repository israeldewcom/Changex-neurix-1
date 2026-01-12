const path = require('path');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Fix for ajv
      webpackConfig.resolve = {
        ...webpackConfig.resolve,
        alias: {
          ...webpackConfig.resolve.alias,
          'ajv/dist/compile/codegen': path.resolve(__dirname, 'node_modules/ajv/dist/compile/codegen'),
          'ajv-keywords': path.resolve(__dirname, 'node_modules/ajv-keywords')
        }
      };
      
      // Fix for Node 24
      webpackConfig.resolve.fallback = {
        ...webpackConfig.resolve.fallback,
        "path": require.resolve("path-browserify"),
        "fs": false,
        "os": false
      };
      
      return webpackConfig;
    }
  }
};
