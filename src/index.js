import { InstanceBase, InstanceStatus } from '@companion-module/base'
import { setActions } from './actions.js'
import { setFeedbacks } from './feedbacks.js'
import { initProduct } from './models.js'
import { setPresets } from './presets.js'
import UpgradeScripts from './upgrades.js'
import { setVariables, checkVariables } from './vars.js'
import { ConfigFields } from './config.js'

// fetch (undici) reports every network-layer failure as `error.name === 'TypeError'`;
// only `error.cause.code` reveals what actually happened. These codes mean the request
// never reached the controller (wrong address, offline, no route, connect timeout).
const UNREACHABLE_CODES = new Set([
	'ECONNREFUSED',
	'ENOTFOUND',
	'EAI_AGAIN',
	'EHOSTUNREACH',
	'ENETUNREACH',
	'ETIMEDOUT',
	'UND_ERR_CONNECT_TIMEOUT',
])

// Retry interval while the controller is unreachable, instead of hammering it every polldelay.
const RECONNECT_DELAY = 5000

// A momentarily-busy controller (e.g. group switching) is retried quickly, up to a bound.
const BUSY_RETRY_DELAY = 250
const MAX_BUSY_RETRIES = 10

// Wrap a device-level protocol error so the poll loop can react to it (retry a busy
// controller, drop a rejected command) without treating it as a connection failure.
// kind: 'busy' (RP50 HTTP 500 / RP120+ 'ER2') | 'rejected' (HTTP 400 / 'ER1'/'ER3').
function deviceError(kind, message) {
	return Object.assign(new Error(message), { deviceError: kind })
}

// Map a failed poll to a connection status, or null when we aborted the request
// ourselves (destroy/configUpdated) and the status is owned elsewhere.
export function pollErrorToStatus(error) {
	if (error.name === 'AbortError') return null
	if (error.name === 'TimeoutError') {
		return { status: InstanceStatus.ConnectionFailure, message: 'Timeout — check connection to the controller' }
	}
	if (error.name === 'TypeError') {
		const code = error.cause?.code ?? error.cause?.errors?.[0]?.code
		if (UNREACHABLE_CODES.has(code)) {
			return {
				status: InstanceStatus.ConnectionFailure,
				message: `Cannot reach controller (${code}) — check IP address, port and network`,
			}
		}
		// Reached the device but it closed the connection after a partial response. This is the
		// expected behaviour of the RP60/RP120/RP150, which never reply to commands — so the
		// connection is alive. Bias towards "reached" unless we have a definite unreachable code.
		return { status: InstanceStatus.Ok }
	}
	if (error.httpStatus === 401 || error.httpStatus === 403) {
		return { status: InstanceStatus.AuthenticationFailure, message: 'Controller rejected the request' }
	}
	if (error.httpStatus) {
		return { status: InstanceStatus.ConnectionFailure, message: error.message }
	}
	return { status: InstanceStatus.UnknownError, message: String(error) }
}

class PanasonicCameraControllerInstance extends InstanceBase {
	constructor(internal) {
		super(internal)

		this.pollID = null
		this.pollActive = false
		this.busyRetries = 0
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

		this.queue = []

		this.controller = new AbortController()
		this.pollActive = false
		this.busyRetries = 0

		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'No controller IP address / hostname configured')
			return
		}

		this.updateStatus(InstanceStatus.Connecting)

		this.pullData()
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
		this.queue.push(cmd)

		// With polling disabled, drive a poll loop to fetch the updated state.
		// Only start one if none is already draining the queue, to avoid overlapping loops.
		if (!this.controller.signal.aborted && !this.config.polling && !this.pollActive) {
			this.queue.push('XQC:01')
			this.pullData()
		}
	}

	async pullData() {
		// Capture the current controller/queue so a superseded loop (after configUpdated
		// replaced them) keeps operating on its own generation, not the new one.
		const controller = this.controller
		const queue = this.queue
		this.pollActive = true

		if (queue.length === 0) {
			queue.push('XQC:01')
		}

		const t = AbortSignal.timeout(5000)

		const options = {
			signal: AbortSignal.any([t, controller.signal]),
		}

		const cmd = queue.shift()
		let retryDelay = this.config.polldelay
		const start = Date.now()
		try {
			await this.getAPI(cmd, options)

			this.updateStatus(InstanceStatus.Ok)
			this.busyRetries = 0
		} catch (error) {
			if (error.deviceError === 'busy') {
				// The controller is momentarily busy (e.g. group switching). We reached it, so
				// keep Ok and retry the same command a bounded number of times before dropping it.
				this.updateStatus(InstanceStatus.Ok)
				if (this.busyRetries < MAX_BUSY_RETRIES) {
					this.busyRetries++
					queue.unshift(cmd)
					retryDelay = BUSY_RETRY_DELAY
					this.log('debug', `${error.message} (retry ${this.busyRetries}/${MAX_BUSY_RETRIES})`)
				} else {
					this.busyRetries = 0
					this.log('warn', `${error.message} — dropped after ${MAX_BUSY_RETRIES} retries`)
				}
			} else if (error.deviceError === 'rejected') {
				// Unsupported command or value out of range. The device is reachable; drop it and warn.
				this.busyRetries = 0
				this.updateStatus(InstanceStatus.Ok)
				this.log('warn', error.message)
			} else {
				this.busyRetries = 0
				const result = pollErrorToStatus(error)
				if (result) {
					this.updateStatus(result.status, result.message)
				}

				// Discard pending commands on any failure except the "reached / Ok" case,
				// where the command was already delivered to the device.
				if (!result || result.status !== InstanceStatus.Ok) {
					queue.length = 0
				}

				// Back off instead of hammering an unreachable controller every polldelay.
				if (result?.status === InstanceStatus.ConnectionFailure) {
					retryDelay = RECONNECT_DELAY
				}
			}
		} finally {
			const dt = Date.now() - start
			this.log('debug', `...returned after ${dt}ms. ${String(queue.length)} commands left in queue.`)

			// A superseded (configUpdated) or aborted (destroy) generation must not push
			// updates or reschedule; the current generation owns pollID/pollActive.
			if (controller === this.controller && !controller.signal.aborted) {
				this.checkVariables()
				this.checkFeedbacks()

				if (this.config.polling || queue.length > 0) {
					this.pollID = setTimeout(() => this.pullData(), retryDelay)
				} else {
					this.pollActive = false
				}
			}
		}
	}

	async getAPI(cmd, options) {
		const url = `http://${this.config.host}:${this.config.port}/cgi-bin/aw_cam?cmd=${cmd}&res=1`
		this.log('debug', 'GET ' + url)

		const response = await fetch(url, options)

		// The controller signals protocol errors differently per model: the RP50 uses HTTP
		// status codes (400 = unsupported command / value out of range, 500 = busy), while the
		// RP120/150/60 reply 200 with an ER1/ER2/ER3 code in the body.
		if (response.status === 500) {
			throw deviceError('busy', `Controller busy (HTTP 500) for '${cmd}'`)
		}
		if (response.status === 400) {
			throw deviceError('rejected', `Controller rejected '${cmd}' (HTTP 400)`)
		}
		if (!response.ok || response.status !== 200) {
			const err = new Error(`HTTP error: ${response.status} ${response.statusText}`)
			err.httpStatus = response.status
			throw err
		}

		const body = await response.text()
		const er = body.trim().match(/^ER([123])/)
		if (er) {
			if (er[1] === '2') {
				throw deviceError('busy', `Controller busy (ER2) for '${cmd}'`)
			}
			throw deviceError('rejected', `Controller rejected '${cmd}' (ER${er[1]})`)
		}

		this.parseData(body)
	}

	parseData(cmd) {
		const lines = cmd.trim().split('\r\n')
		const line = lines[0].trim()
		const response = line.split(':')
		this.log('debug', 'Response: ' + line)

		switch (response[0]) {
			case 'XPT': // RP50 only
				this.data.port = parseInt(response[1], 10)
				this.data.camera = (this.data.group - 1) * this.product.numberOfPorts + this.data.port
				break
			case 'XGP': // RP50 only
				this.data.group = parseInt(response[1], 10)
				this.data.camera = (this.data.group - 1) * this.product.numberOfPorts + this.data.port
				break
			case 'XCN': // RP50 only
			case 'XQC':
				switch (response[1]) {
					case '01': // Camera number
						this.data.camera = parseInt(response[2], 10)
						this.data.group = Math.floor((this.data.camera - 1) / this.product.numberOfPorts) + 1
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
		this.setVariableDefinitions(setVariables())
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

export default PanasonicCameraControllerInstance
export { UpgradeScripts }
