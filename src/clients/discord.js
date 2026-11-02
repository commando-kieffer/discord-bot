import nodeFetch from 'node-fetch'
import { VERSION } from '../version.js'

export const DISCORD_API_URL = 'https://discord.com/api/v10/'
export const USER_AGENT = `DiscordBot (https://github.com/commando-kieffer/discord-bot, ${VERSION})`

export class DiscordApiError extends Error {
	constructor({ method, endpoint, status, body, cause }) {
		const detail =
			body && typeof body === 'object'
				? [body.message, body.code !== undefined ? `code ${body.code}` : null].filter(Boolean).join(', ')
				: body
		const reason = status ? `HTTP ${status}` : `requête impossible (${cause?.name ?? 'erreur réseau'})`

		super(`Discord ${method} ${endpoint} : ${reason}${detail ? ` - ${detail}` : ''}`, { cause })
		this.name = 'DiscordApiError'
		this.method = method
		this.endpoint = endpoint
		this.status = status
		this.details = body
	}
}

async function readErrorBody(res) {
	const text = await res.text().catch(() => '')
	try {
		return JSON.parse(text)
	} catch {
		return text.slice(0, 500)
	}
}

export function createDiscordClient({ token, fetch = nodeFetch, baseUrl = DISCORD_API_URL, timeoutMs = 10_000 }) {
	async function request(endpoint, options = {}) {
		const { method = 'GET', body } = options
		// append endpoint to root API URL
		const url = baseUrl + endpoint

		let res
		try {
			// Use node-fetch to make requests
			res = await fetch(url, {
				method,
				headers: {
					Authorization: `Bot ${token}`,
					'Content-Type': 'application/json; charset=UTF-8',
					'User-Agent': USER_AGENT,
				},
				// Stringify payloads
				body: body === undefined ? undefined : JSON.stringify(body),
				signal: AbortSignal.timeout(timeoutMs),
			})
		} catch (err) {
			throw new DiscordApiError({ method, endpoint, status: 0, cause: err })
		}

		// throw API errors
		if (!res.ok) {
			throw new DiscordApiError({ method, endpoint, status: res.status, body: await readErrorBody(res) })
		}

		// return original response
		return res
	}

	async function requestJson(endpoint, options) {
		const res = await request(endpoint, options)
		if (res.status === 204) return null
		return res.json()
	}

	return { request, requestJson }
}
