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
			camera: null,
			group: null,
			port: null,
			pmem: null,
			tmem: null,
		}

		this.config = config
		this.config.polldelay = this.config.polldelay || 250
		this.config.polling = this.config.polling || true

		this.product = initProduct(this.config.model)

		this.init_variables()
		this.init_actions()
		this.init_feedbacks()
		this.init_presets()

		this.checkVariables()

		this.controller = new AbortController()

		this.updateStatus(InstanceStatus.Connecting)
		this.pullData()
	}

	async destroy() {
		clearTimeout(this.pollID)
		this.controller.abort()
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async configUpdated(config) {
		clearTimeout(this.pollID)
		this.controller.abort()
		this.updateStatus(InstanceStatus.Disconnected, 'Config changed')

		this.init(config)
	}

	async sendCommand(cmd) {
		this.log('debug', 'sendCommand()')

		const options = {
			headers: { Connection: 'close' },
			signal: AbortSignal.any([AbortSignal.timeout(2500), this.controller.signal]),
		}

		try {
			await this.getAPI(cmd, options)
		} catch (error) {
			// most controllers do not respond in any way after receiving a command.
			// they just close the tcp connection after the first line of the HTTP request was received.
		} finally {
			// force status update
			if (!this.config.polling) this.pullData()
		}
	}

	async pullData() {
		this.log('debug', 'pullData()')

		const t = AbortSignal.timeout(1 * 2500) // (this.config.polldelay - 50)

		const options = {
			headers: { Connection: 'close' },
			signal: AbortSignal.any([t, this.controller.signal]),
		}

		const start = Date.now()
		try {
			await this.getAPI('XQC:01', options)
			//await this.getAPI('XQC:02', options)
			const dt = Date.now() - start
			if (dt > 50) {
				this.log('warning', `...polling took ${dt}ms`)
			}
			this.log('debug', `...all done after ${dt}ms`)

			this.updateStatus(InstanceStatus.Ok)
		} catch (error) {
			this.log('error', `...errored after ${Date.now() - start}ms`)
			switch (error.name) {
				case 'TimeoutError':
					this.updateStatus(
						InstanceStatus.ConnectionFailure,
						'Timeout - Check configuration and connection to the controller',
					)
					break
				//case 'TypeError':
				//this.log('debug', 'TypeError')
				// ignore RP resetting TCP connection if device is busy
				//	break
				default:
					this.log('error', String(error))
					break
			}
		} finally {
			if (this.config.polling) this.pollID = setTimeout(() => this.pullData(), this.config.polldelay)
		}
	}

	async getAPI(cmd, options) {
		const url = `http://${this.config.host}:${this.config.port}/cgi-bin/aw_cam?cmd=${cmd}&res=1`
		this.log('debug', 'GET ' + url)

		const response = await fetch(url, options)
		if (!response.ok || !response.status == 200) throw new Error(`HTTP error: ${response.status}`)
		this.parseData(await response.text())
	}

	parseData(cmd) {
		const lines = cmd.trim().split('\r\n')
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
						this.data.camera = parseInt(response[2], 10)
						this.data.group = ~~((this.data.camera - 1) / this.product.numberOfPorts) + 1
						this.data.port = ((this.data.camera - 1) % this.product.numberOfPorts) + 1
						break
					case '02':
						this.data.group = parseInt(response[2], 10)
						this.data.port = parseInt(response[3], 10)
						this.data.camera = this.data.group * this.product.numberOfPorts + this.data.port
						break
				}
				break
			case 'XPM':
				// Preset memory
				switch (response[1]) {
					case '01':
						// Recall
						this.data.pmem = parseInt(response[2], 10)
						break
				}
				break
			case 'XTM':
				// Tracing memory
				switch (response[1]) {
					case '02':
						// Standby
						this.data.tmem = parseInt(response[2], 10)
						break
					case '01':
						// Play
						break
					case '00':
						// Stop
						break
				}
				break
		}

		this.checkVariables()
		this.checkFeedbacks()
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
