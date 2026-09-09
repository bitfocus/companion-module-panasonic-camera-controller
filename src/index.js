import { InstanceBase, InstanceStatus } from '@companion-module/base'
import { setActions } from './actions.js'
import { setFeedbacks } from './feedbacks.js'
import { initProduct } from './models.js'
import { setPresets } from './presets.js'
import UpgradeScripts from './upgrades.js'
import { setVariables, checkVariables } from './vars.js'
import { ConfigFields } from './config.js'
import { createAuthSession, requestWithAuth } from './auth.js'

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
	// Backstop for a refusal that did not come through reportAuthEvent, which normally says it
	// better because it has the challenge in hand.
	if (error.httpStatus === 403) {
		return { status: InstanceStatus.InsufficientPermissions, message: 'Insufficient permissions' }
	}
	if (error.httpStatus === 401) {
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

		this.auth = createAuthSession()
		this.reportedAuth = new Set()
	}

	async init(config, isFirstInit, secrets) {
		this.data = {
			camera: null,
			group: null,
			port: null,
			pmem: null,
			tmem: null,
			macro: null,
		}

		this.config = config

		// One session per connection: it caches the controller's challenge, so the handshake happens
		// once rather than per request. The password lives in the secrets store, not in config; both
		// are undefined for connections made before authentication support existed, which reads as no
		// credentials — and a controller that never asks for one is never sent one either way.
		this.auth = createAuthSession({ username: config.username, password: secrets?.password })
		this.reportedAuth = new Set()

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
				// A refusal reportAuthEvent has already named keeps the message it gave it, which is
				// the better one: it had the challenge in hand.
				const result = pollErrorToStatus(error, this.auth.hasCredentials)
				if (result && !error.statusReported) {
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
					result?.status === InstanceStatus.AuthenticationFailure ||
					result?.status === InstanceStatus.InsufficientPermissions
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

		const response = await this.getWithAuth(url, path, options)

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

	// The auth layer is written against a transport that raises a refused request as an error
	// carrying the response (see requestWithAuth). fetch does neither — it hands a 401 back like any
	// other answer and never repeats the request itself — so refusals are turned into errors of that
	// shape here, and every other answer is passed through untouched for getAPI to read.
	async getWithAuth(url, path, options) {
		let spokenFor = false

		const send = async (headers) => {
			const response = await fetch(url, { ...options, headers })
			if (response.status !== 401 && response.status !== 403) return response

			// The body of a refusal is of no interest, and the connection is wanted back.
			await response.body?.cancel().catch(() => {})

			const error = new Error(`HTTP error: ${response.status} ${response.statusText}`)
			error.httpStatus = response.status
			error.response = { statusCode: response.status, headers: Object.fromEntries(response.headers) }
			throw error
		}

		try {
			return await requestWithAuth(send, {
				session: this.auth,
				uri: path,
				report: (event) => {
					spokenFor = this.reportAuthEvent(event) || spokenFor
				},
			})
		} catch (error) {
			// Mark a refusal that has already been named, so the poll loop leaves its message alone.
			if (spokenFor) error.statusReported = true
			throw error
		}
	}

	// What the auth layer found, said once per connection. requestWithAuth reports through here on
	// its way to handing a refusal back, so this is where one gets its status and its explanation.
	// Returns whether it owns the connection status for that refusal.
	reportAuthEvent({ type, scheme, realm, algorithm, offered }) {
		const forRealm = realm ? ` (realm "${realm}")` : ''

		// The poll loop meets the same refusal every few seconds; the status follows it, the
		// explanation is written once.
		const once = (level, message) => {
			if (this.reportedAuth.has(type)) return
			this.reportedAuth.add(type)
			this.log(level, message)
		}

		switch (type) {
			// The controller answered without ever asking for a login, and never will on this
			// connection. Nothing is wrong; it is worth one line to separate "no login is needed
			// here" from "nothing has been tried yet".
			case 'none':
				once('debug', 'Controller requires no authentication.')
				return false

			case 'authenticated':
				once(
					'debug',
					`Authenticated with the controller${forRealm} using ${scheme}${algorithm ? ` (${algorithm})` : ''}.`,
				)
				return false

			case 'stale':
				this.log('debug', `Controller issued a fresh authentication nonce${forRealm}; re-authenticated.`)
				return false

			case 'credentialsRequired':
				this.updateStatus(InstanceStatus.AuthenticationFailure, 'Login required')
				once(
					'error',
					`The controller requires a login${forRealm} and this connection has none. Enter its username and ` +
						"password in the connection's settings; the AW-RP200 asks for them on every request and cannot " +
						'be set not to.',
				)
				return true

			case 'rejected':
				this.updateStatus(InstanceStatus.AuthenticationFailure, 'Login rejected')
				once(
					'error',
					`The controller rejected the username and password${forRealm}. Check them against its web interface, ` +
						"where the same pair logs in (factory default: admin / 12345), and correct them in the connection's " +
						'settings.',
				)
				return true

			case 'forbidden':
				this.updateStatus(InstanceStatus.InsufficientPermissions, 'Insufficient permissions')
				once(
					'error',
					`The controller took the login${forRealm} and refused the request anyway: the account does not have ` +
						'the rights for it.',
				)
				return true

			case 'unsupported':
				this.updateStatus(InstanceStatus.AuthenticationFailure, 'Unsupported login method')
				once(
					'error',
					`The controller asked for ${offered ?? 'a login method'}, which this module cannot answer. It speaks ` +
						'Digest and Basic.',
				)
				return true

			default:
				return false
		}
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
			case 'XMC':
				// Macro (AW-RP200 only). The controller echoes this back over serial only, so over
				// IP the state comes from the action itself; handled here for consistency.
				switch (response[1]) {
					case '01':
						// Play
						this.data.macro = parseInt(response[2], 10)
						break
					case '00':
						// Stop
						this.data.macro = null
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
