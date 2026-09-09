// The auth layer driven through this module's own transport: getAPI() against a real HTTP server
// that behaves like a controller. auth.test.js covers the header building; what is tested here is
// the fetch adapter around it — that a 401 becomes the error shape requestWithAuth expects, that the
// hashed request target is the one that went on the wire, and that the device-level protocol errors
// the controllers speak are still read as such once the auth layer sits in front of them.
import http from 'node:http'
import { createHash, randomBytes } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { InstanceStatus } from '@companion-module/base'
import Instance, { pollErrorToStatus } from '../index.js'
import { createAuthSession } from '../auth.js'
import { initProduct } from '../models.js'

const USER = 'admin'
const PASS = '12345'
const REALM = 'AW-RP200'

const md5 = (value) => createHash('md5').update(value).digest('hex')

const parseParams = (header) => {
	const params = {}
	const re = /([A-Za-z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,]*))/g
	let m
	while ((m = re.exec(header)) !== null) params[m[1].toLowerCase()] = m[2] ?? m[3]
	return params
}

const servers = []

afterEach(() => {
	while (servers.length) servers.pop().close()
})

// Starts a server and hands back its port. Every request is recorded, so a test can assert what the
// controller was actually asked — how many times, and with which Authorization header.
async function serve(handler) {
	const requests = []
	const server = http.createServer((req, res) => {
		requests.push({ url: req.url, authorization: req.headers.authorization })
		handler(req, res, requests)
	})
	servers.push(server)

	const port = await new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
	return { port, requests }
}

// A controller demanding a login, in whichever scheme. `password` is what it will accept.
function guarded({ scheme = 'digest', password = PASS, body = 'XQC:01:005\r\n' } = {}) {
	let nonce = randomBytes(8).toString('hex')
	const state = { challenges: 0, rotate: () => (nonce = randomBytes(8).toString('hex')) }

	state.handler = (req, res) => {
		const deny = (extra = '') => {
			state.challenges++
			const header =
				scheme === 'basic' ? `Basic realm="${REALM}"` : `Digest realm="${REALM}", nonce="${nonce}", qop="auth"${extra}`
			res.writeHead(401, { 'WWW-Authenticate': header, 'Content-Type': 'text/plain' })
			res.end('401 Unauthorized')
		}

		const authorization = req.headers.authorization
		if (!authorization) return deny()

		if (scheme === 'basic') {
			const expected = 'Basic ' + Buffer.from(`${USER}:${password}`).toString('base64')
			if (authorization !== expected) return deny()
		} else {
			const p = parseParams(authorization)
			if (p.nonce !== nonce) {
				state.rotate()
				return deny(', stale=true')
			}
			const ha1 = md5(`${USER}:${REALM}:${password}`)
			const expected = md5(`${ha1}:${p.nonce}:${p.nc}:${p.cnonce}:${p.qop}:${md5(`GET:${p.uri}`)}`)
			if (p.response !== expected) return deny()
		}

		res.writeHead(200, { 'Content-Type': 'text/plain' })
		res.end(body)
	}

	return state
}

// An instance with everything getAPI() touches, and nothing else: no Companion host, no poll loop.
function instanceOn(port, { username = USER, password = PASS } = {}) {
	const self = Object.create(Instance.prototype)

	self.config = { host: '127.0.0.1', port, model: 'AW-RP200' }
	self.product = initProduct('AW-RP200')
	self.data = { camera: null, group: null, port: null, pmem: null, tmem: null }
	self.auth = createAuthSession({ username, password })
	self.reportedAuth = new Set()
	self.logs = []
	self.statuses = []
	self.log = (level, message) => self.logs.push({ level, message })
	self.updateStatus = (status, message) => self.statuses.push({ status, message })

	self.poll = async (cmd = 'XQC:01') => self.getAPI(cmd, {})
	self.pollFailure = async (cmd = 'XQC:01') => {
		try {
			await self.getAPI(cmd, {})
		} catch (error) {
			return error
		}
		throw new Error('expected the request to fail')
	}

	return self
}

const errorsLogged = (self) => self.logs.filter((l) => l.level === 'error')

describe('a controller that asks for a Digest login', () => {
	it('answers the challenge and reads the reply', async () => {
		const controller = guarded()
		const { port } = await serve(controller.handler)
		const self = instanceOn(port)

		await self.poll()

		expect(self.data.camera).toBe(5)
		expect(self.auth.scheme).toBe('digest')
	})

	it('costs one handshake for the connection, not one per poll', async () => {
		const controller = guarded()
		const { port, requests } = await serve(controller.handler)
		const self = instanceOn(port)

		for (let i = 0; i < 5; i++) await self.poll()

		// Five polls, plus the single bare request that drew the challenge.
		expect(requests).toHaveLength(6)
		expect(controller.challenges).toBe(1)
		expect(requests.filter((r) => r.authorization === undefined)).toHaveLength(1)
	})

	it('signs the request target that actually went on the wire, colon and all', async () => {
		const controller = guarded()
		const { port, requests } = await serve(controller.handler)
		const self = instanceOn(port)

		await self.poll('XQC:01')

		const signed = requests.filter((r) => r.authorization)
		expect(signed).not.toHaveLength(0)
		for (const request of signed) {
			expect(request.url).toBe('/cgi-bin/aw_cam?cmd=XQC:01&res=1')
			expect(parseParams(request.authorization).uri).toBe(request.url)
		}
	})
})

describe('a controller that asks for a Basic login', () => {
	it('answers it and repeats the header without another challenge', async () => {
		const controller = guarded({ scheme: 'basic' })
		const { port, requests } = await serve(controller.handler)
		const self = instanceOn(port)

		await self.poll()
		await self.poll()

		expect(self.data.camera).toBe(5)
		expect(self.auth.scheme).toBe('basic')
		expect(controller.challenges).toBe(1)
		expect(requests).toHaveLength(3)
	})
})

describe('a controller that asks for nothing', () => {
	it('is never sent an Authorization header, even with credentials configured', async () => {
		const { port, requests } = await serve((req, res) => {
			res.writeHead(200, { 'Content-Type': 'text/plain' })
			res.end('XQC:01:005\r\n')
		})
		const self = instanceOn(port)

		for (let i = 0; i < 3; i++) await self.poll()

		expect(requests).toHaveLength(3)
		expect(requests.every((r) => r.authorization === undefined)).toBe(true)
		expect(self.auth.scheme).toBe('none')
	})
})

describe('a login the controller rejects', () => {
	it('is reported as the credentials being wrong, not as the controller being unreachable', async () => {
		const controller = guarded({ password: 'something else' })
		const { port } = await serve(controller.handler)
		const self = instanceOn(port)

		const error = await self.pollFailure()

		expect(error.httpStatus).toBe(401)
		expect(self.statuses.at(-1)).toEqual({
			status: InstanceStatus.AuthenticationFailure,
			message: 'Login rejected',
		})
	})

	it('costs one extra request once, and nothing extra after that', async () => {
		const controller = guarded({ password: 'something else' })
		const { port, requests } = await serve(controller.handler)
		const self = instanceOn(port)

		await self.pollFailure()
		expect(requests).toHaveLength(2) // the bare one, and the answered challenge

		await self.pollFailure()
		await self.pollFailure()
		// A challenge is in hand and was refused with it, so there is nothing left to try: one
		// request per poll, never a pair.
		expect(requests).toHaveLength(4)
	})

	it('is written to the log once, however long the poll loop keeps meeting it', async () => {
		const controller = guarded({ password: 'something else' })
		const { port } = await serve(controller.handler)
		const self = instanceOn(port)

		for (let i = 0; i < 4; i++) await self.pollFailure()

		expect(errorsLogged(self)).toHaveLength(1)
		expect(errorsLogged(self)[0].message).toContain('rejected the username and password')
		// The status still follows every refusal, so a connection that recovers is not left stale.
		expect(self.statuses.filter((s) => s.message === 'Login rejected')).toHaveLength(4)
	})

	it('keeps the message it was given rather than the generic one', async () => {
		const controller = guarded({ password: 'something else' })
		const { port } = await serve(controller.handler)
		const self = instanceOn(port)

		const error = await self.pollFailure()

		expect(error.statusReported).toBe(true)
		// pollErrorToStatus still classifies it; the poll loop just does not overwrite with it.
		expect(pollErrorToStatus(error, self.auth.hasCredentials).status).toBe(InstanceStatus.AuthenticationFailure)
	})
})

describe('a controller that asks for a login the connection has not got', () => {
	it('says so, and does not spend a second request finding out again', async () => {
		const controller = guarded()
		const { port, requests } = await serve(controller.handler)
		const self = instanceOn(port, { username: '', password: '' })

		const error = await self.pollFailure()

		expect(error.httpStatus).toBe(401)
		expect(requests).toHaveLength(1)
		expect(self.statuses.at(-1)).toEqual({
			status: InstanceStatus.AuthenticationFailure,
			message: 'Login required',
		})
		expect(errorsLogged(self)[0].message).toContain('requires a login')
	})
})

describe('a Digest nonce that ages out', () => {
	it('is re-handshaked instead of being called a bad password', async () => {
		const controller = guarded()
		const { port } = await serve(controller.handler)
		const self = instanceOn(port)

		await self.poll()
		controller.rotate() // the controller moves on while the session holds the old nonce

		await self.poll()

		expect(self.data.camera).toBe(5)
		expect(errorsLogged(self)).toHaveLength(0)
		expect(self.logs.some((l) => l.message.includes('fresh authentication nonce'))).toBe(true)
	})
})

describe('a controller offering both schemes in one header', () => {
	it('is answered with Digest', async () => {
		const nonce = randomBytes(8).toString('hex')
		const { port } = await serve((req, res) => {
			if (!req.headers.authorization) {
				res.writeHead(401, {
					'WWW-Authenticate': `Basic realm="${REALM}", Digest realm="${REALM}", nonce="${nonce}", qop="auth"`,
				})
				return res.end('401')
			}
			res.writeHead(200, { 'Content-Type': 'text/plain' })
			res.end('XQC:01:009\r\n')
		})
		const self = instanceOn(port)

		await self.poll()

		expect(self.auth.scheme).toBe('digest')
		expect(self.data.camera).toBe(9)
	})
})

describe('a controller that takes the login and refuses the request anyway', () => {
	it('is reported as a rights problem, not a wrong password', async () => {
		const { port } = await serve((req, res) => {
			res.writeHead(403, { 'Content-Type': 'text/plain' })
			res.end('403 Forbidden')
		})
		const self = instanceOn(port)

		const error = await self.pollFailure()

		expect(error.httpStatus).toBe(403)
		expect(self.statuses.at(-1)).toEqual({
			status: InstanceStatus.InsufficientPermissions,
			message: 'Insufficient permissions',
		})
		expect(pollErrorToStatus(error, true).status).toBe(InstanceStatus.InsufficientPermissions)
	})
})

describe('the protocol errors the controllers speak in a 200', () => {
	it('still reads ER2 as the controller being busy', async () => {
		const controller = guarded({ body: 'ER2:XQC:01\r\n' })
		const { port } = await serve(controller.handler)
		const self = instanceOn(port)

		const error = await self.pollFailure()

		expect(error.deviceError).toBe('busy')
	})

	it('still reads ER1 as a refused command', async () => {
		const controller = guarded({ body: 'ER1:XQC:01\r\n' })
		const { port } = await serve(controller.handler)
		const self = instanceOn(port)

		const error = await self.pollFailure()

		expect(error.deviceError).toBe('rejected')
	})

	it('still reads HTTP 500 as the controller being busy, through the auth layer', async () => {
		const { port } = await serve((req, res) => {
			res.writeHead(500)
			res.end('busy')
		})
		const self = instanceOn(port)

		const error = await self.pollFailure()

		expect(error.deviceError).toBe('busy')
	})
})
