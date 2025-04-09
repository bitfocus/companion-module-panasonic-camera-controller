import { InstanceBase, runEntrypoint } from '@companion-module/base'
import { initActions } from './actions.js'
import { API } from './api.js'
import { initFeedbacks } from './feedbacks.js'
import { initProduct } from './models.js'
import { setPolling, checkConnection } from './polling.js'
import { initPresets } from './presets.js'
import UpgradeScripts from './upgrades.js'
import { initVariables, checkVariables } from './vars.js'
import { getConfigDefinitions } from './config.js'

class PTZControlerInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
		this.data = {}
		this.polling = {}
		this.product
	}

	async init(config) {
		this.data = {
			camera: 'NaN',
			group: 'NaN',
			port: 'NaN',
		}
		this.polling = {
			alt: false,
			pause: true,
		}

		this.config = config
		this.config.model = this.config.model || 'AW-RP50'
		this.config.enablePolling = this.config.enablePolling || true

		this.api = new API(config)
		await this.configUpdated(config)
	}

	async destroy() {
		if (this.socket !== undefined) {
			this.socket.destroy()
		}

		if (this.polling.interval) {
			clearInterval(this.polling.interval)
		}

		if (this.retryConnection) {
			clearInterval(this.retryConnection)
		}

		this.debug('destroy', this.id)
	}

	async configUpdated(config) {
		var updatePolling = false

		// Update API only if config changes are relevant
		if (config.host != this.config.host || config.httpPort != this.config.httpPort) {
			this.api.updateConfig(config)
		}
		// Indicate to (re)init polling only if config changes are relevant
		if (
			(config.enablePolling && !this.polling.interval) ||
			config.apiPollInterval != this.config.apiPollInterval ||
			config.enablePolling != this.config.enablePolling
		) {
			updatePolling = true
		}

		this.config = config
		this.product = initProduct(this.config.model)

		if (updatePolling) {
			// (Re)init polling here, after applying config changes
			setPolling(this)
		}
		initActions(this)
		initFeedbacks(this)
		this.checkFeedbacks()
		initPresets(this)
		initVariables(this)
		checkVariables(this)
		checkConnection(this)
	}

	getConfigFields() {
		return getConfigDefinitions()
	}
}

runEntrypoint(PTZControlerInstance, UpgradeScripts)
