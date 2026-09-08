import { createHash, randomBytes } from 'node:crypto'

const md5 = (value) => createHash('md5').update(value).digest('hex')

function quote(value) {
	return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

export function parseDigestChallenge(header) {
	if (!header?.match(/^Digest\s/i)) return null

	const challenge = {}
	const params = header.replace(/^Digest\s+/i, '')
	const matcher = /([a-z0-9_-]+)\s*=\s*(?:"((?:\\.|[^"])*)"|([^,\s]+))/gi
	let match
	while ((match = matcher.exec(params))) {
		challenge[match[1].toLowerCase()] = (match[2] ?? match[3]).replace(/\\"/g, '"')
	}

	if (!challenge.realm || !challenge.nonce) return null
	return challenge
}

export function buildDigestAuthorization({ username, password, method, url, challenge, nonceCount, cnonce }) {
	const algorithm = (challenge.algorithm ?? 'MD5').toUpperCase()
	if (algorithm !== 'MD5') throw new Error(`Unsupported HTTP Digest algorithm: ${algorithm}`)

	const uri = new URL(url).pathname + new URL(url).search
	const ha1 = md5(`${username}:${challenge.realm}:${password}`)
	const ha2 = md5(`${method}:${uri}`)
	const qops = challenge.qop?.split(',').map((entry) => entry.trim().toLowerCase()) ?? []
	const useQop = qops.includes('auth')
	const nc = nonceCount.toString(16).padStart(8, '0')
	const response = useQop
		? md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:auth:${ha2}`)
		: md5(`${ha1}:${challenge.nonce}:${ha2}`)

	const fields = [
		`username="${quote(username)}"`,
		`realm="${quote(challenge.realm)}"`,
		`nonce="${quote(challenge.nonce)}"`,
		`uri="${quote(uri)}"`,
		`response="${response}"`,
		'algorithm=MD5',
	]

	if (challenge.opaque) fields.push(`opaque="${quote(challenge.opaque)}"`)
	if (useQop) fields.push('qop=auth', `nc=${nc}`, `cnonce="${quote(cnonce)}"`)

	return `Digest ${fields.join(', ')}`
}

export class DigestSession {
	constructor(cnonceFactory = () => randomBytes(8).toString('hex')) {
		this.cnonceFactory = cnonceFactory
		this.challenge = null
		this.nonceCount = 0
	}

	setChallenge(header) {
		const challenge = parseDigestChallenge(header)
		if (!challenge) return false

		if (challenge.nonce !== this.challenge?.nonce) this.nonceCount = 0
		this.challenge = challenge
		return true
	}

	authorization(url, username, password) {
		if (!this.challenge) return null

		this.nonceCount++
		return buildDigestAuthorization({
			username,
			password,
			method: 'GET',
			url,
			challenge: this.challenge,
			nonceCount: this.nonceCount,
			cnonce: this.cnonceFactory(),
		})
	}

	async fetch(fetchFunction, url, options, username, password) {
		const headers = { ...options.headers }
		const authorization = this.authorization(url, username, password)
		if (authorization) headers.Authorization = authorization

		let response = await fetchFunction(url, { ...options, headers })
		if (response.status !== 401 || !this.setChallenge(response.headers.get('www-authenticate'))) return response

		// Drain the small 401 response before the controller's Connection: close.
		await response.arrayBuffer()
		const retryHeaders = { ...headers, Authorization: this.authorization(url, username, password) }
		response = await fetchFunction(url, { ...options, headers: retryHeaders })
		return response
	}
}
