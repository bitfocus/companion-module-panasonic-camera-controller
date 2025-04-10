import { InstanceBase, InstanceStatus, runEntrypoint } from '@companion-module/base'
import { setActions } from './actions.js'
import { setFeedbacks } from './feedbacks.js'
import { initProduct } from './models.js'
import { setPresets } from './presets.js'
import UpgradeScripts from './upgrades.js'
import { setVariables, checkVariables } from './vars.js'
import { ConfigFields } from './config.js'

class PTZControllerInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		this.data = {}
		this.product

		this.pollID = null
	}

	async init(config) {
		this.config = config

		this.data = {
			camera: 'NaN',
			group: 'NaN',
			port: 'NaN',
		}

		this.config = config
		this.config.model = this.config.model || 'AW-RP50'
		this.config.enablePolling = this.config.enablePolling || true

		this.product = initProduct(this.config.model)

		this.init_variables()
		this.init_actions()
		this.init_feedbacks()
		this.init_presets()

		this.checkVariables()

		this.controller = new AbortController()

		this.pullData()

		if (this.config.enablePolling) {
			this.enablePolling()
		}
	}

	async destroy() {
		this.disablePolling()
		this.controller.abort()
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async configUpdated(config) {
		this.disablePolling()
		this.controller.abort()
		this.updateStatus(InstanceStatus.Disconnected, 'Config changed')

		this.init(config)
	}

	enablePolling() {
		clearInterval(this.pollID)
		this.pollID = setInterval(() => this.pullData(), this.config.apiPollInterval)
		this.log('debug', 'Polling enabled with ' + this.config.apiPollInterval + 'ms interval')
	}

	disablePolling() {
		clearInterval(this.pollID)
		this.pollID = null
		this.log('debug', 'Polling disabled')
	}

	async sendCommand(cmd) {
		this.log('debug', 'sendCommand()')

		const options = {
			signal: AbortSignal.any([AbortSignal.timeout(10000), this.controller.signal]),
		}

		try {
			await this.getAPI(cmd, options)

			this.checkVariables()
			this.checkFeedbacks()
		} catch (error) {
			this.log('debug', 'FAILED ' + String(error))
		} finally {
			// force status update
			if (!this.config.enablePolling) this.pullData()
		}
	}

	async pullData() {
		this.log('debug', 'pullData()')

		const cmds = [`XQC:01`, `XQC:02`]

		const c = new AbortController()
		const t = AbortSignal.timeout(this.config.apiPollInterval - 100)

		const options = { method: 'GET',
		signal: AbortSignal.any([t, c.signal, this.controller.signal])
	}

		const requests = cmds.map((cmd) => this.getAPI(cmd, options))

		const start = Date.now()
		try {
			await Promise.all(requests)
			this.log('debug', `...all done after ${Date.now() - start}ms`)

			this.checkVariables()
			this.checkFeedbacks()
		} catch (error) {
			c.abort() // cancel any OTHER pending request

			this.log('error', String(error))
			this.log('debug', `...errored after ${Date.now() - start}ms`)

			this.updateStatus(InstanceStatus.ConnectionFailure, String(error))
		}
	}

	async getAPI(cmd, options) {
		const url = `http://${this.config.host}:${this.config.httpPort}/cgi-bin/aw_cam?cmd=${cmd}&res=1`
		this.log('debug', 'GET ' + url)

		//options.mode = 'no-cors'

		const myRequest = new Request(url, options);

		const response = await fetch(myRequest)
		if (!response.ok || !response.status == 200) throw new Error(`HTTP error: ${response.status}`)

		this.updateStatus(InstanceStatus.Ok)
		this.parseData(response.body)

		return response.body
	}

	parseData(body) {
		body = body.trim()
		const lines = body.split('\r\n')
		const line = lines[0].trim()
		const response = line.split(':')
		this.log('debug', 'Response: ' + line)

		switch (response[0]) {
			case 'XPT':
				this.data.port = response[1]
				break
			case 'XGP':
				this.data.group = response[1]
				break
			case 'XCN':
			case 'XQC':
				switch (response[1]) {
					case '01':
						this.data.camera = response[2]
						break
					case '02':
						this.data.group = response[2]
						this.data.port = response[3]
						break
				}
				break
			case 'XPM':
				switch (response[1]) {
					case '01':
						// Preset memory play
						break
				}
				break
			case 'XTM':
				switch (response[1]) {
					case '00':
						// TMEM standby
						break
					case '01':
						// TMEM play
						break
					case '02':
						// TMEM stop
						break
				}
				break
		}
	}

	// Return config fields for web config
	getConfigFields() {
		return ConfigFields
	}

	// ##########################
	// #### Instance Actions ####
	// ##########################
	init_actions() {
		this.setActionDefinitions(setActions(this))
	}

	// ############################
	// #### Instance Feedbacks ####
	// ############################
	init_feedbacks() {
		this.setFeedbackDefinitions(setFeedbacks(this))
	}

	// ############################
	// #### Instance Variables ####
	// ############################
	init_variables() {
		this.setVariableDefinitions(setVariables(this))
	}

	// Update Values
	checkVariables() {
		checkVariables(this)
	}

	// ##########################
	// #### Instance Presets ####
	// ##########################
	init_presets() {
		this.setPresetDefinitions(setPresets(this))
	}
}

runEntrypoint(PTZControllerInstance, UpgradeScripts)
