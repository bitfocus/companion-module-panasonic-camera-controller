import { InstanceBase, InstanceStatus, runEntrypoint } from '@companion-module/base'
import { setActions } from './actions.js'
import { setFeedbacks } from './feedbacks.js'
import { initProduct } from './models.js'
import { setPresets } from './presets.js'
import UpgradeScripts from './upgrades.js'
import { setVariables, checkVariables } from './vars.js'
import { ConfigFields } from './config.js'
import Queue from 'queue-fifo'

class PTZControllerInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		this.pollID = null
	}

	async init(config) {
		this.data = {
			camera: null,
			group: null,
			port: null,
			pmem: null,
			tmem: null,
		}

		this.config = config
		this.product = initProduct(this.config.model)

		this.init_variables()
		this.init_actions()
		this.init_feedbacks()
		this.init_presets()

		this.checkVariables()

		this.queue = new Queue()

		this.controller = new AbortController()

		this.updateStatus(InstanceStatus.Connecting)

		if (this.pollID === null) {
			this.pullData()
		}
	}

	async destroy() {
		this.controller.abort()
		clearTimeout(this.pollID)
		this.updateStatus(InstanceStatus.Disconnected)
	}

	async configUpdated(config) {
		this.controller.abort()
		clearTimeout(this.pollID)
		this.pollID = null
		this.updateStatus(InstanceStatus.Disconnected, 'Config changed')

		this.init(config)
	}

	async sendCommand(cmd) {
		this.log('debug', 'sendCommand()')

		this.queue.enqueue(cmd)

		if (!this.controller.signal.aborted && !this.config.polling) {
			this.queue.enqueue('XQC:01')
			await this.pullData()
		}
	}

	async pullData() {
		this.log('debug', 'pullData()')

		if (this.queue.isEmpty()) {
			this.queue.enqueue('XQC:01')
		}

		const t = AbortSignal.timeout(2500)

		const options = {
			headers: { Connection: 'close' },
			signal: AbortSignal.any([t, this.controller.signal]),
		}

		const start = Date.now()
		try {
			await this.getAPI(this.queue.dequeue(), options)

			this.updateStatus(InstanceStatus.Ok)
		} catch (error) {
			switch (error.name) {
				case 'TimeoutError':
					this.updateStatus(
						InstanceStatus.ConnectionFailure,
						'Timeout - Check configuration and connection to the controller',
					)
					break
				case 'AbortError':
				case 'TypeError':
					// The RP controllers (execpting the RP50) do not respond to a command in any way.
					// The TCP connection will be closed immediately once the first line of the HTTP request is received by the device.
					break
				default:
					this.log('error', String(error))
					break
			}
		} finally {
			const dt = Date.now() - start
			this.log('debug', `...returned after ${dt}ms. ${String(this.queue.size())} commands left in queue.`)

			this.checkVariables()
			this.checkFeedbacks()

			if (!this.controller.signal.aborted) {
				if (this.config.polling || !this.queue.isEmpty()) {
					this.pollID = setTimeout(() => this.pullData(), this.config.polldelay)
				}
			}
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
			case 'XPT': // RP50 only
				this.data.port = response[1]
				break
			case 'XGP': // RP50 only
				this.data.group = response[1]
				break
			case 'XCN': // RP50 only
			case 'XQC':
				switch (response[1]) {
					case '01': // Camera number
						this.data.camera = parseInt(response[2], 10)
						this.data.group = ~~((this.data.camera - 1) / this.product.numberOfPorts) + 1
						this.data.port = ((this.data.camera - 1) % this.product.numberOfPorts) + 1
						break
					case '02': // Camera Group/Port
						this.data.group = parseInt(response[2], 10)
						this.data.port = parseInt(response[3], 10)
						this.data.camera = (this.data.group - 1) * this.product.numberOfPorts + this.data.port
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
