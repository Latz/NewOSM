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
	output: {
		...defaultConfig.output,
		// Lazy-loaded chunks (e.g. src/index.js's dynamic import() of
		// MapEditor.js) otherwise get a static, unhashed filename that
		// never changes between builds and has no WP-side cache-busting
		// query string like the main entry bundles do — a browser that
		// cached it once can keep serving a stale version indefinitely.
		chunkFilename: '[name].[contenthash].js',
	},
	// Optimization configuration
	optimization: {
		...defaultConfig.optimization,
		// Enable tree shaking to remove unused exports
		usedExports: true,
		// Selective code splitting for vendor libraries only
		// Leaflet and react-leaflet are extracted to a shared chunk to eliminate duplication
		splitChunks: {
			cacheGroups: {
				// Preserve @wordpress/scripts default CSS splitting
				style: {
					type: 'css/mini-extract',
					test: /[\\/]style(\.module)?\.(sc|sa|c)ss$/,
					chunks: 'all',
					enforce: true,
					name(module, chunks, cacheGroupKey) {
						return `${cacheGroupKey}-${chunks[0].name}`;
					},
				},
				// Extract Leaflet vendor libraries to shared chunk
				// This eliminates ~145KB duplicate Leaflet from view.js and 464.js
				leafletVendor: {
					test: /[\\/]node_modules[\\/](leaflet|react-leaflet|leaflet\.fullscreen)/,
					name: 'leaflet-vendor',
					chunks: 'all',
					priority: 20, // Higher priority than default
					reuseExistingChunk: true,
					enforce: true,
				},
				// Disable default splitting to maintain WordPress compatibility
				default: false,
				defaultVendors: false,
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
	// Copy static assets to build directory
	plugins: [
		...defaultConfig.plugins,
		new CopyWebpackPlugin({
			patterns: [
				{
					from: path.resolve(process.cwd(), 'src', 'block.json'),
					to: path.resolve(process.cwd(), 'build', 'block.json'),
				},
				{
					from: path.resolve(process.cwd(), 'src', 'service-worker.js'),
					to: path.resolve(process.cwd(), 'build', 'service-worker.js'),
				},
			],
		}),
	],
};
