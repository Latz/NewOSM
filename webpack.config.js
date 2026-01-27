const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	...defaultConfig,
	entry: {
		index: path.resolve(process.cwd(), 'src', 'index.js'),
		view: path.resolve(process.cwd(), 'src', 'view.js'),
		'style-index': path.resolve(process.cwd(), 'src', 'style.js'),
	},
	// Enable source maps in development for easier debugging
	devtool: process.env.NODE_ENV === 'development' ? 'source-map' : false,
	// Optimization configuration
	optimization: {
		...defaultConfig.optimization,
		// Disable code splitting for WordPress compatibility
		// WordPress block registration doesn't automatically handle split chunks
		splitChunks: false,
		// Minimize only in production
		minimize: process.env.NODE_ENV === 'production',
	},
	// Performance hints
	performance: {
		hints: process.env.NODE_ENV === 'production' ? 'warning' : false,
		maxEntrypointSize: 512000, // 500kb
		maxAssetSize: 512000, // 500kb
	},
	// Copy block.json to build directory
	plugins: [
		...defaultConfig.plugins,
		new CopyWebpackPlugin({
			patterns: [
				{
					from: path.resolve(process.cwd(), 'src', 'block.json'),
					to: path.resolve(process.cwd(), 'build', 'block.json'),
				},
			],
		}),
	],
};
