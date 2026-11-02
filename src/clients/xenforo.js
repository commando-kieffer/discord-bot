import axios from 'axios'
import qs from 'qs'

// Client de l'API REST de XenForo (https://xenforo.com/community/pages/api-endpoints/).
// La clé est une clé super-utilisateur : chaque appel précise le compte au nom duquel il est fait (XF-Api-User).

export class XenforoApiError extends Error {
	constructor(message, { method, path, status = 0, errors = [], cause } = {}) {
		super(message, { cause })
		this.name = 'XenforoApiError'
		this.method = method
		this.path = path
		this.status = status
		this.details = errors
	}

	// Messages d'erreur du forum (déjà traduits), utiles à afficher tels quels quand une donnée est refusée
	get forumMessages() {
		return this.details.map((error) => error?.message).filter(Boolean)
	}
}

// Ne garde de l'erreur axios que le strict nécessaire : elle contient aussi les en-têtes, donc la clé d'API
function toXenforoError(err, method, path) {
	const cause = new Error(err.message)
	cause.name = err.name
	cause.code = err.code

	if (err.response) {
		const { status, data, headers } = err.response
		const errors = Array.isArray(data?.errors) ? data.errors : []
		let reason = errors.map((error) => error.code).filter(Boolean).join(', ')
		if (status >= 300 && status < 400) {
			reason = `redirection vers ${headers?.location ?? '?'} (vérifier CK_FORUM_API)`
		}
		return new XenforoApiError(`Forum ${method} ${path} : HTTP ${status}${reason ? ` - ${reason}` : ''}`, {
			method,
			path,
			status,
			errors,
			cause,
		})
	}

	return new XenforoApiError(`Forum ${method} ${path} : forum injoignable (${err.code ?? err.message})`, {
		method,
		path,
		cause,
	})
}

// XenForo lit un tableau vide comme « absent » ; une chaîne vide est en revanche convertie en tableau vide
export const encodeForm = (params) =>
	qs.stringify(
		Object.fromEntries(
			Object.entries(params).map(([key, value]) => [key, Array.isArray(value) && value.length === 0 ? '' : value])
		),
		{ arrayFormat: 'brackets' }
	)

// `apiUser` est le compte forum au nom duquel le bot agit par défaut (CK_FORUM_API_USER)
export function createXenforoClient({ apiUrl, apiKey, apiUser, http = axios, timeoutMs = 10_000 }) {
	async function call(method, path, { params, asUser = apiUser } = {}) {
		if (!apiUrl || !apiKey) {
			throw new XenforoApiError("L'API du forum n'est pas configurée (CK_FORUM_API, CK_FORUM_API_KEY)", { method, path })
		}

		try {
			const response = await http.request({
				method,
				url: apiUrl + path,
				data: params ? encodeForm(params) : undefined,
				headers: {
					'content-type': 'application/x-www-form-urlencoded',
					'XF-Api-Key': apiKey,
					'XF-Api-User': String(asUser),
				},
				timeout: timeoutMs,
				// Une redirection renverrait la clé d'API vers une autre adresse
				maxRedirects: 0,
			})
			return response.data
		} catch (err) {
			throw toXenforoError(err, method, path)
		}
	}

	const forumUserId = (userId) => {
		if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
			throw new TypeError(`Identifiant de compte forum invalide : ${JSON.stringify(userId)}`)
		}
		return Number(userId)
	}

	return {
		// Sans contournement des permissions : XenForo vérifie que le compte du bot est administrateur,
		// et refuse par exemple de modifier un super-administrateur.
		// Champs acceptés : https://xenforo.com/community/pages/api-endpoints/#route_post_users_id_
		updateUser: async (userId, fields) =>
			(await call('POST', `/users/${forumUserId(userId)}`, { params: fields, asUser: forumUserId(apiUser) })).user,

		createThread: async ({ asUser, ...fields }) =>
			(await call('POST', '/threads', { params: fields, asUser: forumUserId(asUser) })).thread,
	}
}
