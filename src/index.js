import { InstanceBase, runEntrypoint } from '@companion-module/base'
import { initActions } from './actions.js'
import { API } from './api.js'
import { initFeedbacks } from './feedbacks.js'
import { initProduct } from './models.js'
import { setPolling } from './polling.js'
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

		this.config = config
		this.config.model = this.config.model || 'AW-RP50'
		this.config.enablePolling = this.config.enablePolling || true

		this.updateStatus('connecting')
		this.api = new API(config)
		this.configUpdated(config)
		this.updateStatus('ok')
	}

	async destroy() {
		if (this.socket !== undefined) {
			this.socket.destroy()
		}

		if (this.polling.interval) {
			clearInterval(this.polling.interval)
		}

		this.debug('destroy', this.id)
	}

	async configUpdated(config) {
		const self = this

		self.config = config
		this.updateStatus('connecting')
		this.updateStatus('unknown_error')

		// Update API only if config changes are relevant
		if (config.host != self.config.host || config.httpPort != self.config.httpPort) {
			self.api.updateConfig(config)
		}
		// Set polling only if config changes are relevant
		if ((config.enablePolling && !this.polling.interval) ||
			config.apiPollInterval != self.config.apiPollInterval ||
			config.enablePolling != self.config.enablePolling) {
            	setPolling(this)
        }

		self.config = config
		self.product = initProduct(self.config.model)
		
		initActions(this)
		initFeedbacks(this)
		self.checkFeedbacks()
		initPresets(this)
		initVariables(this)
		checkVariables(this)

		if (self.config.host) {
			this.updateStatus('ok')
		} else {
			this.updateStatus('bad_config', 'Missing host')
		}
	}

	getConfigFields() {
		return getConfigDefinitions()
	}
}

runEntrypoint(PTZControlerInstance, UpgradeScripts)