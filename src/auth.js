import { createHash, randomBytes } from 'node:crypto'

// HTTP authentication for the controller's CGI endpoint.
//
// node's fetch (undici) has no support for HTTP authentication at all: credentials embedded in
// the URL are rejected outright and a 401 challenge is never answered. Panasonic controllers use
// Digest (the default on AW devices) or Basic, depending on model and firmware, so we implement
// both and pick the scheme from the WWW-Authenticate header of the first 401 we see.
//
// The challenge is answered once and the result cached: every following request carries the
// Authorization header preemptively, so authentication costs one extra round trip per connection
// and not one per poll. The cache is dropped when the device rejects our credentials or expires
// the nonce (stale), which makes the next request challenge again.

// Digest supports several hash algorithms; map the ones we can compute to their node names.
// Anything else (or a scheme we don't speak) means we cannot answer the challenge.
function hashName(algorithm) {
	const base = String(algorithm ?? 'MD5')
		.toUpperCase()
		.replace(/-SESS$/, '')
	switch (base) {
		case 'MD5':
			return 'md5'
		case 'SHA-256':
			return 'sha256'
		case 'SHA-512-256':
			return 'sha512-256'
		default:
			return null
	}
}

// `key=value` / `key="quoted value"` pairs of a single challenge, lowercased keys.
function parseParams(text) {
	const params = {}
	const re = /([A-Za-z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,]*))/g
	let m
	while ((m = re.exec(text)) !== null) {
		params[m[1].toLowerCase()] = (m[2] ?? m[3] ?? '').replace(/\\(.)/g, '$1')
	}
	return params
}

// A WWW-Authenticate header may offer several schemes in one line ('Digest ..., Basic realm="x"').
// Split on the comma that precedes a known scheme token, then prefer Digest over Basic.
export function parseChallenge(header) {
	if (!header) return null

	const parts = String(header).split(/,\s*(?=(?:Digest|Basic|Bearer|Negotiate|NTLM)\s)/i)
	let basic = null

	for (const part of parts) {
		const m = /^\s*([A-Za-z0-9_-]+)\s*(.*)$/s.exec(part)
		if (!m) continue
		const scheme = m[1].toLowerCase()
		if (scheme === 'digest') return { scheme, params: parseParams(m[2]) }
		if (scheme === 'basic' && !basic) basic = { scheme, params: parseParams(m[2]) }
	}

	return basic
}

export class HttpAuth {
	constructor(username, password) {
		this.username = username ?? ''
		this.password = password ?? ''
		this.state = null
	}

	// Without a username there is nothing to send; an empty password is legitimate.
	get enabled() {
		return this.username !== ''
	}

	// Forget the negotiated scheme/nonce, so the next request challenges again.
	reset() {
		this.state = null
	}

	// Accept a challenge for later use. Returns false when we cannot answer it, so the caller
	// can report the failure instead of retrying a request that is bound to fail again.
	handleChallenge(header) {
		if (!this.enabled) return false

		const challenge = parseChallenge(header)
		if (!challenge) return false

		if (challenge.scheme === 'basic') {
			this.state = { scheme: 'basic' }
			return true
		}

		const hash = hashName(challenge.params.algorithm)
		if (!hash) return false

		this.state = {
			scheme: 'digest',
			hash,
			algorithm: challenge.params.algorithm ?? 'MD5',
			sess: /-sess$/i.test(challenge.params.algorithm ?? ''),
			realm: challenge.params.realm ?? '',
			nonce: challenge.params.nonce ?? '',
			opaque: challenge.params.opaque,
			qop: this.#selectQop(challenge.params.qop),
			nc: 0,
			cnonce: randomBytes(8).toString('hex'),
		}
		return true
	}

	// The server offers a comma separated list; 'auth' is what we want. 'auth-int' also works
	// for us because the requests have no body, but only take it when it is the sole offer.
	#selectQop(qop) {
		if (!qop) return null
		const offered = String(qop)
			.split(',')
			.map((q) => q.trim().toLowerCase())
		if (offered.includes('auth')) return 'auth'
		if (offered.includes('auth-int')) return 'auth-int'
		return null
	}

	// The Authorization header for a request, or null while no challenge has been seen yet.
	// `uri` must be the request target exactly as sent (path including query), not the full URL.
	authorization(method, uri) {
		if (!this.enabled || !this.state) return null

		if (this.state.scheme === 'basic') {
			return 'Basic ' + Buffer.from(`${this.username}:${this.password}`).toString('base64')
		}

		return this.#digest(method, uri)
	}

	#hash(value) {
		return createHash(this.state.hash).update(value).digest('hex')
	}

	#digest(method, uri) {
		const s = this.state

		let ha1 = this.#hash(`${this.username}:${s.realm}:${this.password}`)
		if (s.sess) ha1 = this.#hash(`${ha1}:${s.nonce}:${s.cnonce}`)

		// Requests to the controller never carry a body, so the entity hash of auth-int is the
		// hash of the empty string.
		const ha2 = s.qop === 'auth-int' ? this.#hash(`${method}:${uri}:${this.#hash('')}`) : this.#hash(`${method}:${uri}`)

		const fields = [
			`username="${this.username}"`,
			`realm="${s.realm}"`,
			`nonce="${s.nonce}"`,
			`uri="${uri}"`,
			`algorithm=${s.algorithm}`,
		]

		let response
		if (s.qop) {
			s.nc++
			const nc = s.nc.toString(16).padStart(8, '0')
			response = this.#hash(`${ha1}:${s.nonce}:${nc}:${s.cnonce}:${s.qop}:${ha2}`)
			fields.push(`qop=${s.qop}`, `nc=${nc}`, `cnonce="${s.cnonce}"`)
		} else {
			// Legacy RFC 2069 style, still used by some devices.
			response = this.#hash(`${ha1}:${s.nonce}:${ha2}`)
		}

		fields.push(`response="${response}"`)
		if (s.opaque !== undefined) fields.push(`opaque="${s.opaque}"`)

		return 'Digest ' + fields.join(', ')
	}
}
