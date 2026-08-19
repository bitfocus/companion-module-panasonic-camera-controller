import { InstanceBase, InstanceStatus } from '@companion-module/base'
import { setActions } from './actions.js'
import { setFeedbacks } from './feedbacks.js'
import { initProduct } from './models.js'
import { setPresets } from './presets.js'
import UpgradeScripts from './upgrades.js'
import { setVariables, checkVariables } from './vars.js'
import { ConfigFields } from './config.js'
import { HttpAuth } from './auth.js'

// fetch (undici) reports every network-layer failure as `error.name === 'TypeError'`; only
// error.cause reveals what happened. A working RP60/120/150 never returns a real HTTP response:
// it accepts the TCP connection and closes it right after the status line, which surfaces as one
// of these "connected, then closed" signatures. Everything else (connection refused, host down/
// unreachable, no route, connect timeout, DNS failure — the exact code is platform-dependent)
// means we never reached the controller, so we treat the reachable set as the allowlist and
// default the rest to a connection failure.
const REACHED_AFTER_CONNECT =
	/UND_ERR_SOCKET|ECONNRESET|ECONNABORTED|EPIPE|other side closed|socket hang ?up|terminated/i

// A compact reason string from a fetch TypeError, for classification and logging.
function fetchErrorReason(error) {
	return [error.cause?.code, error.cause?.errors?.[0]?.code, error.cause?.message, error.message]
		.filter(Boolean)
		.join(' ')
}

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
// ourselves (destroy/configUpdated) and the status is owned elsewhere. `hasCredentials`
// only selects the wording of the authentication message.
export function pollErrorToStatus(error, hasCredentials = false) {
	if (error.name === 'AbortError') return null
	if (error.name === 'TimeoutError') {
		return { status: InstanceStatus.ConnectionFailure, message: 'Timeout — check connection to the controller' }
	}
	if (error.name === 'TypeError') {
		const reason = fetchErrorReason(error)
		// Reached the device, but it closed the connection — expected for the RP60/120/150.
		if (REACHED_AFTER_CONNECT.test(reason)) return { status: InstanceStatus.Ok }
		// Any other network error means the controller was not reachable.
		const code = error.cause?.code ?? error.cause?.errors?.[0]?.code
		return {
			status: InstanceStatus.ConnectionFailure,
			message: `Cannot reach controller${code ? ` (${code})` : ''} — check IP address, port and network`,
		}
	}
	if (error.httpStatus === 401 || error.httpStatus === 403) {
		return {
			status: InstanceStatus.AuthenticationFailure,
			message: hasCredentials
				? 'Authentication failed — check username and password'
				: 'Controller requires authentication — enter username and password in the connection config',
		}
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

	async init(config, isFirstInit, secrets) {
		this.data = {
			camera: null,
			group: null,
			port: null,
			pmem: null,
			tmem: null,
		}

		this.config = config

		// The password lives in the secrets store, not in config. Both are undefined for
		// connections created before authentication support existed, which means no auth.
		this.auth = new HttpAuth(config.username, secrets?.password)

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

	async configUpdated(config, secrets) {
		this.controller.abort()
		clearTimeout(this.pollID)
		this.pollID = null
		this.updateStatus(InstanceStatus.Disconnected, 'Config changed')

		this.init(config, false, secrets)
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
				// fetch collapses all network errors to TypeError; log the underlying reason so the
				// reachable-vs-unreachable classification can be checked and tuned.
				if (error.name === 'TypeError') {
					this.log('debug', `fetch failed: ${fetchErrorReason(error)}`)
				}
				const result = pollErrorToStatus(error, this.auth.enabled)
				if (result) {
					this.updateStatus(result.status, result.message)
				}

				// Discard pending commands on any failure except the "reached / Ok" case,
				// where the command was already delivered to the device.
				if (!result || result.status !== InstanceStatus.Ok) {
					queue.length = 0
				}

				// Back off instead of hammering an unreachable controller — or one that keeps
				// rejecting our credentials — every polldelay.
				if (
					result?.status === InstanceStatus.ConnectionFailure ||
					result?.status === InstanceStatus.AuthenticationFailure
				) {
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
				this.checkAllFeedbacks()

				if (this.config.polling || queue.length > 0) {
					this.pollID = setTimeout(() => this.pullData(), retryDelay)
				} else {
					this.pollActive = false
				}
			}
		}
	}

	async getAPI(cmd, options) {
		const path = `/cgi-bin/aw_cam?cmd=${cmd}&res=1`
		const url = `http://${this.config.host}:${this.config.port}${path}`
		this.log('debug', 'GET ' + url)

		const response = await this.fetchWithAuth(url, path, options)

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

	// fetch does not do HTTP authentication, so answer a 401 challenge ourselves and repeat the
	// request once. The negotiated scheme is cached in HttpAuth and sent preemptively afterwards,
	// so this costs one extra round trip per connection and not one per poll.
	async fetchWithAuth(url, path, options) {
		const headers = {}
		const preemptive = this.auth.authorization('GET', path)
		if (preemptive) headers.authorization = preemptive

		const response = await fetch(url, { ...options, headers })
		if (response.status !== 401) return response

		const challenge = response.headers.get('www-authenticate')
		this.log('debug', `HTTP 401, challenge: ${challenge ?? '(none)'}`)

		// Nothing to answer with, or a scheme we do not speak: report the 401 as it is.
		if (!this.auth.handleChallenge(challenge)) return response

		const authorization = this.auth.authorization('GET', path)
		if (!authorization) return response

		// Free the connection before reusing it; the body of a 401 is of no interest.
		await response.body?.cancel().catch(() => {})

		const retry = await fetch(url, { ...options, headers: { authorization } })

		// Still rejected: the credentials are wrong (or the device changed its mind about the
		// scheme). Drop the cache so the next attempt negotiates from scratch.
		if (retry.status === 401) this.auth.reset()

		return retry
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
		const { presets, structure } = setPresets(this)
		this.setPresetDefinitions(structure, presets)
	}
}

export default PanasonicCameraControllerInstance
export { UpgradeScripts }
