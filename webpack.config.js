const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
	...defaultConfig,
	entry: {
		index: path.resolve(process.cwd(), 'src', 'index.js'),
		view: path.resolve(process.cwd(), 'src', 'view.js'),
	},
	// Enable source maps in development for easier debugging
	devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
	// Optimization configuration
	optimization: {
		...defaultConfig.optimization,
		// Split vendor code for better caching
		splitChunks: {
			cacheGroups: {
				// Separate Leaflet and React-Leaflet into vendor chunk
				vendor: {
					test: /[\\/]node_modules[\\/](leaflet|react-leaflet)[\\/]/,
					name: 'vendor',
					chunks: 'all',
					priority: 10,
				},
				// Separate other node_modules
				commons: {
					test: /[\\/]node_modules[\\/]/,
					name: 'commons',
					chunks: 'all',
					priority: 5,
				},
			},
		},
		// Minimize only in production
		minimize: process.env.NODE_ENV === 'production',
	},
	// Performance hints
	performance: {
		hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
		maxEntrypointSize: 512000, // 500kb
		maxAssetSize: 512000, // 500kb
	},
};

