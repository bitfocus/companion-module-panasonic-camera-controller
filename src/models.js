export const MODELS = [
	{ id: 'AW-RP50', label: 'AW-RP50' },
	{ id: 'AW-RP60', label: 'AW-RP60' },
	{ id: 'AW-RP120', label: 'AW-RP120' },
	{ id: 'AW-RP150', label: 'AW-RP150' },
	{ id: 'AW-RP200', label: 'AW-RP200' },
]

export const DEFAULT_MODEL = 'AW-RP50'

export const PRODUCTS = {
	'AW-RP50': {
		numberOfCameras: 100,
		numberOfGroups: 20,
		numberOfPorts: 5,
		presetMemory: false,
		tracingMemory: false,
	},
	'AW-RP60': {
		numberOfCameras: 200,
		numberOfGroups: 40,
		numberOfPorts: 5,
		numberOfPresets: 100,
		presetMemory: true,
		tracingMemory: false,
	},
	'AW-RP120': {
		numberOfCameras: 100,
		numberOfGroups: 10,
		numberOfPorts: 10,
		numberOfPresets: 100,
		numberOfTracing: 10,
		presetMemory: true,
		tracingMemory: true,
	},
	'AW-RP150': {
		numberOfCameras: 200,
		numberOfGroups: 20,
		numberOfPorts: 10,
		numberOfPresets: 100,
		numberOfTracing: 10,
		presetMemory: true,
		tracingMemory: true,
	},
	'AW-RP200': {
		numberOfCameras: 200,
		numberOfGroups: 20,
		numberOfPorts: 10,
		numberOfPresets: 100,
		numberOfTracing: 10,
		presetMemory: true,
		tracingMemory: true,
	},
}

const productCache = new Map()

// Pure factory: returns a frozen, per-model product (camera/group/port/preset/tracing
// counts + capability flags), memoized by model. The numeric ranges drive the number
// input fields in actions/feedbacks/presets. Unknown models fall back to the default
// instead of crashing.
export function initProduct(model) {
	const key = PRODUCTS[model] ? model : DEFAULT_MODEL

	let product = productCache.get(key)
	if (!product) {
		product = Object.freeze({ ...PRODUCTS[key] })
		productCache.set(key, product)
	}
	return product
}
