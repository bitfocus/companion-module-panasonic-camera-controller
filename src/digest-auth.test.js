import assert from 'node:assert/strict'
import test from 'node:test'

import { buildDigestAuthorization, DigestSession, parseDigestChallenge } from './digest-auth.js'

test('parses the AW-RP200 Digest challenge', () => {
	assert.deepEqual(
		parseDigestChallenge('Digest realm="Control", charset="UTF-8", algorithm=MD5, nonce="abc:def", qop="auth"'),
		{
			realm: 'Control',
			charset: 'UTF-8',
			algorithm: 'MD5',
			nonce: 'abc:def',
			qop: 'auth',
		},
	)
})

test('builds the RFC 2617 MD5 qop=auth response', () => {
	const authorization = buildDigestAuthorization({
		username: 'Mufasa',
		password: 'Circle Of Life',
		method: 'GET',
		url: 'http://www.example.com/dir/index.html',
		challenge: {
			realm: 'testrealm@host.com',
			nonce: 'dcd98b7102dd2f0e8b11d0f600bfb0c093',
			qop: 'auth',
			algorithm: 'MD5',
		},
		nonceCount: 1,
		cnonce: '0a4f113b',
	})

	assert.match(authorization, /response="6629fae49393a05397450978507c4ef1"/)
	assert.match(authorization, /uri="\/dir\/index.html"/)
	assert.match(authorization, /nc=00000001/)
})

test('retries a 401 challenge and reuses the nonce on the next request', async () => {
	const session = new DigestSession(() => 'fixed-cnonce')
	const requests = []
	const responses = [
		{
			status: 401,
			headers: {
				get: () => 'Digest realm="Control", algorithm=MD5, nonce="nonce-1", qop="auth"',
			},
			arrayBuffer: async () => new ArrayBuffer(0),
		},
		{ status: 200 },
		{ status: 200 },
	]
	const fetchFunction = async (_url, options) => {
		requests.push(options)
		return responses.shift()
	}

	await session.fetch(fetchFunction, 'http://controller/cgi-bin/aw_cam?cmd=XQC:01&res=1', {}, 'admin', 'secret')
	await session.fetch(fetchFunction, 'http://controller/cgi-bin/aw_cam?cmd=XQC:01&res=1', {}, 'admin', 'secret')

	assert.equal(requests.length, 3)
	assert.equal(requests[0].headers.Authorization, undefined)
	assert.match(requests[1].headers.Authorization, /^Digest /)
	assert.match(requests[1].headers.Authorization, /nc=00000001/)
	assert.match(requests[2].headers.Authorization, /nc=00000002/)
})
